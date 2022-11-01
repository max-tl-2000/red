/*
 * Copyright (c) 2022 Reva Technology Inc., all rights reserved.
 * Unauthorized copying of this file, via any medium is strictly prohibited
 * Licensed under the Elastic License 2.0; you may not use this file except
 * in compliance with the Elastic License 2.0.
 */

import nullish from './nullish';

export default function getFieldValue(element, fieldName) {
  if (nullish(fieldName) || nullish(element)) return null;

  if (fieldName.indexOf('.') > -1) {
    let aux = element;
    const attributesChain = fieldName.split('.');
    for (let i = 0; i < attributesChain.length; i++) {
      aux = aux[attributesChain[i]];

      if (typeof aux === 'undefined') {
        return undefined;
      }
      if (aux === null) {
        return null;
      }
    }
    return aux;
  }

  return element[fieldName];
}
