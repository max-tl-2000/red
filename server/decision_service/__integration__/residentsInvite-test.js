/*
 * Copyright (c) 2022 Reva Technology Inc., all rights reserved.
 * Unauthorized copying of this file, via any medium is strictly prohibited
 * Licensed under the Elastic License 2.0; you may not use this file except
 * in compliance with the Elastic License 2.0.
 */

import newId from 'uuid/v4';
import path from 'path';
import { expect } from 'chai';
import { processResidentsInviteEmail } from '../emails/residentsInviteHandler';
import { DALTypes } from '../../../common/enums/DALTypes';
import { readJSON } from '../../../common/helpers/xfs';
import { tenant } from '../../testUtils/setupTestGlobalContext';
import { insertOrUpdateLastAccessedProperty } from '../../../resident/server/dal/property-repo';
import { insertPersonMapping, insertCommonUser } from '../../../auth/server/dal/common-user-repo';

describe('emailHandler/processResidentsInviteEmail', () => {
  const partyId = newId();
  let party = { id: partyId };
  const ctx = tenant;

  const filename = 'party-with-signed-lease.json';
  const file = path.join(__dirname, '../__tests__/data/residentsInvite', filename);

  const emailInfoKeys = ['actions', 'communicationCategory', 'context', 'partyId', 'personIds', 'propertyId', 'section', 'type'];

  describe('calling processResidentsInviteEmail', () => {
    beforeEach(async () => {
      party = await readJSON(file);
    });

    describe('and the invite is sent', () => {
      it('should contain all the keys', async () => {
        const result = await processResidentsInviteEmail(ctx, party);
        expect(result.emailInfo).to.have.all.keys(emailInfoKeys);
      });
    });

    describe('when no comm invite was sent', () => {
      it('should send the invite to all residents', async () => {
        const result = await processResidentsInviteEmail(ctx, party);
        expect(result.emailInfo).to.have.all.keys(emailInfoKeys);
        expect(result.emailInfo.personIds).to.have.lengthOf(2);
        const personIds = result.emailInfo.personIds;
        const members = party.members.filter(({ partyMember }) => !partyMember.endDate && personIds.includes(partyMember.personId));
        const membersType = members.map(({ partyMember }) => partyMember.memberType);
        expect(membersType).to.deep.equal([DALTypes.MemberType.RESIDENT, DALTypes.MemberType.RESIDENT]);
      });
    });

    describe('when comm invite was sent but the user did not access the app', () => {
      it('should send the invite to all residents', async () => {
        const members = party.members.filter(({ partyMember }) => !partyMember.endDate && partyMember.memberType === DALTypes.MemberType.RESIDENT);
        const personIds = members.map(({ partyMember }) => partyMember.personId);
        party.comms = [{ parties: [party.id], persons: personIds, category: DALTypes.CommunicationCategory.RESIDENT_INVITE }];

        const result = await processResidentsInviteEmail(ctx, party);
        expect(result.emailInfo).to.have.all.keys(emailInfoKeys);
        expect(result.emailInfo.personIds).to.have.lengthOf(2);
      });
    });

    describe('when comm invite was sent and the user accessed the app', () => {
      it('should send the invite to residents who did not access the app', async () => {
        const members = party.members.filter(({ partyMember }) => !partyMember.endDate && partyMember.memberType === DALTypes.MemberType.RESIDENT);
        const personIds = members.map(({ partyMember }) => partyMember.personId);
        party.comms = [{ parties: [party.id], persons: personIds, category: DALTypes.CommunicationCategory.RESIDENT_INVITE }];

        const commonUserId = await insertCommonUser(ctx, { fullName: 'Test', email: 'test@test.com' });
        await insertPersonMapping(ctx, personIds[0], commonUserId);
        await insertOrUpdateLastAccessedProperty(ctx, { commonUserId, propertyId: party.property[0].id });

        const result = await processResidentsInviteEmail(ctx, party);
        expect(result.emailInfo).to.have.all.keys(emailInfoKeys);
        expect(result.emailInfo.personIds).to.have.lengthOf(1);
      });
    });

    describe('when comm invite was sent and the user accessed the app from another property', () => {
      it('should send the invite to all residents who did not access the app from that property', async () => {
        const members = party.members.filter(({ partyMember }) => !partyMember.endDate && partyMember.memberType === DALTypes.MemberType.RESIDENT);
        const personIds = members.map(({ partyMember }) => partyMember.personId);
        party.comms = [{ parties: [party.id], persons: personIds, category: DALTypes.CommunicationCategory.RESIDENT_INVITE }];

        const commonUserId = await insertCommonUser(ctx, { fullName: 'Test', email: 'test@test.com' });
        await insertPersonMapping(ctx, personIds[0], commonUserId);
        await insertOrUpdateLastAccessedProperty(ctx, { commonUserId, propertyId: newId() });

        const result = await processResidentsInviteEmail(ctx, party);
        expect(result.emailInfo).to.have.all.keys(emailInfoKeys);
        expect(result.emailInfo.personIds).to.have.lengthOf(2);
      });
    });
  });
});
