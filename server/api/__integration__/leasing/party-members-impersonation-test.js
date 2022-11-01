/*
 * Copyright (c) 2022 Reva Technology Inc., all rights reserved.
 * Unauthorized copying of this file, via any medium is strictly prohibited
 * Licensed under the Elastic License 2.0; you may not use this file except
 * in compliance with the Elastic License 2.0.
 */

import request from 'supertest';
import { expect } from 'chai';
import newId from 'uuid/v4';
import app from '../../api';
import { getAuthHeader } from '../../../testUtils/apiHelper';
import { createAParty, createAPartyMember, createAUser, createAPerson, createAProperty } from '../../../testUtils/repoHelper';
import '../../../testUtils/setupTestGlobalContext';
import { tenant } from '../../../testUtils/test-tenant';
import { DALTypes } from '../../../../common/enums/DALTypes';
import { decodeJWTToken } from '../../../../common/server/jwt-helpers';
import { ScreeningVersion } from '../../../../common/enums/screeningReportTypes';

describe('API/parties', () => {
  describe('given a request to get a impersonation token', () => {
    let inputData = {};
    beforeEach(async () => {
      const user = await createAUser();
      const party = await createAParty({ userId: user.id });
      const person = await createAPerson('George Harrison', 'George H.');
      const partyMember = await createAPartyMember(party.id, {
        memberType: DALTypes.MemberType.RESIDENT,
        personId: person.id,
      });

      const property = await createAProperty({});
      inputData = { user, party, partyMember, property };
    });

    it('should respond with an impersonation token', async () => {
      const { user, party, partyMember, property } = inputData;
      const tenantId = tenant.id;
      await request(app)
        .post(`/parties/${party.id}/members/${partyMember.id}/proxyToken`)
        .send({ propertyId: property.id })
        .set(getAuthHeader(tenantId, user.id))
        .expect(200)
        .expect(response => {
          const expectedToken = {
            tenantId,
            personId: partyMember.personId,
            personName: partyMember.preferredName,
            partyId: party.id,
            propertyId: property.id,
            impersonatorUserId: user.id,
            screeningVersion: ScreeningVersion.V1,
          };

          const tokenInfo = decodeJWTToken(response.body);
          const { tenantDomain, iat, exp, ...rest } = tokenInfo;
          expect(tenantDomain).is.not.undefined;
          expect(iat).is.not.undefined;
          expect(exp).is.not.undefined;
          expect({ ...rest }).to.deep.equal(expectedToken);
        });
    });

    it('should respond with a 404 status code and PROPERTY_NOT_FOUND token', async () => {
      const { user, party, partyMember } = inputData;
      await request(app)
        .post(`/parties/${party.id}/members/${partyMember.id}/proxyToken`)
        .send({ propertyId: newId() })
        .set(getAuthHeader(tenant.id, user.id))
        .expect(404)
        .expect(response => expect(response.body.token).to.equal('PROPERTY_NOT_FOUND'));
    });

    // TODO: make sure that access to this API is secure, since it provides access to sensitive applicant information...
    // we want to make sure that an agent isn't able to access the applicant info if they hack the inputs the the proxyToken API
  });
});
