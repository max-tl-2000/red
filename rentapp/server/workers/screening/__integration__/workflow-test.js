/*
 * Copyright (c) 2022 Reva Technology Inc., all rights reserved.
 * Unauthorized copying of this file, via any medium is strictly prohibited
 * Licensed under the Elastic License 2.0; you may not use this file except
 * in compliance with the Elastic License 2.0.
 */

import chai from 'chai';
import chaiAsPromised from 'chai-as-promised';
import v4 from 'uuid/v4';
import { getUnpaidPartyMembers } from '../../../screening/screening-helper';
import { createAParty, createAPartyMember, createAQuote } from '../../../../../server/testUtils/repoHelper';
import { createAPersonApplication, createAPartyApplication } from '../../../test-utils/repo-helper.js';
import { tenant, chan, createResolverMatcher } from '../../../../../server/testUtils/setupTestGlobalContext';
import { setupConsumers } from '../../../../../server/workers/consumer';
import { waitFor } from '../../../../../server/testUtils/apiHelper';
import { performNextScreeningAction } from '../../../screening/workflow';
import { SCREENING_MESSAGE_TYPE } from '../../../../../server/helpers/message-constants';

chai.use(chaiAsPromised);
const { expect } = chai;

const context = { tenantId: tenant.id };

const setupQueueToWaitFor = async condition => {
  const { resolvers, promises } = waitFor([condition]);
  const matcher = createResolverMatcher(resolvers);
  await setupConsumers(chan(), matcher, ['screening']);
  return { task: promises[0] };
};

const createGetUnpaidPartyMembersData = async (partyMemberSettings, rentData = { rent: 200, leaseTermMonths: 12 }) => {
  const party = await createAParty(undefined, context);
  const partyApplication = await createAPartyApplication(party.id, undefined, {}, context.tenantId);
  const unpaidPartyMembersIds = [];
  const allPersonIds = [];

  await Promise.all(
    partyMemberSettings.map(async setting => {
      const partyMember = await createAPartyMember(party.id, undefined, context);
      if (setting.haveApplied) {
        await createAPersonApplication({ fullName: 'Test Name' }, partyMember.personId, party.id, partyApplication.id, setting.havePaid, context.tenantId);
        if (!setting.havePaid) {
          unpaidPartyMembersIds.push(partyMember.id);
        }
      } else {
        unpaidPartyMembersIds.push(partyMember.id);
      }
      allPersonIds.push(partyMember.personId);
      return partyMember;
    }),
  );
  const quote = await createAQuote(party.id, {
    publishedQuoteData: {
      additionalAndOneTimeCharges: {
        oneTimeCharges: [],
        additionalCharges: [],
      },
      publishDate: new Date(),
      leaseTerms: [
        {
          adjustedMarketRent: rentData.rent,
          termLength: rentData.leaseTermMonths,
        },
      ],
    },
  });

  return {
    partyId: party.id,
    unpaidPartyMembersIds,
    allPersonIds,
    partyApplicationId: partyApplication.id,
    quote,
  };
};

xdescribe('workflow', () => {
  describe('getUnpaidPartyMembers: should compute if all party members have paid', () => {
    it('returns an empty array if all party members have paid', async () => {
      const { partyId } = await createGetUnpaidPartyMembersData([
        {
          havePaid: true,
          haveApplied: true,
        },
        {
          havePaid: true,
          haveApplied: true,
        },
        {
          havePaid: true,
          haveApplied: true,
        },
      ]);

      const unpaidPartyMembers = await getUnpaidPartyMembers(context, partyId);
      expect(unpaidPartyMembers).to.be.empty;
    });

    it('returns an array with the party members that have not paid', async () => {
      const { partyId, unpaidPartyMembersIds } = await createGetUnpaidPartyMembersData([
        {
          havePaid: true,
          haveApplied: true,
        },
        {
          havePaid: false,
          haveApplied: true,
        },
        {
          havePaid: false,
          haveApplied: true,
        },
      ]);

      const unpaidPartyMembers = await getUnpaidPartyMembers(context, partyId);
      expect(unpaidPartyMembers.length).to.eql(2);
      expect(unpaidPartyMembers.map(x => x.id).sort()).to.eql(unpaidPartyMembersIds.sort());
    });

    it('returns an array with the party members that did not apply', async () => {
      const { partyId, unpaidPartyMembersIds } = await createGetUnpaidPartyMembersData([
        {
          havePaid: true,
          haveApplied: true,
        },
        {
          havePaid: false,
          haveApplied: false,
        },
        {
          havePaid: false,
          haveApplied: false,
        },
      ]);

      const unpaidPartyMembers = await getUnpaidPartyMembers(context, partyId);
      expect(unpaidPartyMembers.length).to.eql(2);
      expect(unpaidPartyMembers.map(x => x.id).sort()).to.eql(unpaidPartyMembersIds.sort());
    });

    it('rejects if tenantId or partyId unset', async () => {
      expect(getUnpaidPartyMembers(context, null)).to.be.rejected;

      // in theory, this return should not be needed, since this method is async and mocha should await any such function.  However, in testing, if I did not "return" the expect, then an uncaught rejection was logged...
      return expect(getUnpaidPartyMembers(null, 'somePartyId')).to.be.rejected;
    });
  });

  describe('performNextScreeningAction: should send a message to the queue depending of the message', () => {
    it('sends a message to the queue if party members had change and all party members have paid', async () => {
      const { partyId } = await createGetUnpaidPartyMembersData([
        {
          havePaid: true,
          haveApplied: true,
        },
      ]);

      let receivedMsg;
      const { task } = await setupQueueToWaitFor([
        msg => {
          receivedMsg = msg;
          return !!msg;
        },
      ]);
      const ctx = { tenantId: context.tenantId };
      await performNextScreeningAction(ctx, { tenantId: context.tenantId, partyId }, { eventType: SCREENING_MESSAGE_TYPE.PARTY_MEMBERS_CHANGED });
      await task;

      expect(receivedMsg.partyId).to.equal(partyId);
    });

    it('sends a message to the queue if a quote was published and all party members have paid', async () => {
      const rentData = {
        deposit: 0,
        leaseTermMonths: 12,
        rent: 4000,
      };
      const { partyId } = await createGetUnpaidPartyMembersData(
        [
          {
            havePaid: true,
            haveApplied: true,
          },
        ],
        rentData,
      );

      let receivedMsg;
      const { task } = await setupQueueToWaitFor([
        msg => {
          receivedMsg = msg;
          return !!msg;
        },
      ]);
      const ctx = { tenantId: context.tenantId };

      const quoteId = v4();
      await performNextScreeningAction(
        ctx,
        {
          tenantId: context.tenantId,
          partyId,
          quoteId,
        },
        { eventType: SCREENING_MESSAGE_TYPE.QUOTE_PUBLISHED },
      );
      await task;

      expect(receivedMsg.partyId).to.equal(partyId);
      expect(receivedMsg.rentData).to.eql(rentData);
    });

    // Disabling this test as it is failing quite too often
    xit('sends a message to the queue if the applicant data was updated and all party members have paid', async () => {
      const { partyId } = await createGetUnpaidPartyMembersData([
        {
          havePaid: true,
          haveApplied: true,
        },
      ]);

      let receivedMsg;
      const { task } = await setupQueueToWaitFor([
        msg => {
          receivedMsg = msg;
          return !!msg;
        },
      ]);
      const ctx = { tenantId: context.tenantId };

      await performNextScreeningAction(ctx, { tenantId: context.tenantId, partyId }, { eventType: SCREENING_MESSAGE_TYPE.APPLICANT_DATA_UPDATED });
      await task;

      expect(receivedMsg.partyId).to.equal(partyId);
    });
  });
});
