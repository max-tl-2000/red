/*
 * Copyright (c) 2022 Reva Technology Inc., all rights reserved.
 * Unauthorized copying of this file, via any medium is strictly prohibited
 * Licensed under the Elastic License 2.0; you may not use this file except
 * in compliance with the Elastic License 2.0.
 */

import newId from 'uuid/v4';
import { isNumber } from '../../common/helpers/number';

const UNAUTHORIZED_STATEMENTS = [
  ';',
  '(;)',
  'ALTER',
  'CREATE',
  'DELETE',
  'DELETETREE',
  'DROP',
  'EXEC(UTE){0,1}',
  'INSERT( +INTO){0,1}',
  'MERGE',
  'SELECT',
  'UNION',
  'UPDATE',
];

const escapeValue = value =>
  `${value}`
    .replace(/[\\"']/g, '\\$&')
    .replace(/\u0000/g, '\\0')
    .replace(new RegExp(UNAUTHORIZED_STATEMENTS.join('|'), 'g'), '');

const toVarcharValue = ({ value }) => (value !== undefined ? `'${escapeValue(value)}'` : 'NULL');
const toNumericValue = ({ value }) => {
  if (!isNumber(value)) throw new Error(`${value} is not a number`);
  return `${value}`;
};
const toJsonValue = ({ value }) => `'${JSON.stringify(value)}'`;
const toUuidValue = () => `'${newId()}'`;

export const SqlValueConverter = {
  toVarcharValue,
  toNumericValue,
  toJsonValue,
  toUuidValue,
};

const formatColumnValues = values => `(${values})`;

const getColumnsToReplace = (firstColumn, isColumnAnArray) => {
  const columnsToReplace = ["'{0}'"];

  if (!isColumnAnArray) return columnsToReplace;

  for (let i = 1; i < firstColumn.length; i++) {
    columnsToReplace.push(`"'{${i}}'"`);
  }
  return columnsToReplace;
};

export const formatColumnsToSelect = ({ columns, format }) => {
  if (!columns) return '';

  if (format) return columns.map(column => format.replace('{0}', column)).join(',');

  const firstColumn = columns[0];
  const isColumnAnArray = Array.isArray(firstColumn);
  const columnsToReplace = getColumnsToReplace(firstColumn, isColumnAnArray);

  const joinedValues = columnsToReplace.join(',');
  const formattedColumnValues = formatColumnValues(joinedValues);
  const formatColumn = column => (isColumnAnArray ? column.map(c => `'${c}'`) : `'${column}'`);

  return columns.map(column => formattedColumnValues.replace(joinedValues, formatColumn(column))).join(',');
};

// This function sets the required PostgreSQL format
export const formatValuesToInsert = (entity, { columns, columnsTypeMapping, options }) =>
  columns
    .map(column => {
      const convertToType = columnsTypeMapping[column];
      const value = entity[column];

      return convertToType({ value, options });
    })
    .join(',');

/* This function formats the values from an entities array into a PostgreSQL Multiple Insert
   The estimated insertion time for 1000 rows is: 1.17 - 1.5 seconds
*/
export const formatValuesToMultipleInsert = (entities, rules) => entities.map(entity => `(${formatValuesToInsert(entity, rules)})`).join(',');

export const createCteFromArray = (array, cteName = 'cte_array', columnsNames = ['id'], cast) => `WITH "${cteName}" AS(
  SELECT ${cast ? columnsNames.map(cn => `"${cn}"::${cast}`).join(',') : '*'} FROM (VALUES ${formatColumnsToSelect({
  columns: array,
})}) AS t (${columnsNames.map(cn => `"${cn}"`).join(',')})
`;

export const createJsonCteFromQuery = ({ query, cteName = 'cte', jsonName = 'json', isFirstCte = true }) => {
  const withStatment = isFirstCte ? 'WITH' : '';
  return `${withStatment} "${cteName}" AS (
    SELECT array_to_json(array_agg(row_to_json(t))) as "${jsonName}"
    FROM (${query}) as t
  )`;
};
