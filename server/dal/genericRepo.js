/*
 * Copyright (c) 2022 Reva Technology Inc., all rights reserved.
 * Unauthorized copying of this file, via any medium is strictly prohibited
 * Licensed under the Elastic License 2.0; you may not use this file except
 * in compliance with the Elastic License 2.0.
 */

import { knex, initQuery } from '../database/factory';
import { SheetImportError } from '../common/errors';
import typeOf from '../../common/helpers/type-of';

const ID = 'id';
const isForeignKey = s => /^(?!external).+Id$/.test(s);
const toLowerCase = s => {
  if (!s) return '';
  if (typeOf(s) !== 'string') throw new Error(`Element is a ${typeOf(s)} and should be a string`);
  return s.toLowerCase();
};

const importToLowerCase = (s, index) => {
  try {
    return toLowerCase(s);
  } catch (error) {
    throw new SheetImportError({
      row: index + 2, // entities in sheets starts in the second row
      message: error.message,
      fieldValue: s,
    });
  }
};

/**
 * Finds all rows in the table in which column (specified by the field argument)
 * has a value contained in elementList.
 * Returns a list of the ID and field value of each matching row.
 */
export const selectIdAndFieldFromValueList = async (ctx, field, elementList, tableName) =>
  await initQuery(ctx)
    .select(ID, field)
    .from(tableName)
    .whereIn(knex.raw(`lower("${field}")`), [...new Set(elementList.map(importToLowerCase))]);

export const selectIdFromValueGroups = async (ctx, fields, elements, tableName) => {
  // Where format as ((field1 = ? and field2 =?) or (field1 = ? and field2 = ?) or ...)
  let where = '(1 <> 1)';
  const spreadElements = [];

  elements.forEach((element, index) => {
    where = `${where} OR (`;
    for (let i = 0; i < fields.length; i++) {
      try {
        let value;
        const field = fields[i];
        if (element[i]) {
          if (typeOf(element[i]) !== 'string') throw new Error(`Element is a ${typeOf(element[i])} and should be a string`);
          value = element[i].toLowerCase();
        } else {
          value = element[i];
        }
        // const value = element[i] ? element[i].toLowerCase() : element[i];
        spreadElements.push(value);

        // Verifies the field doesn't reference to uuid type value before adding lower
        where = do {
          if (isForeignKey(field)) {
            `${where} "${field}" = ? AND `;
          } else {
            `${where} lower("${field}") = ? AND `;
          }
        };
      } catch (error) {
        throw new SheetImportError({
          row: index + 2, // entities in sheets starts in the second row
          message: error.message,
          fieldValue: element[i],
        });
      }
    }

    where = where.substring(0, where.length - 4);
    where = `${where})`;
  });

  return await initQuery(ctx)
    .select([ID, ...fields])
    .from(tableName)
    .where(knex.raw(where, spreadElements));
};

/**
 * @param {string} schema
 * @param {string} table
 * @param {object} conditions is a map of KV pairs, where each key is a
 * column name. Value may either be a discrete value or an array of values.
 * The query will search all rows when the column is the discrete value, or in
 * the array of values.
 */
// eslint-disable-next-line red/dal-async
const buildBaseQuery = (schema, table, conditions = {}) => {
  // knex used as query builder
  const query = knex.withSchema(schema).from(table);

  Object.keys(conditions).forEach(key => {
    if (Array.isArray(conditions[key])) {
      query.whereIn(key, conditions[key]);
    } else {
      query.where(key, conditions[key]);
    }
  });

  return query;
};

/**
 * @param {string} schema
 * @param {string} table
 * @param {object} conditions is a map of KV pairs, where each key is a
 * column name. Value may either be a discrete value or an array of values.
 * The query will search all rows when the column is the discrete value, or in
 * the array of values.
 * @returns {number}
 *
 * Ex:
 * await countRowsMatchingConditions({
 *  schema: 'a schema',
 *  table: 'a table',
 *  conditions: { foo: 1, bar: [1, 2, 3] },
 * })
 *
 */
export const countRowsMatchingConditions = async ({ schema, table, conditions }) => {
  const result = await buildBaseQuery(schema, table, conditions).count();
  return Array.isArray(result) && result.length ? +result[0].count : 0;
};

/**
 * @param {string} schema
 * @param {string} table
 * @param {object} conditions
 * @param {string[]} columns
 * @returns {Promise}
 */
export const getRowsMatchingConditions = ({ schema, table, conditions = {}, columns = [] }) => buildBaseQuery(schema, table, conditions).select(columns);
