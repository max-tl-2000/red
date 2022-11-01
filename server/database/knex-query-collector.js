/*
 * Copyright (c) 2022 Reva Technology Inc., all rights reserved.
 * Unauthorized copying of this file, via any medium is strictly prohibited
 * Licensed under the Elastic License 2.0; you may not use this file except
 * in compliance with the Elastic License 2.0.
 */

import { EventEmitter } from 'events';
import now from 'performance-now';
import loggerInstance from '../../common/helpers/logger';
import trim from '../../common/helpers/trim';
import config from '../config';

const logger = loggerInstance.child({ subType: 'knexQueryCollector' });

/**
 * Creates a proxy for the client object that is shared
 * by all knex instances we do this because we want to be
 * able to tell which queries are executed by a given request
 * so we need an instance that is unique per request but that is
 * still shared process wide to avoid depleting the resources
 * trying to acquire too much connections
 * @param {Object} client
 */
export const makeDbClientProxy = client => {
  const ee = new EventEmitter();
  return new Proxy(client, {
    get: (obj, prop) => {
      // we specifically capture the calls to on and emit
      // so they don't go to the shared instance, but to
      // the event emmiter that we just created for the proxy instance
      if (prop === 'on' || prop === 'emit' || prop === 'listenerCount' || prop === 'removeListener') {
        return (...args) => ee[prop](...args);
      }
      return obj[prop];
    },
  });
};

const getCompiledQuery = (dbKnex, entry) => {
  let compiledQuery;

  if (entry.compiledQuery) {
    compiledQuery = entry.compiledSQL;
  } else if (entry.bindings?.length > 0 && typeof entry.sql === 'string') {
    try {
      compiledQuery = dbKnex.raw(entry.sql, entry.bindings).toQuery();
    } catch (err) {
      logger.warn({ err, entry }, 'error compiling query');
      compiledQuery = entry.sql;
    }
  } else {
    compiledQuery = entry.sql;
  }

  return compiledQuery;
};

const cleanQueryObj = (query, opts = {}) => {
  if (!query) return undefined;

  const { id, knexId, trxId, compiledSQL, sql, queryType, completed, durationFormatted, duration, ...rest } = query;

  const theSQL = trim(compiledSQL || sql)
    .replace(/\\n(\s+)/gm, ' ')
    .replace(/\n(\s+)/gm, ' ')
    .substr(0, 100);

  const queryOut = {
    id,
    knexId,
    trxId,
    sql: theSQL,
    queryType,
    completed,
    duration,
    durationFormatted,
  };

  if (opts.longReport) {
    return { ...rest, ...queryOut };
  }

  return queryOut;
};

/**
 * creates a helper object that will keep track of all queries during a request
 * this structure can be used to generate some interesting reports, like how many
 * db calls per request were done, which queries were executed more than once, which
 * queries were faster and which slower during a given request execution
 */
export const createQueriesCollector = options => {
  const map = new Map();

  return {
    /**
     * register that a db call was started
     */
    registerQuery: query => {
      const id = query.__knexQueryUid;

      const entry = {
        knexId: query.__knexUid,
        trxId: query.__knexTxId,
        id,
        start: now(),
      };

      map.set(id, entry);
    },
    /**
     * register the result of the db call
     */
    registerQueryResult: (result, query, builder) => {
      const id = query.__knexQueryUid;
      const entry = map.get(id);

      if (!entry) {
        return; // ignore if query not found in map
      }

      entry.rowCount = query.response?.rowCount || result?.length;
      entry.completed = true;
      entry.command = trim(query.command).toUpperCase();
      entry.method = trim(query.method).toUpperCase();
      entry.queryType = entry.command || entry.method;
      entry.compiledSQL = builder.toQuery();
      entry.end = now();
      entry.duration = entry.end - entry.start;
      entry.durationFormatted = `${entry.duration.toFixed(3)}ms`;
    },

    /**
     * register that a db call finished with errors
     */
    registerQueryError: (error, query) => {
      const id = query.__knexQueryUid;
      const entry = map.get(id);

      if (!entry) {
        return; // ignore if query not found in map
      }

      entry.error = { messsage: error.message, stack: error.stack, code: error.code };
      entry.end = now();
      entry.duration = entry.end - entry.start;
    },
    get numOfQueries() {
      return map.size;
    },

    /**
     * generates a report with all the captured db calls
     */
    generateReport: dbKnex => {
      const values = Array.from(map.values());

      const addEntry = (queriesMap, query, entry) => {
        let queryEntry = queriesMap.get(query);
        if (!queryEntry) {
          queryEntry = { id: query, count: 0 };
          queriesMap.set(query, queryEntry);
        }
        queryEntry.count += 1;

        if (entry?.error) {
          queryEntry.errors = queryEntry.errors || [];
          const { message, stack } = entry.error;
          queryEntry.errors.push({ message, stack });
        }
      };

      // sort all queries
      const queries = values.sort((entryA, entryB) => (entryA.duration < entryB.duration ? 1 : -1));

      const report = queries.reduce(
        (acc, entry) => {
          const query = getCompiledQuery(dbKnex, entry);

          if (!entry.compiledSQL) {
            entry.compiledSQL = query;
          }

          if (entry.completed) {
            acc.successfulCount += 1;
            addEntry(acc.successfulQueriesMap, query, entry);
          }

          if (entry.error) {
            acc.failedCount += 1;
            addEntry(acc.failedQueriesMap, query, entry);
          }

          acc.queriesByTypes[entry.queryType] = acc.queriesByTypes[entry.queryType] || 0;
          acc.queriesByTypes[entry.queryType] += 1;

          const trxId = entry.trxId || 'unknown_trx';

          acc.queriesPerTransaction[trxId] = acc.queriesPerTransaction[trxId] || 0;
          acc.queriesPerTransaction[trxId] += 1;

          acc.total += 1;
          return acc;
        },
        {
          total: 0,
          failedCount: 0,
          successfulCount: 0,
          successfulQueriesMap: new Map(),
          failedQueriesMap: new Map(),
          queriesByTypes: {},
          queriesPerTransaction: {},
        },
      );

      const successful = Array.from(report.successfulQueriesMap.values());
      const failed = Array.from(report.failedQueriesMap.values());

      const repeatedQueries = [...successful.filter(entry => entry.count > 1), ...failed.filter(entry => entry.count > 1)];

      let reportObj = {
        queriesByTypes: report.queriesByTypes,
        numberOfTrx: Object.keys(report.queriesPerTransaction).length,
        fasterQuery: queries.length > 0 ? cleanQueryObj(queries[queries.length - 1], options) : undefined,
        slowerQuery: cleanQueryObj(queries[0], options),
        numberOfRepeatedQueries: repeatedQueries.length,
        numberOfQueries: report.total,
        numberOfFailedQueries: report.failedCount,
        numberOfSuccessfulQueries: report.successfulCount,
      };

      if (options.longReport) {
        reportObj = {
          ...reportObj,
          repeatedQueries,
          queriesPerTransaction: report.queriesPerTransaction,
          queries: queries.map(entry => ({ queryType: entry.queryType, duration: entry.duration, compiledSQL: entry.compiledSQL, trxId: entry.trxId })),
        };
      }

      // final report
      // TODO: should we consider to log all the queries to a file with the requestId?
      // since this is hidden behind a flag and can be enabled from the client side
      // maybe it might be worth to explore how can we save all the queries info
      // so it can be analyzed in different ways
      return reportObj;
    },
  };
};

const getKnexConnection = readOnlyConnection => {
  const { knex, knexReadOnly } = require('./knex'); // eslint-disable-line global-require

  return readOnlyConnection ? knexReadOnly : knex;
};

/**
 * creates a knex instance that has a tampered client instance
 * that way we can listen to the query/query-response and query-error only for this dbKnex instance
 * @param {Collector} collector
 */
export const createDbKnex = (collector, readOnlyConnection = false) => {
  const knex = getKnexConnection(readOnlyConnection);
  const clientProxy = makeDbClientProxy(knex.client);
  const noBindEvents = true;
  const dbKnex = knex.withUserParams({ ...knex.userParams }, noBindEvents);

  dbKnex.client = clientProxy;

  clientProxy.on('query', collector.registerQuery);
  clientProxy.on('query-response', collector.registerQueryResult);
  clientProxy.on('query-error', collector.registerQueryError);

  return dbKnex;
};

export const createDBKnexInstanceWithCollector = options => {
  const collector = createQueriesCollector(options);

  // set the dbKnex in the request so all queries can use it
  const dbKnex = createDbKnex(collector);
  const dbKnexReadOnly = createDbKnex(collector, true);

  return { dbKnex, dbKnexReadOnly, collector };
};

export const getKnexFromCtx = ctx => {
  ctx = ctx || {};
  if (!ctx.dbKnex) {
    const objForLogging = {
      ctx,
    };

    const { knex } = require('./knex'); // eslint-disable-line global-require

    const dbProfiling = config?.dbProfiling;

    if (dbProfiling?.enabled && dbProfiling?.logMissingKnexInCtx) {
      // only for development it will be removed in prod
      const StackTracey = require('stacktracey'); // eslint-disable-line global-require

      const stack = new StackTracey();
      objForLogging.stack = stack.withSources.clean
        .filter(l => l.fileName !== 'knex-query-collector.js' && l.fileName !== 'factory.js') // ignore this file and factory functions
        .map(l => `${l.callee || 'anonymous'} ${l.fileName}:${l.line},${l.column}`);

      logger.warn(objForLogging, '>>> dbKnex not found in ctx');
    }

    return knex;
  }

  return ctx.readOnlyServer ? ctx.dbKnexReadOnly : ctx.dbKnex;
};
