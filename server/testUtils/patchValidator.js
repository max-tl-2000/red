/*
 * Copyright (c) 2022 Reva Technology Inc., all rights reserved.
 * Unauthorized copying of this file, via any medium is strictly prohibited
 * Licensed under the Elastic License 2.0; you may not use this file except
 * in compliance with the Elastic License 2.0.
 */

// eslint-disable-next-line red/no-lodash
import { isArray, isDate, pick, keys, isEmpty } from 'lodash';

import { toMoment } from '../../common/helpers/moment-utils';

function getDelta(prevState, nextState) {
  function valueHasChanged(key) {
    const prevValue = prevState[key];
    const newValue = nextState[key];

    if (isArray(prevValue)) {
      return JSON.stringify(prevValue) !== JSON.stringify(newValue);
    }
    if (isDate(prevValue)) return !toMoment(prevValue).isSame(newValue);
    return prevValue !== newValue;
  }

  return {
    ...pick(nextState, keys(nextState).filter(valueHasChanged)),
  };
}

export function validate(prevState, nextState, updatedFields) {
  const statesDelta = getDelta(prevState, nextState);

  return isEmpty(getDelta(statesDelta, updatedFields));
}
