/*
 * Copyright (c) 2022 Reva Technology Inc., all rights reserved.
 * Unauthorized copying of this file, via any medium is strictly prohibited
 * Licensed under the Elastic License 2.0; you may not use this file except
 * in compliance with the Elastic License 2.0.
 */

import { getPriceUsingFloorCeiling } from '../../../common/helpers/fee';
import { DALTypes } from '../../../common/enums/DALTypes';

describe('Given a call to getPriceUsingFloorCeiling function', () => {
  const { FLOOR, CEILING } = DALTypes.PriceFloorCeiling;
  it('should return 0 when priceFloorCeiling setting is disabled', () => {
    const price = getPriceUsingFloorCeiling({ absolutePrice: 0 });
    expect(price).toBe(0);
  });

  describe(`When priceFloorCeiling setting is set as '${FLOOR}', `, () => {
    const priceFloorCeiling = FLOOR;

    describe('absolutePrice is $2000, relativePrice is 10% and feeAmount is $10000', () => {
      it('should return $1000 as price', () => {
        const price = getPriceUsingFloorCeiling({ floorCeilingFlag: priceFloorCeiling, absolutePrice: 2000, relativePrice: 10, parentFeeAmount: 10000 });
        expect(price).toBe(1000);
      });
    });

    describe('absolutePrice is $2000 and priceRelativeToParent $1500', () => {
      it('should return $1500 as price', () => {
        const price = getPriceUsingFloorCeiling({ floorCeilingFlag: priceFloorCeiling, absolutePrice: 2000, priceRelativeToParent: 1500 });
        expect(price).toBe(1500);
      });
    });

    describe('absolutePrice is $1500, relativePrice is 50% and feeAmount is $5000', () => {
      it('should return $1500 as price', () => {
        const price = getPriceUsingFloorCeiling({ floorCeilingFlag: priceFloorCeiling, absolutePrice: 1500, relativePrice: 50, parentFeeAmount: 5000 });
        expect(price).toBe(1500);
      });
    });

    describe('absolutePrice is $2000 and priceRelativeToParent $2500', () => {
      it('should return $2000 as price', () => {
        const price = getPriceUsingFloorCeiling({ floorCeilingFlag: priceFloorCeiling, absolutePrice: 2000, priceRelativeToParent: 2500 });
        expect(price).toBe(2000);
      });
    });
  });

  describe(`When priceFloorCeiling setting is set as '${CEILING}', `, () => {
    const priceFloorCeiling = CEILING;

    describe('absolutePrice is $2000, relativePrice is 10% and feeAmount is $10000', () => {
      it('should return $2000 as price', () => {
        const price = getPriceUsingFloorCeiling({ floorCeilingFlag: priceFloorCeiling, absolutePrice: 2000, relativePrice: 10, parentFeeAmount: 10000 });
        expect(price).toBe(2000);
      });
    });

    describe('absolutePrice is $2000 and priceRelativeToParent $1500', () => {
      it('should return $2000 as price', () => {
        const price = getPriceUsingFloorCeiling({ floorCeilingFlag: priceFloorCeiling, absolutePrice: 2000, priceRelativeToParent: 1500 });
        expect(price).toBe(2000);
      });
    });

    describe('absolutePrice is $1500, relativePrice is 50% and feeAmount is $5000', () => {
      it('should return $2500 as price', () => {
        const price = getPriceUsingFloorCeiling({ floorCeilingFlag: priceFloorCeiling, absolutePrice: 1500, relativePrice: 50, parentFeeAmount: 5000 });
        expect(price).toBe(2500);
      });
    });

    describe('absolutePrice is $2000 and priceRelativeToParent $2500', () => {
      it('should return $2500 as price', () => {
        const price = getPriceUsingFloorCeiling({ floorCeilingFlag: priceFloorCeiling, absolutePrice: 2000, priceRelativeToParent: 2500 });
        expect(price).toBe(2500);
      });
    });
  });
});
