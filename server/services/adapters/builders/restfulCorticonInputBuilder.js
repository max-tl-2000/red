/*
 * Copyright (c) 2022 Reva Technology Inc., all rights reserved.
 * Unauthorized copying of this file, via any medium is strictly prohibited
 * Licensed under the Elastic License 2.0; you may not use this file except
 * in compliance with the Elastic License 2.0.
 */

import { isObject } from '../../../../common/helpers/type-of';

export class RestfulCorticonInputBuilder {
  addMetadata = input => {
    if (!isObject(input)) return input;
    Object.keys(input).forEach(key => {
      if (key !== '__metadata' && isObject(input[key])) {
        const uppercasedKey = `${key.charAt(0).toUpperCase()}${key.slice(1)}`;
        input[key].__metadata = {
          '#type': uppercasedKey,
          '#id': `${uppercasedKey}_id_1`,
        };
        this.addMetadata(input[key]);
      }
    });
    return input;
  };

  build = input => this.addMetadata(input);
}
