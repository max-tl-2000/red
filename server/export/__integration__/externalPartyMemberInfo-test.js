/*
 * Copyright (c) 2022 Reva Technology Inc., all rights reserved.
 * Unauthorized copying of this file, via any medium is strictly prohibited
 * Licensed under the Elastic License 2.0; you may not use this file except
 * in compliance with the Elastic License 2.0.
 */

import { expect } from 'chai';
import request from 'supertest';
import app from '../../api/api';

import { createTestPartyData } from '../../testUtils/leaseTestHelper';
import { tenant } from '../../testUtils/setupTestGlobalContext';
import { getAuthHeader } from '../../testUtils/apiHelper';
import { createAPartyMember } from '../../testUtils/repoHelper';
import { insertExternalInfo, getAllExternalInfoByParty } from '../../dal/exportRepo';
import { DALTypes } from '../../../common/enums/DALTypes';

const ctx = { tenantId: tenant.id, authUser: {} };

describe('export/externalPartyMemberInfo', () => {
  describe('when a party was already exported', () => {
    let partyMember;
    let testPartyData;

    beforeEach(async () => {
      testPartyData = await createTestPartyData();
      partyMember = testPartyData.residents[0];

      await insertExternalInfo(ctx, {
        partyId: testPartyData.party.id,
        partyMemberId: partyMember.id,
        externalId: '100t',
        externalProspectId: '100p',
        propertyId: testPartyData.property.id,
      });
    });

    describe('and the only Resident is moved to Guarantors', () => {
      it('should archive the external info', async () => {
        const result = await request(app)
          .patch(`/parties/${testPartyData.party.id}/members/${partyMember.id}`)
          .set(getAuthHeader(tenant.id, testPartyData.user.id))
          .send({
            memberType: DALTypes.MemberType.GUARANTOR,
          });

        expect(result.statusCode).to.equal(200);

        const externalInfos = await getAllExternalInfoByParty(ctx, testPartyData.party.id);
        expect(externalInfos.length).to.equal(2);
        const externalInfo = externalInfos.find(e => e.endDate);

        expect(externalInfo).to.be.ok;
      });
    });
    describe('and the primarty member is moved to Guarantor but there is a second Resident in party', () => {
      it('should archive the external info for the Guarantor and set the Resident as new primary tenant', async () => {
        const resident = await createAPartyMember(testPartyData.party.id);
        const result = await request(app)
          .patch(`/parties/${testPartyData.party.id}/members/${partyMember.id}`)
          .set(getAuthHeader(tenant.id, testPartyData.user.id))
          .send({
            memberType: DALTypes.MemberType.GUARANTOR,
          });

        expect(result.statusCode).to.equal(200);

        const externalInfos = await getAllExternalInfoByParty(ctx, testPartyData.party.id);
        const guarantorExternalInfo = externalInfos.find(pm => pm.partyMemberId === partyMember.id);
        const residentExternalInfo = externalInfos.find(pm => pm.partyMemberId === resident.id);
        expect(externalInfos.length).to.equal(2);
        expect(guarantorExternalInfo.endDate).to.not.be.null;

        expect(residentExternalInfo.isPrimary).to.be.true;
      });
    });
  });
});
