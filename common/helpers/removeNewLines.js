/*
 * Copyright (c) 2022 Reva Technology Inc., all rights reserved.
 * Unauthorized copying of this file, via any medium is strictly prohibited
 * Licensed under the Elastic License 2.0; you may not use this file except
 * in compliance with the Elastic License 2.0.
 */

import findIndex from 'lodash/findIndex';
import findLastIndex from 'lodash/findLastIndex';

const removeNewLines = str => {
  const stringSplit = str.split('\n');
  const firstElement = findIndex(stringSplit, element => element.length > 0);
  const lastElement = findLastIndex(stringSplit, element => element.length > 0);
  const slicedStringElements = stringSplit.slice(firstElement, lastElement + 1);

  return slicedStringElements.join('\n');
};

export default removeNewLines;
