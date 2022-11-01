/*
 * Copyright (c) 2022 Reva Technology Inc., all rights reserved.
 * Unauthorized copying of this file, via any medium is strictly prohibited
 * Licensed under the Elastic License 2.0; you may not use this file except
 * in compliance with the Elastic License 2.0.
 */

import getFieldValue from 'helpers/get-field-value';
import clsc from 'helpers/coalescy';
import { window } from '../../common/helpers/globals';

/**
 * Returns a value of a given key of the `window.__appData` object. If the value does not exists or is null, the default
 * value passed as the second argument will be returned
 *
 * @method cfg
 * @param key {String} the key to look for in pData. It can contain a deep path, like 'modules.console.enabled'.
 * This will get the value from the object `window.__appData.modules.console.enabled`. If any of the properties does not
 * exists it will return the default value given.
 * @param defaultValue {Mixed} the default value to return in case the key does not exist or is null
 * @returns {Mixed} the value of the key or the default value
 */
export default function cfg(key, defaultValue) {
  const pData = window.__appData || {};
  return clsc(getFieldValue(pData, key), defaultValue);
}
