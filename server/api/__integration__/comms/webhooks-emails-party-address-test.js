/*
 * Copyright (c) 2022 Reva Technology Inc., all rights reserved.
 * Unauthorized copying of this file, via any medium is strictly prohibited
 * Licensed under the Elastic License 2.0; you may not use this file except
 * in compliance with the Elastic License 2.0.
 */

import request from 'supertest';
import { expect } from 'chai';
import getUUID from 'uuid/v4';
import config from '../../../config';
import app from '../../api';
import { tenant, chan, createResolverMatcher } from '../../../testUtils/setupTestGlobalContext';
import {
  testCtx as ctx,
  createAParty,
  createAPartyMember,
  createAPerson,
  createAUser,
  createATeam,
  createATeamMember,
  createAProperty,
  createASource,
} from '../../../testUtils/repoHelper';
import { saveContactInfo } from '../../../dal/contactInfoRepo';
import { setGetEmailDetailsFunction, setDeleteS3MailFunction } from '../../../workers/communication/inboundEmailHandler';
import { loadParties } from '../../../dal/partyRepo';
import { getAllComms } from '../../../dal/communicationRepo';
import { DALTypes } from '../../../../common/enums/DALTypes';
import { MainRoleDefinition, FunctionalRoleDefinition } from '../../../../common/acd/rolesDefinition';
import { waitFor } from '../../../testUtils/apiHelper';
import { setupConsumers } from '../../../workers/consumer';
import { partyWfStatesSubset } from '../../../../common/enums/partyTypes';

describe('/webhooks/email', () => {
  describe('when receiving an email for a party unique address', () => {
    const postEmailUrl = `/webhooks/email?api-token=${config.tokens.api}`;
    let user;
    let team;
    let person;

    const messageId = getUUID().toString();
    const mailData = { Bucket: 'test', Key: messageId };
    const fromEmail = 'rhaenys@test.com';

    const getEmailData = toAddress => ({
      event: 'inbound',
      msg: {
        emails: [`${toAddress}@${tenant.name}.${config.mail.emailDomain}`],
        from_email: fromEmail,
        from_name: 'rhaenys',
        text: 'quertyiop',
        subject: 'querty',
        messageId,
      },
    });

    const sendEmail = () => request(app).post(postEmailUrl).send(mailData).expect(200);

    const createParty = extraFields =>
      createAParty({
        userId: user.id,
        teams: [team.id],
        ownerTeam: team.id,
        ...extraFields,
      });

    beforeEach(async () => {
      setDeleteS3MailFunction(() => true);
      user = await createAUser({
        ctx,
        name: 'Aegon',
        email: 'user1+test@test.com',
        status: DALTypes.UserStatus.AVAILABLE,
      });
      team = await createATeam({
        name: 'testTeam',
        module: 'leasing',
      });
      await createATeamMember({
        teamId: team.id,
        userId: user.id,
        roles: {
          mainRoles: [MainRoleDefinition.LA.name],
          functionalRoles: [FunctionalRoleDefinition.LD.name],
        },
      });

      person = await createAPerson();
      const contactInfos = [
        {
          type: 'email',
          value: fromEmail,
        },
      ];
      await saveContactInfo(ctx, contactInfos, person.id);
    });

    const setupMessageQueueForEmail = async (msgId, condition = (m, handlerSucceeded) => m.Key === msgId && handlerSucceeded) => {
      const { resolvers, promises } = waitFor([condition]);
      const matcher = createResolverMatcher(resolvers);
      await setupConsumers(chan(), matcher, ['mail']);

      return { task: Promise.all(promises) };
    };

    it('should assign that email only to that specific party, even if the sender is part of multiple parties', async () => {
      const firstParty = await createParty();
      await createAPartyMember(firstParty.id, { personId: person.id });

      const secondParty = await createParty();
      await createAPartyMember(secondParty.id, { personId: person.id });

      setGetEmailDetailsFunction(() => getEmailData(firstParty.emailIdentifier));

      const { task } = await setupMessageQueueForEmail(messageId);
      await sendEmail();

      const results = await task;
      results.forEach(x => expect(x).to.be.true);

      const parties = await loadParties(ctx);
      expect(parties.length).to.equal(2);
      const commEntries = await getAllComms(ctx);
      expect(commEntries).to.have.length(1);
      expect(commEntries[0].parties).to.deep.equal([firstParty.id]);
    });

    it('should create a new party member for that party, if the person is not already a member of the party', async () => {
      const party = await createParty();

      setGetEmailDetailsFunction(() => getEmailData(party.emailIdentifier));

      const { task } = await setupMessageQueueForEmail(messageId);
      await sendEmail();

      const results = await task;
      results.forEach(x => expect(x).to.be.true);

      const parties = await loadParties(ctx);
      expect(parties.length).to.equal(1);
      expect(parties[0].partyMembers.length).to.equal(1);
      expect(parties[0].partyMembers[0].contactInfo.defaultEmail).to.equal(fromEmail);
    });

    it('should not create a new party member for that party, if the person is already a member of the party', async () => {
      const party = await createParty();
      await createAPartyMember(party.id, { personId: person.id });

      setGetEmailDetailsFunction(() => getEmailData(party.emailIdentifier));

      const { task } = await setupMessageQueueForEmail(messageId);
      await sendEmail();

      const results = await task;
      results.forEach(x => expect(x).to.be.true);

      const parties = await loadParties(ctx);
      expect(parties.length).to.equal(1);
      expect(parties[0].partyMembers.length).to.equal(1);
      expect(parties[0].partyMembers[0].personId).to.equal(person.id);
    });

    it('should create a new party on the same property as the target party when the target party is marked as closed and the sender is not already a party member', async () => {
      const { id: propertyId } = await createAProperty();
      await createASource('transfer-agent', 'transfer-agent', '', 'Agent');
      const party = await createParty({ endDate: new Date('12-14-2015 10:00:00'), assignedPropertyId: propertyId });

      setGetEmailDetailsFunction(() => getEmailData(party.emailIdentifier));

      const { task } = await setupMessageQueueForEmail(messageId);
      await sendEmail();

      const results = await task;
      results.forEach(x => expect(x).to.be.true);

      const parties = await loadParties(ctx, partyWfStatesSubset.all);
      expect(parties.length).to.equal(2);

      const existingParty = parties.find(p => p.id === party.id);
      expect(existingParty.partyMembers.length).to.equal(0);

      const newParty = parties.find(p => p.id !== party.id);
      expect(newParty.partyMembers.length).to.equal(1);
      expect(newParty.assignedPropertyId).to.equal(propertyId);

      const commEntries = await getAllComms(ctx);
      expect(commEntries).to.have.length(1);
      expect(commEntries[0].parties).to.deep.equal([newParty.id]);
    });

    it('should not create a new party when the target party is marked as closed and the sender is already a party member', async () => {
      const party = await createParty({ endDate: new Date('12-14-2015 10:00:00') });
      await createAPartyMember(party.id, { personId: person.id });

      setGetEmailDetailsFunction(() => getEmailData(party.emailIdentifier));

      const { task } = await setupMessageQueueForEmail(messageId);
      await sendEmail();

      const results = await task;
      results.forEach(x => expect(x).to.be.true);

      const parties = await loadParties(ctx, partyWfStatesSubset.all);
      expect(parties.length).to.equal(1);
      expect(parties[0].partyMembers.length).to.equal(1);
    });

    it('should create a new party on the same property as the target party when the target party is in "Lease" state and the sender is not already a party member', async () => {
      const { id: propertyId } = await createAProperty();
      await createASource('transfer-agent', 'transfer-agent', '', 'Agent');
      const party = await createParty({ state: DALTypes.PartyStateType.LEASE, assignedPropertyId: propertyId });

      setGetEmailDetailsFunction(() => getEmailData(party.emailIdentifier));

      const { task } = await setupMessageQueueForEmail(messageId);
      await sendEmail();

      const results = await task;
      results.forEach(x => expect(x).to.be.true);

      const parties = await loadParties(ctx, partyWfStatesSubset.all);
      expect(parties.length).to.equal(2);

      const existingParty = parties.find(p => p.id === party.id);
      expect(existingParty.partyMembers.length).to.equal(0);

      const newParty = parties.find(p => p.id !== party.id);
      expect(newParty.partyMembers.length).to.equal(1);
      expect(newParty.assignedPropertyId).to.equal(propertyId);

      const commEntries = await getAllComms(ctx);
      expect(commEntries).to.have.length(1);
      expect(commEntries[0].parties).to.deep.equal([newParty.id]);
    });

    it('should not create a new party when the target party is in "Lease" state and the sender is already a party member', async () => {
      const party = await createParty({ state: DALTypes.PartyStateType.LEASE });
      await createAPartyMember(party.id, { personId: person.id });

      setGetEmailDetailsFunction(() => getEmailData(party.emailIdentifier));

      const { task } = await setupMessageQueueForEmail(messageId);
      await sendEmail();

      const results = await task;
      results.forEach(x => expect(x).to.be.true);

      const parties = await loadParties(ctx, partyWfStatesSubset.all);
      expect(parties.length).to.equal(1);
      expect(parties[0].partyMembers.length).to.equal(1);
    });

    it('should assign that email to the base party when the target party was merged', async () => {
      const baseParty = await createParty();
      await createAPartyMember(baseParty.id, { personId: person.id });

      const mergedParty = await createParty({ mergedWith: baseParty.id });
      await createAPartyMember(mergedParty.id, { personId: person.id });

      setGetEmailDetailsFunction(() => getEmailData(mergedParty.emailIdentifier));

      const { task } = await setupMessageQueueForEmail(messageId);
      await sendEmail();

      const results = await task;
      results.forEach(x => expect(x).to.be.true);

      const parties = await loadParties(ctx);
      expect(parties.length).to.equal(2);
      const commEntries = await getAllComms(ctx);
      expect(commEntries).to.have.length(1);
      expect(commEntries[0].parties).to.deep.equal([baseParty.id]);
    });
  });
});
