/*
 * Copyright (c) 2022 Reva Technology Inc., all rights reserved.
 * Unauthorized copying of this file, via any medium is strictly prohibited
 * Licensed under the Elastic License 2.0; you may not use this file except
 * in compliance with the Elastic License 2.0.
 */

/**
 * Converts csv row into excel one using mapping object
 *
 * @param {Object} row csv
 * @param {Object} excel headers
 * @param {Object} mapping object
 * @return {Object} return excel row
 */
export const converter = (row, excel, mapping) =>
  excel.map(e => {
    const mapper = mapping.find(m => m.excel === e);
    let item = '';
    if (mapper && mapper.csv) {
      item = row[mapper.csv];
    } else if (mapper && mapper.default) {
      item = mapper.default;
    } else if (mapper && typeof mapper.fn === 'function') {
      item = mapper.fn(row);
    }
    return item;
  });
