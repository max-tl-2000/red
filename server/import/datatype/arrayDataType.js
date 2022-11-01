/*
 * Copyright (c) 2022 Reva Technology Inc., all rights reserved.
 * Unauthorized copying of this file, via any medium is strictly prohibited
 * Licensed under the Elastic License 2.0; you may not use this file except
 * in compliance with the Elastic License 2.0.
 */

import DataType from './dataType';

export default class ArrayDataType extends DataType {
  getParsedValue(cellValue) {
    const arrString = `${cellValue}`.split(',').filter(item => Number.isInteger(parseInt(item, 10)));
    return Array.from(arrString, item => parseInt(item, 10));
  }
}
