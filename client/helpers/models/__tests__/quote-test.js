/*
 * Copyright (c) 2022 Reva Technology Inc., all rights reserved.
 * Unauthorized copying of this file, via any medium is strictly prohibited
 * Licensed under the Elastic License 2.0; you may not use this file except
 * in compliance with the Elastic License 2.0.
 */

import { expect } from 'chai';
import rawQuote from './rawQuote.json';
import { createQuoteFromRaw } from '../quote';
import { getCharges, getDepositRelativeAmountForSelectedLeaseTerms } from '../../quotes';
import { Charges } from '../../../../common/enums/quoteTypes';

describe('Quote model', () => {
  describe('When creating a new quote with selected lease terms and fees of type deposit', () => {
    it('should set the relative amount for each selected lease term length', () => {
      const model = createQuoteFromRaw(rawQuote);
      const oneTimeCharges = getCharges(model.additionalAndOneTimeCharges[0].fees, Charges.ONETIME);

      oneTimeCharges[0].fees
        .filter(fee => fee.visible)
        .forEach(fee => {
          const depositRelativeAmountForSelectedLeaseTerms = getDepositRelativeAmountForSelectedLeaseTerms(fee, model.selectedLeaseTermIds);
          expect(depositRelativeAmountForSelectedLeaseTerms.leaseTerms).to.have.lengthOf(3);
        });

      expect(model.selectedLeaseTermIds).to.have.lengthOf(3);
      expect(model.selectedLeaseTermIds).to.contain('c3963322-2b10-49e1-91c7-852bb10a2093');
      expect(model.selectedLeaseTermIds).to.contain('7ff28ac0-e7d0-4961-89a1-bbbaf98a9b2e');
      expect(model.selectedLeaseTermIds).to.contain('2f17c406-9c1b-4a52-b3d5-908565f39865');
    });
  });
});
