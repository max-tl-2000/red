/*
 * Copyright (c) 2022 Reva Technology Inc., all rights reserved.
 * Unauthorized copying of this file, via any medium is strictly prohibited
 * Licensed under the Elastic License 2.0; you may not use this file except
 * in compliance with the Elastic License 2.0.
 */

import { removeEmptySpacesAndNonAlphanumeric } from '../utils';

describe('utils', () => {
  describe('removeEmptySpacesAndNonAlphanumeric', () => {
    [
      { string: 'Harry Potter', result: 'HarryPotter' },
      { string: "Harry Potter's", result: 'HarryPotters' },
      { string: 'Hárry Potter', result: 'HrryPotter' },
      { string: 'Harry', result: 'Harry' },
      { string: undefined, result: '' },
      { string: null, result: '' },
      { string: '', result: '' },
      { string: '123', result: '123' },
      { string: '[]~!@#$%^&*()+_][?¿', result: '' },
    ].forEach(({ string, result }) =>
      it('should replace empty spaces and non alphanumeric characters', () => {
        const val = removeEmptySpacesAndNonAlphanumeric(string);
        expect(val).toEqual(result);
      }),
    );
  });
});
