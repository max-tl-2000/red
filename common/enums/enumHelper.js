/*
 * Copyright (c) 2022 Reva Technology Inc., all rights reserved.
 * Unauthorized copying of this file, via any medium is strictly prohibited
 * Licensed under the Elastic License 2.0; you may not use this file except
 * in compliance with the Elastic License 2.0.
 */

import getUUID from 'uuid/v4';
import { t } from 'i18next';

export const OperationResultType = {
  SUCCESS: 'success',
  FAILED: 'failed',
};

export default function enumToArray(enumType) {
  return Object.keys(enumType).reduce((seq, key) => {
    seq.push({ id: getUUID(), value: enumType[key] });
    return seq;
  }, []);
}

export function getKeyByValue(object, value) {
  return Object.keys(object).find(key => object[key].toLowerCase() === value.toLowerCase());
}

export function enumToList(enumType) {
  return enumToArray(enumType).map(tf => ({ id: tf.value, text: t(tf.value) }));
}
