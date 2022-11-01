/*
 * Copyright (c) 2022 Reva Technology Inc., all rights reserved.
 * Unauthorized copying of this file, via any medium is strictly prohibited
 * Licensed under the Elastic License 2.0; you may not use this file except
 * in compliance with the Elastic License 2.0.
 */

import { nonNullishProps } from '../assert';
import { toHumanReadableString } from '../helpers/strings';

describe('Assert', () => {
  describe('nonNullishProps', () => {
    [
      {
        firstName: 'John',
        address: {
          city: 'Mira Loma',
        },
        missinProperties: ['lastName'],
      },
      {
        firstName: 'John',
        lastName: null,
        address: {
          city: 'Mira Loma',
        },
        missinProperties: ['lastName'],
      },
      {
        lastName: 'Doe',
        address: {
          city: 'Mira Loma',
        },
        missinProperties: ['firstName'],
      },
      {
        firstName: 'John',
        missinProperties: ['lastName', 'address.city'],
      },
    ].forEach(({ missinProperties, ...data }) => {
      const invalidProperties = toHumanReadableString(missinProperties);
      it(`Should throw an error due to missing ${invalidProperties} property`, () => {
        expect(() => nonNullishProps(data, ['firstName', 'lastName', 'address.city'])).toThrow(`Invalid or missing value for ${invalidProperties}`);
      });
    });

    [
      {
        firstName: 'John',
        lastName: '',
        address: {
          city: 'Mira Loma',
        },
      },
      {
        firstName: 'John',
        lastName: 'Doe',
        address: {
          city: 'Mira Loma',
        },
      },
    ].forEach(data => {
      it('Should not throw an error, all required properties are available', () => {
        const result = nonNullishProps(data, ['firstName', 'lastName', 'address.city']);
        expect(result).toEqual(true);
      });
    });
  });
});
