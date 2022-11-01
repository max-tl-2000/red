/*
 * Copyright (c) 2022 Reva Technology Inc., all rights reserved.
 * Unauthorized copying of this file, via any medium is strictly prohibited
 * Licensed under the Elastic License 2.0; you may not use this file except
 * in compliance with the Elastic License 2.0.
 */

import { expect } from 'chai';
import newId from 'uuid/v4';
import { ctx, createAPersonApplication } from '../../../test-utils/repo-helper';
import { createAParty, createAPartyMember } from '../../../../../server/testUtils/repoHelper';
import { updatePersonApplicationPaymentCompleted } from '../../../services/person-application';

describe('given Application payment scenarios using the handle Application Payment received', () => {
  it('should call handleApplicationPaymentReceived with valid parameters ', async () => {
    const party = await createAParty();
    const partyMember = await createAPartyMember(party.id);
    const personApplication = await createAPersonApplication({}, partyMember.personId, party.id, newId());

    const req = {
      tenantId: ctx.tenantId,
      personApplicationId: personApplication.id,
    };

    const result = await updatePersonApplicationPaymentCompleted(req, req.personApplicationId, true);

    expect(result.paymentCompleted).to.be.true;
  });
});
