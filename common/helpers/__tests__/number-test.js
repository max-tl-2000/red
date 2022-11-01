/*
 * Copyright (c) 2022 Reva Technology Inc., all rights reserved.
 * Unauthorized copying of this file, via any medium is strictly prohibited
 * Licensed under the Elastic License 2.0; you may not use this file except
 * in compliance with the Elastic License 2.0.
 */

import { getHumanRep, getMinValue } from '../number';

describe('number', () => {
  describe('getHumanRep', () => {
    it('should format a decimal to have exactly 1 decimal digit when the 1st digit is significant', () => {
      expect(getHumanRep(10.1134)).toEqual('10.1');
    });

    it('should include as many decimal places as needed to show the first significative value', () => {
      expect(getHumanRep(10.0001)).toEqual('10.0001');
    });

    it('should include as many decimal places as needed to show the first significative value but no more than maxDecimals', () => {
      expect(getHumanRep(10.0001, { maxDecimals: 2 })).toEqual('10.00');
    });

    it('should show 0 as 0 and not 0.0', () => {
      expect(getHumanRep(0)).toEqual('0');
    });

    it('should just ignore NaN', () => {
      expect(getHumanRep(NaN)).toEqual('');
    });

    it('should just ignore null', () => {
      expect(getHumanRep(null)).toEqual('');
    });

    it('should ignore undefined', () => {
      expect(getHumanRep(undefined)).toEqual('');
    });

    it('should handle integers', () => {
      expect(getHumanRep(100)).toEqual('100.0');
    });

    it('should handle numbers without decimal parts but with a dot', () => {
      expect(getHumanRep('100.')).toEqual('100.0');
    });

    it('should handle numbers without integer parts but with a dot', () => {
      expect(getHumanRep('.123')).toEqual('0.1');
    });

    it('should handle Infinity', () => {
      expect(getHumanRep(Infinity)).toEqual('');
    });
  });

  describe('getMinValue', () => {
    [
      {
        values: [3, 4, null, undefined, '2f'],
        minValue: 3,
      },
      {
        values: [3, 4, null, undefined, '2'],
        minValue: 2,
      },
      {
        values: [3, 4, null, undefined, '2', 1],
        minValue: 1,
      },
      {
        values: [null, undefined, ''],
      },
      {
        values: [5],
        minValue: 5,
      },
    ].forEach(({ values, minValue }) => {
      describe(`given these ${values.join(', ')} values`, () => {
        it(`should return ${minValue} as min value`, () => {
          expect(getMinValue(...values)).toEqual(minValue);
        });
      });
    });
  });
});
