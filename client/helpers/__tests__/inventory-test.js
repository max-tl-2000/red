/*
 * Copyright (c) 2022 Reva Technology Inc., all rights reserved.
 * Unauthorized copying of this file, via any medium is strictly prohibited
 * Licensed under the Elastic License 2.0; you may not use this file except
 * in compliance with the Elastic License 2.0.
 */

import { expect } from 'test-helpers';
import { t } from 'i18next';
import { formatNumBedrooms } from '../../../common/helpers/inventory';

describe('Inventory helper', () => {
  describe('When the inventory has 0 bedroom', () => {
    it('should return "Studio"', () => {
      const result = formatNumBedrooms(0);
      expect(result).to.equal(t('STUDIO'));
    });
  });

  describe('When the inventory has 2 bedrooms', () => {
    it('should return the number of bedrooms formatted', () => {
      const numBedrooms = 2;
      const result = formatNumBedrooms(numBedrooms);
      expect(result).to.equal(t('QUOTE_DRAFT_NUM_BEDS', { count: numBedrooms }));
    });
  });
});
