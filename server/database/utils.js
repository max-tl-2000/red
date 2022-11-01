/*
 * Copyright (c) 2022 Reva Technology Inc., all rights reserved.
 * Unauthorized copying of this file, via any medium is strictly prohibited
 * Licensed under the Elastic License 2.0; you may not use this file except
 * in compliance with the Elastic License 2.0.
 */

import isPlainObject from 'lodash/isPlainObject';
import logger from '../../common/helpers/logger';
import { DALTypes } from '../../common/enums/DALTypes';
import { SheetImportError } from '../common/errors';

export const formatObjectForRawQuery = data => {
  const { ...res } = Object.keys(data).reduce((acc, key) => {
    let value = data[key];
    if (isPlainObject(value)) {
      value = JSON.stringify(value);
    }
    if (Array.isArray(value)) {
      value = `{${data[key]}}`;
    }
    acc[key] = value;
    return acc;
  }, {});

  if (data.created_at instanceof Date) {
    res.created_at = data.created_at.toISOString();
  }
  if (data.updated_at instanceof Date) {
    res.updated_at = data.updated_at.toISOString();
  }
  return res;
};

const transformArrayToObject = columns =>
  columns.reduce((acc, column) => {
    acc[column] = true;
    return acc;
  }, {});

const removeObjectKeys = (item, keysToRemove) =>
  Object.keys(item).reduce((acc, key) => {
    if (keysToRemove[key]) return acc;

    acc[key] = item[key];
    return acc;
  }, {});

const formatArrayObjectForRawQuery = (data, expectedColumns, totalColumnsToExclude) => {
  const entities = Array.isArray(data) ? data : [data];
  const totalColumnsToExcludeObj = transformArrayToObject(totalColumnsToExclude);
  let error;
  const dataFormatted = entities.reduce((acc, item) => {
    const itemWithoutExcludeColumns = removeObjectKeys(item, totalColumnsToExcludeObj);
    const itemKeysWithoutExcludeColumns = Object.keys(itemWithoutExcludeColumns);

    if (itemKeysWithoutExcludeColumns.length !== expectedColumns.length && !error) {
      error = {
        expectedColumns,
        itemColumns: itemKeysWithoutExcludeColumns,
      };
      return acc;
    }

    acc.push(formatObjectForRawQuery(item));
    return acc;
  }, []);

  if (error) {
    const COLUMNS_DOESNT_MATCH_WITH_DATA = 'Columns expected for bulkUpsert does not match with data';
    logger.error(error, COLUMNS_DOESNT_MATCH_WITH_DATA);
    throw new SheetImportError({
      message: `${COLUMNS_DOESNT_MATCH_WITH_DATA}: ${JSON.stringify(error)}`,
      extraInfo: error,
    });
  }

  return dataFormatted;
};

const formatCompositeConstraintColumns = (tenantId, tablename, constraints) => {
  // CPM-4584
  if (tablename === 'Inventory') {
    return constraints
      .map(column => {
        if (column === 'buildingId') {
          return `COALESCE("${column}", '00000000-0000-0000-0000-000000000000')`;
        }
        return `"${column}"`;
      })
      .join(', ');
  }
  return constraints.map(column => `"${column}"`).join(', ');
};

const isJsonObject = value => {
  if (typeof value === 'object') return true;
  const isEmptyJsonObject = jsonObject => Object.keys(jsonObject).length === 0;

  try {
    const parsedValue = JSON.parse(value);
    // this is to make sure the parsed value is not a boolean, because JSON.parse(true) returns true
    return typeof parsedValue === 'object' && !isEmptyJsonObject(parsedValue);
  } catch (e) {
    return false;
  }
};

const toDeltaWithJsonUpdatesQueryBuilder = (knexInstance, tablename, delta) => {
  const jsonColumnUpdate = (name, value) => knexInstance.raw(`"${tablename}"."${name}"::jsonb || :param`, { param: value });

  const jsonColumns = Object.keys(delta).filter(key => delta[key] && isJsonObject(delta[key]));

  const jsonDelta = jsonColumns.map(key => ({ [key]: jsonColumnUpdate(key, delta[key]) })).reduce((acc, dt) => ({ ...acc, ...dt }), {});

  return {
    ...delta,
    ...jsonDelta,
  };
};

// it seems here knex is used as query builder
// eslint-disable-next-line
export function buildNativeInsertOnConflictSQL(knex, tenantId, tablename, data, constraints, columnsToUpdate, jsonUpdatesQueryBuilder, options) {
  const toDeltaWithJsonUpdateQueryBuilder = jsonUpdatesQueryBuilder || toDeltaWithJsonUpdatesQueryBuilder;
  const dataFormattedForInsert = formatObjectForRawQuery(data);
  const insert = knex(tablename).insert(dataFormattedForInsert).withSchema(tenantId).toString();

  const deltaWithJsonUpdates = toDeltaWithJsonUpdateQueryBuilder(knex, tablename, columnsToUpdate);
  const deltaFormattedForUpdate = formatObjectForRawQuery(deltaWithJsonUpdates);
  const update = knex(tablename).update(deltaFormattedForUpdate).withSchema(tenantId).toString().replace(` "${tenantId}"."${tablename}"`, '');

  const query = `
    ${insert}
    ON CONFLICT (${formatCompositeConstraintColumns(tenantId, tablename, constraints)}) ${options?.onConflictPredicate || ''}
    DO
    ${update}
    RETURNING *;`;

  return query.replace(/\\\'/g, "''").replace(/\?/g, '\\?'); // eslint-disable-line
}

const onConflictDoUpdate = (tenantId, tablename, constraints, update, options) =>
  `
    ON CONFLICT (${formatCompositeConstraintColumns(tenantId, tablename, constraints)}) ${options?.onConflictPredicate || ''}
    DO UPDATE SET
    ${update}
  `;

const onConflictDoNothing = (tenantId, tablename, constraints, options) =>
  `
    ON CONFLICT (${formatCompositeConstraintColumns(tenantId, tablename, constraints)}) ${options?.onConflictPredicate || ''}
    DO NOTHING
  `;

// knex is used as query builder
// eslint-disable-next-line
export const buildNativeInsertsOnConflictSQL = (knex, tenantId, tablename, data, constraints, columnNamesToUpdate, totalColumnsToExclude, options) => {
  const dataFormattedForInsert = formatArrayObjectForRawQuery(data, columnNamesToUpdate, totalColumnsToExclude);
  const insert = knex(tablename).insert(dataFormattedForInsert).withSchema(tenantId).toString();

  const update = columnNamesToUpdate.map(column => `"${column}" = EXCLUDED."${column}"`).join(', ');

  const conflict = update
    ? onConflictDoUpdate(tenantId, tablename, constraints, update, options)
    : onConflictDoNothing(tenantId, tablename, constraints, options);

  const query = `
    ${insert}
    ${conflict}
    RETURNING *;`;

  return query.replace(/\\\'/g, "''").replace(/\?/g, '\\?'); // eslint-disable-line
};

export const notifyOnTrigger = (tenantId, funName, notificationName) =>
  `CREATE OR REPLACE FUNCTION db_namespace."${funName}"()
   RETURNS trigger AS $$
   DECLARE
     current_row RECORD;
   BEGIN
     IF (TG_OP = 'INSERT' OR TG_OP = 'UPDATE') THEN
       current_row := NEW;
     ELSE
       current_row := OLD;
     END IF;
     PERFORM pg_notify(
       '${notificationName}',
       json_build_object(
         'tenantId', replace('${tenantId}', '"', ''),
         'table', TG_TABLE_NAME,
         'type', TG_OP,
         'id', current_row.id
       )::text
     );
     RETURN current_row;
   END;
   $$ LANGUAGE plpgsql;
   `;

export const insertCustomNotificationTrigger = (funName, partyIdQuery) =>
  `CREATE OR REPLACE FUNCTION db_namespace."${funName}"()
   RETURNS trigger AS $$
   DECLARE current_row RECORD;
   DECLARE party_id UUID;
   DECLARE trx_id BIGINT;
   DECLARE begin_time BIGINT;
   DECLARE end_time BIGINT;
   BEGIN
     begin_time := extract(epoch from clock_timestamp()) * 1000;
     IF (TG_OP = 'INSERT' OR TG_OP = 'UPDATE') THEN
       current_row := NEW;
     ELSE
       current_row := OLD;
     END IF;
     FOR party_id IN (${partyIdQuery})
     LOOP
     IF party_id IS NOT NULL THEN
       -- the trigger is deffered until the end of transaction so we should generate the updated document only once
       SELECT transaction_id FROM db_namespace."PartyDocumentHistory" pdh
       WHERE pdh."partyId"=party_id
       AND pdh.triggered_by->>'table' <> TG_TABLE_NAME --rebuild the object for multiple changes on the same table
       ORDER BY pdh.created_at DESC
       LIMIT 1
       INTO trx_id;
       IF trx_id IS NOT NULL AND trx_id = txid_current() THEN
          RAISE WARNING 'SKIPPING PartyDocumentHistory generation, document already generated in TX=% OP=% TABLE=% ID=%', txid_current(), TG_OP, TG_TABLE_NAME, current_row.id;
          -- TODO: add the skipped event to the list of events for this version
       ELSE
          INSERT INTO db_namespace."PartyDocumentHistory"
          (id, "partyId", "document", transaction_id, triggered_by, status, created_at, updated_at)
          VALUES("public".gen_random_uuid(),
                 party_id,
                 (row_to_json(db_namespace.buildAggregatedPartyDocument(party_id))::jsonb)->'result',
                 txid_current(),
                 json_build_object('table', TG_TABLE_NAME,
                            'type', TG_OP,
                            'entity_id', current_row.id),
                 '${DALTypes.PartyDocumentStatus.PENDING}',
                 now(), now());
       END IF;
     ELSE
      RAISE WARNING 'party_id is not defined, SKIPPING PartyDocumentHistory generation TX=% OP=% TABLE=% ID=%', txid_current(), TG_OP, TG_TABLE_NAME, current_row.id;
     END IF;
     END LOOP;
     end_time := extract(epoch from clock_timestamp()) * 1000;
     RAISE WARNING 'trigger for PartyDocumentHistory generation took TX=% OP=% TABLE=% ID=% MS=%', txid_current(), TG_OP, TG_TABLE_NAME, current_row.id, (end_time - begin_time);
     RETURN current_row;
   END;
   $$ LANGUAGE plpgsql;
   `;
