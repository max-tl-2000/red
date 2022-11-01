/*
 * Copyright (c) 2022 Reva Technology Inc., all rights reserved.
 * Unauthorized copying of this file, via any medium is strictly prohibited
 * Licensed under the Elastic License 2.0; you may not use this file except
 * in compliance with the Elastic License 2.0.
 */

import request from 'supertest';
import { expect } from 'chai';
import { getAuthHeader } from '../../../testUtils/apiHelper';
import app from '../../api';
import { createATeam, createAProperty, createAnExternalPhone } from '../../../testUtils/repoHelper';

describe('API GET /communications/phone/externalPhones', () => {
  it('should retrieve external phones for transferring a call', async () => {
    const { id: teamId } = await createATeam();
    const { id: propertyId, displayName: property } = await createAProperty();

    const externalPhone = await createAnExternalPhone({
      number: '12025550196',
      displayName: 'Resident Services',
      teamIds: [teamId],
      propertyId,
    });

    const { status, body } = await request(app).get('/communications/phone/externalPhones').set(getAuthHeader());

    expect(status).to.equal(200);
    expect(body.length).to.equal(1);

    expect(body[0].number).to.equal(externalPhone.number);
    expect(body[0].displayName).to.equal(externalPhone.displayName);
    expect(body[0].teamIds).to.deep.equal(externalPhone.teamIds);
    expect(body[0].property).to.equal(property);
  });
});
