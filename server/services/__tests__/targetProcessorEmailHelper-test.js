/*
 * Copyright (c) 2022 Reva Technology Inc., all rights reserved.
 * Unauthorized copying of this file, via any medium is strictly prohibited
 * Licensed under the Elastic License 2.0; you may not use this file except
 * in compliance with the Elastic License 2.0.
 */

import { expect } from 'chai';
import { getRelevantEmailAddresses } from '../routing/targetProcessorEmailHelper';

const ctx = { tenantId: '56408e0b-cf93-4b7a-93d9-d7d3725ac83b' };

describe('when filtering out irrelevant target addresses for incoming emails', () => {
  describe('getRelevantEmailAddresses', () => {
    describe('for a list of correct Reva email addresses', () => {
      it('should return the entire list', () => {
        const inputAddresses = ['han.solo@maximus.reva.tech', 'leia.organa@maximus.reva.tech', 'c6e4e7e1cd5340ef9995@red.local.envmail.reva.tech'];
        const { emailsExceptNoReplys: filteredAddresses } = getRelevantEmailAddresses(ctx, inputAddresses);

        expect(filteredAddresses).to.deep.equal(inputAddresses);
      });
    });

    describe('for an empty list', () => {
      it('should return an empty list', () => {
        const inputAddresses = [];

        const { emailsExceptNoReplys: filteredAddresses } = getRelevantEmailAddresses(ctx, inputAddresses);

        expect(filteredAddresses).to.deep.equal([]);
      });
    });

    describe('for a list with some noreply addresses', () => {
      it('should filter out all the noreply addresses', () => {
        const relevantAddresses = ['han.solo@maximus.reva.tech', 'c6e4e7e1cd5340ef9995@red.local.envmail.reva.tech'];
        const irrelevantAddresses = ['noreply@reva.tech', 'no-reply@reva.tech', 'mailer-daemon@reva.tech'];

        const { emailsExceptNoReplys: filteredAddresses } = getRelevantEmailAddresses(ctx, irrelevantAddresses.concat(relevantAddresses));

        expect(filteredAddresses).to.deep.equal(relevantAddresses);
      });
    });

    describe('for a list with addresses from different domains than reva.tech', () => {
      it('should return only the Reva addresses', () => {
        const relevantAddresses = ['han.solo@maximus.reva.tech', 'c6e4e7e1cd5340ef9995@red.local.envmail.reva.tech'];
        const irrelevantAddresses = ['vader.darth@darkmail.emp', 'admiral.akbar@itsa.trap', 'count.dookoo@sw.com'];

        const { emailsExceptNoReplys: filteredAddresses } = getRelevantEmailAddresses(ctx, irrelevantAddresses.concat(relevantAddresses));

        expect(filteredAddresses).to.deep.equal(relevantAddresses);
      });
    });
  });
});
