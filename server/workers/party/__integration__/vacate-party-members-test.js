/*
 * Copyright (c) 2022 Reva Technology Inc., all rights reserved.
 * Unauthorized copying of this file, via any medium is strictly prohibited
 * Licensed under the Elastic License 2.0; you may not use this file except
 * in compliance with the Elastic License 2.0.
 */

import chai from 'chai';
import sinonChai from 'sinon-chai';
import { setupQueueToWaitFor } from '../../../testUtils/apiHelper';
import { createAParty, createAPartyMember, testCtx as ctx } from '../../../testUtils/repoHelper';
import { DALTypes } from '../../../../common/enums/DALTypes';
import { now } from '../../../../common/helpers/moment-utils';
import { getRecurringJobByName } from '../../../dal/jobsRepo';
import { APP_EXCHANGE, JOBS_MESSAGE_TYPE } from '../../../helpers/message-constants';
import { sendMessage } from '../../../services/pubsub';
import { loadPartyMemberByIds, updatePartyMember } from '../../../dal/partyRepo';
import { saveExternalPartyMemberInfo } from '../../../services/externalPartyMemberInfo';
import { getExternalInfoByPartyMemberId } from '../../../dal/exportRepo';

chai.use(sinonChai);
const expect = chai.expect;

describe('Vacate party members', () => {
  const callVacatePartyMembersJob = async () => {
    const { id: jobId } = await getRecurringJobByName(ctx, DALTypes.Jobs.VacatePartyMembers);
    const { task } = await setupQueueToWaitFor([msg => msg.jobId === jobId], ['jobs']);

    const message = {
      exchange: APP_EXCHANGE,
      key: JOBS_MESSAGE_TYPE.VACATE_PARTY_MEMBERS,
      message: { tenantId: ctx.tenantId, jobId },
      ctx,
    };

    await sendMessage(message);

    await task;
  };

  const setup = async (firstMember, secondMember = {}) => {
    const party = await createAParty({}, ctx, { createAssignedProperty: true });

    const { id: firstPartyMemberId } = await createAPartyMember(party.id);
    const firstPartyMember = await updatePartyMember(ctx, firstPartyMemberId, { endDate: firstMember.endDate, vacateDate: firstMember.vacateDate });
    const firstPartyMemberExternalInfo = await saveExternalPartyMemberInfo(ctx, {
      partyMemberId: firstPartyMemberId,
      partyId: party.id,
      externalId: '001',
      propertyId: party.assignedPropertyId,
      isPrimary: true,
    });

    const { id: secondPartyMemberId } = await createAPartyMember(party.id);
    const secondPartyMember = await updatePartyMember(ctx, secondPartyMemberId, { endDate: secondMember.endDate, vacateDate: secondMember.vacateDate });
    const secondPartyMemberExternalInfo = await saveExternalPartyMemberInfo(ctx, {
      partyMemberId: secondPartyMemberId,
      partyId: party.id,
      externalId: '002',
      propertyId: party.assignedPropertyId,
      isPrimary: true,
    });

    return { firstPartyMember, secondPartyMember, firstPartyMemberExternalInfo, secondPartyMemberExternalInfo };
  };

  describe('party member with end date and vacate date', () => {
    it('will not update the party member end date', async () => {
      const vacateDate = now().toISOString();
      const endDate = now().add(1, 'day').toISOString();

      const firstMember = { vacateDate, endDate };
      const { firstPartyMember } = await setup(firstMember);

      await callVacatePartyMembersJob();

      const [updatedMember] = await loadPartyMemberByIds(ctx, [firstPartyMember.id], { excludeInactive: false });
      expect(firstPartyMember.endDate).to.eql(updatedMember.endDate);
    });

    describe('one party member with vacate date in past and one party member with vacate date in future', () => {
      it('will set end date just for the party member with vacate date in past', async () => {
        const firstMember = { vacateDate: now().add(1, 'day') };
        const secondMember = { vacateDate: now().add(-1, 'day') };

        const { firstPartyMember, secondPartyMember } = await setup(firstMember, secondMember);
        await callVacatePartyMembersJob();

        const [updatedFirstMember] = await loadPartyMemberByIds(ctx, [firstPartyMember.id], { excludeInactive: false });
        const [updatedSecondMember] = await loadPartyMemberByIds(ctx, [secondPartyMember.id], { excludeInactive: false });

        const firstPartyMemberExternalInfo = await getExternalInfoByPartyMemberId(ctx, firstPartyMember.id);
        const secondPartyMemberExternalInfo = await getExternalInfoByPartyMemberId(ctx, secondPartyMember.id);

        expect(updatedFirstMember.endDate).to.equal.null;
        expect(firstPartyMemberExternalInfo.endDate).to.equal.null;

        expect(updatedSecondMember.endDate).to.eql(secondPartyMember.vacateDate);
        expect(secondPartyMemberExternalInfo.endDate).to.eql(secondPartyMember.vacateDate);
      });
    });
  });
});
