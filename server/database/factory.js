/*
 * Copyright (c) 2022 Reva Technology Inc., all rights reserved.
 * Unauthorized copying of this file, via any medium is strictly prohibited
 * Licensed under the Elastic License 2.0; you may not use this file except
 * in compliance with the Elastic License 2.0.
 */

import newId from 'uuid/v4';
import omit from 'lodash/omit';
import without from 'lodash/without';
import { mapSeries } from 'bluebird';

import nullish from '../../common/helpers/nullish';
import { isObject } from '../../common/helpers/type-of';
import loggerModule from '../../common/helpers/logger';
import { formatStack } from '../../common/helpers/stack-formatter';
import { execConcurrent } from '../../common/helpers/exec-concurrent';
import { knex } from './knex'; // TODO: remove this knex import (we should always use getKnexFromCtx instead)
import { makeTransactionProxy } from './transaction-proxy';
import { prepareRawQuery } from '../common/schemaConstants';
import { ServiceError } from '../common/errors';
import { buildNativeInsertOnConflictSQL, buildNativeInsertsOnConflictSQL, formatObjectForRawQuery } from './utils';
import { getKnexFromCtx } from './knex-query-collector';
import envVal from '../../common/helpers/env-val';
import { serializeAndEscapeSingleQuotes } from './escape';

const logger = loggerModule.child({ subType: 'factory' });

const schemaInfo = new Map();

const getPoolStats = ctx => {
  const pool = getKnexFromCtx(ctx)?.client?.pool;

  if (!pool) {
    logger.warn({ ctx }, 'Cannot get pool instance');
    return {};
  }

  const pendingAcquires = pool.numPendingAcquires();
  const pendingCreates = pool.numPendingCreates();

  return {
    used: pool.numUsed(),
    free: pool.numFree(),
    pendingAcquires,
    pendingCreates,
    pending: pendingAcquires + pendingCreates,
    max: pool.max,
    min: pool.min,
  };
};

export const buildInClause = ids => ids.map(_id => '?::uuid').join(',');

export const rawStatement = (ctx, statement, bindings = []) => {
  const raw = getKnexFromCtx(ctx).raw(prepareRawQuery(statement, ctx.tenantId), ...bindings);
  const withTrx = ctx.trx ? raw.transacting(ctx.trx) : raw;

  return withTrx;
};

export const updateJsonColumn = (ctx, name, delta = {}) => {
  const removeUndefinedValues = obj => JSON.parse(JSON.stringify(obj));
  const value = removeUndefinedValues(delta);
  return getKnexFromCtx(ctx).raw(`${name}::jsonb || :value`, { value });
};

const logPoolStats = ({ onlyIfQueued = true, ctx }) => {
  const stats = getPoolStats(ctx);
  const shouldLog = !onlyIfQueued || stats.pending > 0;
  shouldLog && logger.trace({ stats }, 'knex pool stats');
};

const assertValidCtx = ctx => {
  if (!ctx) throw new Error('Ctx object must be defined');
};

const withValidatedSchemaFromCtx = ctx => {
  assertValidCtx(ctx);
  if (ctx.tenantId) return getKnexFromCtx(ctx).withSchema(ctx.tenantId);
  throw new Error('Empty schema (tenantId) found!');
};

export const initQuery = ctx => {
  assertValidCtx(ctx);
  return ctx.trx ? withValidatedSchemaFromCtx(ctx).transacting(ctx.trx) : withValidatedSchemaFromCtx(ctx);
};

export const closePool = async ctx => {
  const knexInstance = getKnexFromCtx(ctx);
  logger.trace('Closing database connection pool');
  logger.trace({ stats: getPoolStats(ctx) }, 'knexPool stats');

  await knexInstance.destroy();
  logger.trace('Database pool has been closed');
};

const rollback = async (trx, { originStack, error }) => {
  try {
    // knex actually wants to know the error otherwise
    // an error will be printing warning about a rejection with undefined
    await trx.rollback(error);
  } catch (err) {
    logger.error({ err, originStack }, 'Unable to rollback transaction!');
  }
};

const executePostCommitOperations = async ({ trxId, postCommitOperations = [] }) =>
  await mapSeries(postCommitOperations, async op => {
    try {
      await op({ postCommit: true });
    } catch (err) {
      logger.error({ trxId, error: err, op }, 'runInTransaction error - post commit hooks');
    }
  });

const notATransactionError = error => error instanceof ServiceError && error.status && error.status >= 400 && error.status < 500;

const logError = (ctx, { trxId, error, originStack }) => {
  const errorMessage = notATransactionError(error) ? 'business logic error catch in runInTransaction' : 'runInTransaction error';
  logger.error({ ctx, trxId, error, originStack }, errorMessage);
};

export const runInTransaction = async (func, ctx) => {
  if (ctx && ctx.trx) {
    return await func(ctx.trx);
  }

  // TODO: move this code under a flag as creating an error impacts peformance
  const originStack = formatStack(new Error().stack);
  const stats = getPoolStats(ctx);

  if (stats.available <= 3 && stats.available < stats.size) {
    logPoolStats({ onlyIfQueued: false, ctx });
    logger.warn({ ctx, originStack }, 'Connection pool is approaching empty - this request may be delayed');
  }

  return new Promise((resolve, reject) => {
    getKnexFromCtx(ctx)
      .transaction(async tran => {
        const trx = makeTransactionProxy(tran, originStack);
        const { trxId } = trx;
        // Q: does this belong inside the proxy?
        trx.addPostCommitOperation = op => {
          trx.postCommitOperations = [...(trx.postCommitOperations || []), op];
        };

        try {
          const res = await func(trx);
          // Note this commit should NOT be necessary, and will actually result in errors displayed
          // (if DEBUG=knex:tx is set) when the promise is resolved, as knex will auto-commit
          // at that point.
          // This duplicate commit is harmless, however, so leaving in place until we can
          // do some more significant refactoring
          const commitRes = await trx.commit();

          // If "func" exceptions are swallowed than this won't signal a transaction failure unless we check the commit result.
          // All this null defense is needed because the knexInstance may change the structure of the response and then we might rollback the
          // transaction even if successful
          if (commitRes?.response?.command === 'ROLLBACK') {
            throw new Error(`transaction ${trxId} commit failed with result: ${JSON.stringify(commitRes, null, 2)}`);
          }

          if (trx.postCommitOperations) {
            logger.trace({ numOperations: trx.postCommitOperations.length }, 'transaction committed; operations to be triggered post commit');
            await executePostCommitOperations(trx);
          }

          resolve(res);
        } catch (error) {
          logError(ctx, { trxId, error, originStack });
          await rollback(trx, { error, originStack });
          reject(error);
        }
      })
      .catch(() => logPoolStats({ onlyIfQueued: true, ctx }));
  });
};

const getColumnsFromDb = async ctx => {
  const { tenantId } = ctx;

  const knexInstance = getKnexFromCtx(ctx);

  const columnsAgg = knexInstance.raw(`
            json_agg(
                distinct "columns"."column_name"
            ) as "columns"`);

  const cols = await knexInstance
    .withSchema('information_schema')
    .from('columns')
    .where('columns.table_schema', tenantId)
    .select('columns.table_name', columnsAgg)
    .groupBy('columns.table_name');

  if (!cols || !cols.length) {
    throw new Error(`Attempt to access non-existent tenant ${tenantId}`);
  }

  return cols;
};

const getUniqueConstraintsFromDb = ctx => {
  assertValidCtx(ctx);

  const { tenantId } = ctx;

  const knexInstance = getKnexFromCtx(ctx);

  const uniqueColumnsAgg = knexInstance.raw(`
         json_agg(
             distinct "constraint_column_usage"."column_name"
         ) as "uniqueColumns"`);

  return knexInstance
    .withSchema('information_schema')
    .from('table_constraints')
    .where('table_constraints.constraint_schema', tenantId)
    .andWhere('constraint_column_usage.constraint_schema', tenantId)
    .andWhere('constraint_type', 'UNIQUE')
    .innerJoin('constraint_column_usage', 'constraint_column_usage.constraint_name', 'table_constraints.constraint_name')
    .select('table_constraints.table_name', uniqueColumnsAgg)
    .groupBy('table_constraints.table_name');
};

const getTenantSchemaInfo = ctx => {
  assertValidCtx(ctx);
  const { tenantId } = ctx;
  if (!schemaInfo.get(tenantId)) schemaInfo.set(tenantId, {});
  return schemaInfo.get(tenantId);
};

const getUniqueConstraints = async (ctx, tableName) => {
  const tenantSchemainfo = getTenantSchemaInfo(ctx);
  if (!tenantSchemainfo.uniqueConstraints) {
    const columnsArray = (await getUniqueConstraintsFromDb(ctx)).map(c => [c.table_name, c.uniqueColumns]);
    tenantSchemainfo.uniqueConstraints = new Map(columnsArray);
  }
  return tenantSchemainfo.uniqueConstraints.get(tableName);
};

const getColumns = async (ctx, tableName) => {
  const tenantSchemaInfo = getTenantSchemaInfo(ctx);

  if (!tenantSchemaInfo.tableColumns) {
    const consArray = (await getColumnsFromDb(ctx)).map(c => [c.table_name, c.columns]);
    tenantSchemaInfo.tableColumns = new Map(consArray);
  }

  return tenantSchemaInfo.tableColumns.get(tableName);
};

const ensureCtxIsAnObject = tenantIdOrCtx => {
  if (isObject(tenantIdOrCtx)) {
    return tenantIdOrCtx;
  }

  if (envVal('REVA_DB_PROFILING_LOG_MISSING_CTX')) {
    logger.warn({ tenantIdOrCtx }, 'Factory function called without a valid ctx object');
  }

  return { tenantId: tenantIdOrCtx };
};

/**
 * Q: Why isn't the sql query inside a BEGIN - END block?
 * A: Because, it's impossible to do a manual rollback in that way since
 * "BEGIN - END" is a transaction.
 *
 */
export const upsert = async (tenantIdOrCtx, tableName, data, trx, conflictColumns, excludeColumns, jsonUpdatesQueryBuilder, options) => {
  const ctx = ensureCtxIsAnObject(tenantIdOrCtx);

  trx = ctx.trx || trx;
  const { tenantId } = ctx;
  const constraints = conflictColumns || (await getUniqueConstraints(ctx, tableName));
  const columnsToUpdate = !excludeColumns
    ? omit(data, ['id', 'created_at'].concat(constraints))
    : omit(data, ['id', 'created_at'].concat(constraints).concat(excludeColumns));

  const knexInstance = getKnexFromCtx(ctx);

  const query = buildNativeInsertOnConflictSQL(knexInstance, tenantId, tableName, data, constraints, columnsToUpdate, jsonUpdatesQueryBuilder, options);
  const res = await knexInstance.raw(query).transacting(trx);
  return res;
};

/**
 * All rows on data should have all the required columns on database
 */
export const bulkUpsert = async (ctx, tableName, rows, conflictColumns, excludeColumns, options) => {
  if (!rows || rows.length === 0) return null;
  const { tenantId, trx: outerTrx } = ctx;
  const constraints = conflictColumns || (await getUniqueConstraints(ctx, tableName));
  const columnNames = Object.keys(rows[0]);

  const totalColumnsToExclude = !excludeColumns ? ['id', 'created_at'].concat(constraints) : ['id', 'created_at'].concat(constraints).concat(excludeColumns);
  const columnsToUpdate = without(columnNames, ...totalColumnsToExclude);

  const knexInstance = getKnexFromCtx(ctx);

  const query = buildNativeInsertsOnConflictSQL(knexInstance, tenantId, tableName, rows, constraints, columnsToUpdate, totalColumnsToExclude, options);
  const executeQuery = async trx => await knexInstance.raw(query).transacting(trx);

  if (outerTrx) return executeQuery(outerTrx);

  return runInTransaction(async trx => await executeQuery(trx)).catch(error => {
    logger.error({ error }, `[ERROR ON BULK UPSERT] ${query}`);
    throw error;
  });
};

export const insertInto = async (tenantIdOrCtx, tableName, entity, options = {}) => {
  const ctx = ensureCtxIsAnObject(tenantIdOrCtx);
  const outerTrx = ctx.trx || options.outerTrx;
  const { tenantId } = ctx;
  const { updateOnConflict = false, conflictColumns = null, excludeColumns = null, jsonUpdatesQueryBuilder = null } = options;
  const entities = Array.isArray(entity) ? entity : [entity];
  if (updateOnConflict && entities.length !== 1) {
    throw new Error('Update on conflict is not implemented for multiple rows');
  }

  const executeInsert = async transaction => {
    const now = new Date();

    const rows = await execConcurrent(entities, async e => {
      const { ...elem } = e;
      const columns = await getColumns(ctx, tableName);

      if (!columns) throw new Error(`cannot find columns for ${tenantId}.${tableName}`);

      if (!e.id && columns.some(c => c === 'id')) {
        elem.id = newId();
      }
      elem.created_at = now;
      elem.updated_at = now;
      return elem;
    });

    if (updateOnConflict) {
      const res = await mapSeries(
        rows,
        async row =>
          (await upsert(tenantId, tableName, formatObjectForRawQuery(row), transaction, conflictColumns, excludeColumns, jsonUpdatesQueryBuilder, options))
            .rows[0],
      );
      return res[0]; // TODO: fix this, doesn't look right
    }

    const result = await withValidatedSchemaFromCtx(ctx).into(tableName).insert(rows).returning('*').transacting(transaction);

    // babel-6 will throw an error when trying to use array destructuring in an object
    if (!Array.isArray(result)) return null;

    return result.length > 1 ? result : result[0];
  };

  if (outerTrx) {
    return await executeInsert(outerTrx).catch(error => {
      logger.error({ tenantId, error, entity }, `[ERROR ON INSERT] ${tenantId} ${tableName}`);
      throw error;
    });
  }

  return runInTransaction(async trx => await executeInsert(trx)).catch(error => {
    logger.error({ tenantId, error, entity }, `[ERROR ON INSERT] ${tenantId} ${tableName}`);
    throw error;
  });
};

export const insertOrUpdate = (tenantIdOrCtx, tableName, entity, options) =>
  insertInto(tenantIdOrCtx, tableName, entity, {
    updateOnConflict: true,
    ...options,
  });

/**
 * @param {string} tableName
 * @param {object} where
 * @param {object} data
 */
export const update = async (tenantIdOrCtx, tableName, where, data, outerTrx) => {
  const ctx = ensureCtxIsAnObject(tenantIdOrCtx);
  outerTrx = ctx.trx || outerTrx;

  const { tenantId } = ctx;
  data.updated_at = new Date();

  const executeUpdate = async trx => {
    const res = await withValidatedSchemaFromCtx(ctx).from(tableName).where(where).update(data).returning('*').transacting(trx);

    logger.trace({ ctx, tableName, where }, 'factory - update');

    return res;
  };

  if (outerTrx) return await executeUpdate(outerTrx);

  return await runInTransaction(async trx => await executeUpdate(trx)).catch(error => {
    logger.error({ error, data }, `[ERROR ON UPDATE] ${tenantId} ${tableName} ${where}`);
    throw error;
  });
};

/**
 * update a record given an id
 *
 * @param {string} tableName
 * @param {any} tableId
 * @param {object} data
 */
export const updateOne = async (tenantIdOrCtx, tableName, tableId, data, trx = null) => {
  const [record] = await update(tenantIdOrCtx, tableName, { id: tableId }, data, trx);
  return record;
};

/**
 * Returns whether or not there's an entry for a given table and id
 *
 * @param {string} tableName
 * @param {string} id
 * @returns {boolean}
 */
export const exists = async (tenantIdOrCtx, tableName, tableId, tableColumn = 'id') => {
  const ctx = ensureCtxIsAnObject(tenantIdOrCtx);

  const condition = { [tableColumn]: tableId };
  const result = await withValidatedSchemaFromCtx(ctx).from(tableName).where(condition).select(1).first();

  return !!result;
};

/**
 * Returns whether or not there's an entry for every id in a list for a given table
 *
 * @param {string} tableName
 * @param {array} id
 * @returns {boolean}
 */
export const allIdExists = async (tenantIdOrCtx, tableName, idList) => {
  const ctx = ensureCtxIsAnObject(tenantIdOrCtx);

  const result = await withValidatedSchemaFromCtx(ctx).from(tableName).distinct().select().whereIn('id', idList);

  return result.length === idList.length;
};

/**
 * Retrieves an entry from db
 *
 * CAUTION: This will fail if invalid fksToExpand are supplied
 *
 * @param {object} ctx
 * @param {string} table
 * @param {string} id
 * @param {object} fksToExpand
 * @param {string[]} columns
 *
 * fksToExpand has this form:
 * {
 *    [foreign key field]: {
 *      repr:
 *        name of the new field in the object
 *      rel:
 *        table name of the relation
 *      fields: (optional)
 *        fields to select from the relation
 *        if not provided all the fields (*) will be retrieved
 *    }
 *  }
 *
 * Ex:
 * ... = await getOne('ctx', 'Foo', 1, { barId: { repr: 'bar', rel: 'Bar' }})
 */
export const getOne = async (ctx, table, id, fksToExpand = {}, columns = ['*']) => {
  const fieldsToSelect = columns.map(column => `${table}.${column}`);

  const query = initQuery(ctx)
    .from(table)
    .where({ [`${table}.id`]: id });

  const knexInstance = getKnexFromCtx(ctx);

  Object.keys(fksToExpand).forEach(fk => {
    const { rel, repr, fields, optional } = fksToExpand[fk];

    if (!nullish(rel) && !nullish(repr)) {
      if (optional) {
        query.leftJoin(rel, `${rel}.id`, `${table}.${fk}`);
      } else {
        query.join(rel, `${rel}.id`, `${table}.${fk}`);
      }

      if (nullish(fields) || (fields && fields.length === 1 && fields[0] === '*')) {
        fieldsToSelect.push(knexInstance.raw(`to_json("${rel}".*) AS ${repr}`));
      } else {
        const fieldsFromRelation = fields.map(field => `'${field}', "${rel}"."${field}"`).join(', ');
        fieldsToSelect.push(knexInstance.raw(`json_build_object(${fieldsFromRelation}) AS ${repr}`));
      }
    }
  });

  query.select(...fieldsToSelect);
  const [result] = await query;
  return result;
};

/**
 * getAllWhere - Retrieve entries from DB based on a Condition
 *
 * @param {string} schema
 * @param {string} table
 * @param {string} where
 * @param {string[]} columns
 */
export const getAllWhere = async (ctx, table, where, columns = ['*'], limit) => {
  const fieldsToSelect = columns.map(column => `${table}.${column}`);
  let query = withValidatedSchemaFromCtx(ctx).from(table).where(where);

  if (limit) {
    query = query.limit(limit);
  }

  if (ctx.trx) query = query.transacting(ctx.trx);

  query.select(...fieldsToSelect);

  return await query;
};

/**
 * getAllWhereIn - Retrieve entries from DB based on a Condition
 *
 * @param {string} schema
 * @param {string} table
 * @param {object with 2 properties: column and array } where
 * @param {string[]} columns
 */
export const getAllWhereIn = async (tenantIdOrCtx, table, where, columns = ['*']) => {
  const ctx = ensureCtxIsAnObject(tenantIdOrCtx);

  const fieldsToSelect = columns.map(column => `${table}.${column}`);

  const query = withValidatedSchemaFromCtx(ctx).from(table).whereIn(where.column, where.array);

  query.select(...fieldsToSelect);

  return await query;
};

/**
 * getOneWhere - Retrieve a entry from DB based on a Condition
 *
 * @param {string} schema
 * @param {string} table
 * @param {string} where
 * @param {string[]} columns
 */
export const getOneWhere = async (tenantIdOrCtx, table, where, columns = ['*']) => {
  const ctx = ensureCtxIsAnObject(tenantIdOrCtx);
  const limit = 1;
  const rows = await getAllWhere(ctx, table, where, columns, limit);
  return rows[0];
};
/**
 * Retrieves an entry from db with the statement for update.
 *
 *
 * @param {string} schema
 * @param {string} table
 * @param {string} id
 * @param {object} trx transaction
 * @param {string[]} columns
 *
 *
 * Ex:
 * ... = await getOneForUpdate('schema', 'Foo', 1, trx, columns)
 */
export const getOneForUpdate = async (tenantIdOrCtx, table, id, trx, columns = ['*']) => {
  const ctx = ensureCtxIsAnObject(tenantIdOrCtx);
  trx = ctx.trx || trx;

  const fieldsToSelect = columns.map(column => `${table}.${column}`);

  const query = withValidatedSchemaFromCtx(ctx)
    .from(table)
    .transacting(trx)
    .forUpdate()
    .where({ [`${table}.id`]: id });

  query.select(...fieldsToSelect);
  const [result] = await query;
  return result;
};

/**
 * Expands the foreign keys in an object.
 *
 * CAUTION:
 * - this will execute a query per each foreign key
 * - the object will mutate
 *
 * @param {string} schema
 * @param {object} obj
 * @param {object} fksToExpand
 *
 * fksToExpand has this form:
 * {
 *    [foreign key field in the object]: {
 *      repr:
 *        name of the new field in the object
 *      func:
 *        function to retrieve the related object
 *        signature of the function:
 *        ctx -> object id -> object
 *    }
 *  }
 *
 *  Ex:
 *  > const foo = { name: 'Foo', barId: 1 };
 *  > expandForeignKeys('some-schema', foo, { barId: { repr: 'bar', func: getBarById } });
 *  > foo
 *  { name: 'Foo', bar: { name: 'Bar' }}
 *
 */
export const expandForeignKeys = async (tenantIdOrCtx, obj, fksToExpand = {}) => {
  const ctx = ensureCtxIsAnObject(tenantIdOrCtx);
  const { tenantId } = ctx;
  for (const fk in fksToExpand) {
    // eslint-disable-line no-restricted-syntax
    if (fk in obj) {
      const { repr, func } = fksToExpand[fk];
      if (!nullish(repr) && !nullish(func)) {
        obj[repr] = await func({ tenantId }, obj[fk]);
        delete obj[fk];
      }
    }
  }
};

export const updateJSONBField = ({ ctx, schema, table, tableId, tableColumn = 'id', field, key, value, outerTrx }) => {
  ctx = ctx || { tenantId: schema, trx: outerTrx };
  outerTrx = ctx.trx || outerTrx;
  const query = `
    UPDATE db_namespace."${table}"
    SET "${field}" = jsonb_set("${field}", '{${key}}', :updateValue::jsonb, true)
    WHERE ${tableColumn} = :tableId
    RETURNING *`;

  const condition = {};
  condition[tableColumn] = tableId;

  const { serialized: updateValue, hasCycles } = serializeAndEscapeSingleQuotes(value);

  if (hasCycles) {
    logger.warn({ ctx, updateValue }, 'updateJSONBField: object has cycles');
  }

  const updateField = async trx => {
    const { rows } = await rawStatement({ trx, ...ctx }, query, [{ updateValue, tableId }]);
    return rows[0] || {};
  };
  if (outerTrx) return updateField(outerTrx);

  return runInTransaction(async trx => await updateField(trx), ctx).catch(error => {
    logger.error({ error }, `[ERROR ON UPDATE] ${query}`);
    throw error;
  });
};

export const saveJSONBData = async (ctx, table, tableId, column, metadata, outerTrx = null) =>
  await mapSeries(
    Object.keys(metadata),
    async key =>
      typeof metadata[key] !== 'undefined' && // if the value is undefined the updateJSONBField throw a missing bindings error
      (await updateJSONBField({
        ctx,
        table,
        tableId,
        field: column,
        key,
        value: metadata[key],
        outerTrx,
      })),
  );

export const saveMetadata = async (ctx, table, tableId, metadata, outerTrx = null) => await saveJSONBData(ctx, table, tableId, 'metadata', metadata, outerTrx);

export const removeKeyFromJSONBField = ({ ctx, schema, table, tableId, tableColumn = 'id', field, key, outerTrx }) => {
  ctx = ctx || { tenantId: schema, trx: outerTrx };
  outerTrx = ctx.trx || outerTrx;
  const { tenantId } = ctx;
  const query = `
    UPDATE "${tenantId}"."${table}"
    SET "${field}" = "${field}"::jsonb - '${key}'
    WHERE ${tableColumn} = '${tableId}'`;

  const condition = {};
  condition[tableColumn] = tableId;
  const updateField = async trx => {
    const knexInstance = getKnexFromCtx(ctx);

    await knexInstance.raw(query).transacting(trx);

    return await withValidatedSchemaFromCtx(ctx).from(table).where(condition).transacting(trx).first();
  };

  if (outerTrx) return updateField(outerTrx);

  return runInTransaction(async trx => await updateField(trx)).catch(error => {
    logger.error({ error }, `[ERROR ON UPDATE] ${query}`);
    throw error;
  });
};

export { knex };
