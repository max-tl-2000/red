/*
 * Copyright (c) 2022 Reva Technology Inc., all rights reserved.
 * Unauthorized copying of this file, via any medium is strictly prohibited
 * Licensed under the Elastic License 2.0; you may not use this file except
 * in compliance with the Elastic License 2.0.
 */

import request from 'supertest';
import { expect } from 'chai';
import Promise, { mapSeries } from 'bluebird';
import newId from 'uuid/v4';
import config from '../../../config';
import app from '../../api';
import { setupConsumers } from '../../../workers/consumer';
import { waitFor, setupQueueToWaitFor } from '../../../testUtils/apiHelper';
import { tenant, chan, createResolverMatcher } from '../../../testUtils/setupTestGlobalContext';
import {
  testCtx as ctx,
  createAUser,
  createATeam,
  createATeamMember,
  createAPerson,
  createAProperty,
  createAParty,
  createAPartyMember,
  createATeamProperty,
  createASource,
  createACommunicationEntry,
  createATeamPropertyProgram,
} from '../../../testUtils/repoHelper';
import { saveContactInfo } from '../../../dal/contactInfoRepo';
import { setGetEmailDetailsFunction, setDeleteS3MailFunction } from '../../../workers/communication/inboundEmailHandler';
import { loadParties, getPartyBy, getPartyMembersByPartyIds } from '../../../dal/partyRepo';
import { DALTypes } from '../../../../common/enums/DALTypes';

import { now } from '../../../../common/helpers/moment-utils';
import { archiveParty, closeParty } from '../../../services/party.js';
import { voidLease } from '../../../services/leases/leaseService';

import { partyWfStatesSubset } from '../../../../common/enums/partyTypes';
import { createNewLeaseParty, callProcessWorkflowsJob, setupMsgQueueAndWaitFor, createActiveLeaseParty } from '../../../testUtils/partyWorkflowTestHelper';
import { DATE_US_FORMAT } from '../../../../common/date-constants';
import { getPersons } from '../../../dal/personRepo';
import { getSubmittedOrExecutedLeaseByPartyId, getLeaseById } from '../../../dal/leaseRepo';
import { loadUserById } from '../../../services/users';
import { getCommunicationsByMessageId } from '../../../dal/communicationRepo';

describe('/webhooks/email', () => {
  describe('POST', () => {
    const postEmailUrl = `/webhooks/email?api-token=${config.tokens.api}`;

    const setupMessageQueueForEmail = async (msgId, condition = (m, handlerSucceeded) => m.Key === msgId && handlerSucceeded) => {
      const { resolvers, promises } = waitFor([condition]);
      const matcher = createResolverMatcher(resolvers);
      await setupConsumers(chan(), matcher, ['mail']);

      return { task: Promise.all(promises) };
    };

    describe('mail processing', () => {
      const getMailData = messageId => ({ Bucket: 'test', Key: messageId });
      const fromNewGuestEmail = 'rhaenys@reva.tech';
      let emailDetails;

      const getEmailDetails = (msgId, toAddress) => ({
        event: 'inbound',
        msg: {
          emails: [`${toAddress}@${tenant.name}.${config.mail.emailDomain}`],
          from_email: fromNewGuestEmail,
          from_name: 'reva agent',
          text: 'quertyiop',
          subject: 'querty',
          messageId: msgId,
        },
      });

      const setupExistingPartyDataForProperty = async (propertyId, userId, teams) => {
        const { id: personId } = await createAPerson('reva agent', 'reva agent');
        const contactInfos = [
          {
            type: 'email',
            value: fromNewGuestEmail,
          },
        ];
        await saveContactInfo(ctx, contactInfos, personId);

        const party = await createAParty({
          userId,
          teams,
          assignedPropertyId: propertyId,
          ownerTeam: teams[0],
        });
        await createAPartyMember(party.id, {
          personId,
        });
        return party;
      };

      const createAndSendMail = async (emailIdentifier, emailDetailsForRMQ) => {
        const messageId = newId().toString();
        const mailData = getMailData(messageId);

        emailDetails = emailDetailsForRMQ || getEmailDetails(messageId, emailIdentifier);
        setGetEmailDetailsFunction(() => emailDetails);

        const { task } = await setupMessageQueueForEmail(messageId);
        await request(app).post(postEmailUrl).send(mailData).expect(200);
        const results = await task;
        results.forEach(x => expect(x).to.be.true);
        return messageId;
      };

      const checkPersonLength = async personCount => {
        const persons = await getPersons(ctx);
        expect(persons.length).to.equal(personCount);
      };

      const checkPartyLength = async (length, subset) => {
        const parties = await loadParties(ctx, subset);
        expect(parties.length).to.equal(length);
      };

      const checkPartyMemberLength = async (partyId, length) => {
        const partyMembersAfter = await getPartyMembersByPartyIds(ctx, [partyId]);
        expect(partyMembersAfter.length).to.equal(length);
      };

      const checkCommForParty = async (partyId, messageId, length = 1) => {
        const comms = await getCommunicationsByMessageId(ctx, messageId);
        expect(comms.length).to.equal(1);
        const comm = comms[0];
        expect(comm.parties.length).to.equal(length);
        expect(comm.parties[0]).to.equal(partyId);
      };

      const checkCommNotInParties = async (parties, messageId, length = 1) => {
        const comms = await getCommunicationsByMessageId(ctx, messageId);
        expect(comms.length).to.equal(1);
        const comm = comms[0];
        const partyForComm = comm.parties[0];
        expect(comm.parties.length).to.equal(length);
        expect(parties).to.not.include(partyForComm);
      };

      const setupActiveLease = async () => {
        const leaseStartDate = now().add(-10, 'days').format(DATE_US_FORMAT);

        const leaseEndDate = now().add(1, 'days').format(DATE_US_FORMAT);

        const { activeLeaseParty } = await createActiveLeaseParty({ leaseStartDate, leaseEndDate });

        expect(activeLeaseParty).to.be.ok;

        return activeLeaseParty;
      };

      const setupNewPartyOnNewProperty = async (userId, teams) => {
        const newProperty = await createAProperty();
        await createATeamProperty(teams[0], newProperty.id);
        return await setupExistingPartyDataForProperty(newProperty.id, userId, teams);
      };

      const setupNewLeasePartyFromData = async activeLeaseParty => {
        const party = await createAParty({
          userId: activeLeaseParty.userId,
          teams: activeLeaseParty.teams,
          assignedPropertyId: activeLeaseParty.assignedPropertyId,
          ownerTeam: activeLeaseParty.ownerTeam,
          workflowName: DALTypes.WorkflowName.NEW_LEASE,
          workflowState: DALTypes.WorkflowState.ARCHIVED,
          partyGroupId: activeLeaseParty.partyGroupId,
          archiveDate: now().add(-10, 'days').toString(),
        });

        await mapSeries(activeLeaseParty.partyMembers, async partyMember => {
          await createAPartyMember(party.id, {
            personId: partyMember.personId,
            memberType: partyMember.memberType,
            memberState: partyMember.memberState,
            guaranteedBy: partyMember.guaranteedBy,
          });
        });

        return party;
      };

      beforeEach(async () => {
        setDeleteS3MailFunction(() => true);
        await setupMsgQueueAndWaitFor([], ['lease']);
        await createASource('transfer-agent', 'transfer-agent', '', 'Agent');
      });

      describe('given an existing new lease party with a publshed lease', async () => {
        const setupDataForNewLeaseParty = async () => {
          const leaseStartDate = now().add(10, 'days').format(DATE_US_FORMAT);
          await createNewLeaseParty({ leaseStartDate, shouldSignLease: false });
          await callProcessWorkflowsJob();

          const newLeaseParty = await getPartyBy(ctx, { workflowName: DALTypes.WorkflowName.NEW_LEASE });
          const activeLeaseParty = await getPartyBy(ctx, { workflowName: DALTypes.WorkflowName.ACTIVE_LEASE });
          const renewalLeaseParty = await getPartyBy(ctx, { workflowName: DALTypes.WorkflowName.RENEWAL });
          return { newLeaseParty, activeLeaseParty, renewalLeaseParty };
        };

        const expectOnlyNewLease = (newLeaseParty, activeLeaseParty, renewalLeaseParty) => {
          expect(newLeaseParty).to.be.ok;
          expect(activeLeaseParty).to.be.undefined;
          expect(renewalLeaseParty).to.be.undefined;
        };
        describe('when receiving a new email from an unknown originator', async () => {
          it('when the party is not closed should create a new party for the new user', async () => {
            const { newLeaseParty, activeLeaseParty, renewalLeaseParty } = await setupDataForNewLeaseParty();
            expectOnlyNewLease(newLeaseParty, activeLeaseParty, renewalLeaseParty);

            await checkPersonLength(2);
            await checkPartyMemberLength(newLeaseParty.id, 2);

            await createAndSendMail(newLeaseParty.emailIdentifier);

            await checkPartyLength(2);
            await checkPartyMemberLength(newLeaseParty.id, 2);
          });

          it('when the party is closed should create a new party for the new user', async () => {
            const { newLeaseParty, activeLeaseParty, renewalLeaseParty } = await setupDataForNewLeaseParty();
            expectOnlyNewLease(newLeaseParty, activeLeaseParty, renewalLeaseParty);

            await checkPersonLength(2);
            await checkPartyMemberLength(newLeaseParty.id, 2);

            const lease = await getSubmittedOrExecutedLeaseByPartyId(ctx, newLeaseParty.id);
            const authUser = await loadUserById(ctx, newLeaseParty.id);
            const newCtx = { ...ctx, authUser };

            await voidLease(newCtx, lease.id, true);
            // from the ui you cannot close a party until you void the lease, so having a lease or not should not be relevant at this point
            await closeParty({ ...ctx, authUser: { id: newLeaseParty.userId } }, newLeaseParty.id, DALTypes.ClosePartyReasons.NOT_INTERESTED);

            await createAndSendMail(newLeaseParty.emailIdentifier);

            await checkPartyLength(2, partyWfStatesSubset.all);
            await checkPartyMemberLength(newLeaseParty.id, 2);
          });
        });

        describe('when receiving a new email from an existing originator on the same property', async () => {
          it.skip("when the party is not closed should add the comm to his already existing oririnator's party", async () => {
            const { newLeaseParty, activeLeaseParty, renewalLeaseParty } = await setupDataForNewLeaseParty();
            expectOnlyNewLease(newLeaseParty, activeLeaseParty, renewalLeaseParty);

            const party = await setupExistingPartyDataForProperty(newLeaseParty.assignedPropertyId, newLeaseParty.userId, newLeaseParty.teams);

            await checkPersonLength(3);
            await checkPartyMemberLength(newLeaseParty.id, 2);
            await checkPartyMemberLength(party.id, 1);
            await checkPartyLength(2);

            const messageId = await createAndSendMail(newLeaseParty.emailIdentifier);

            await checkPersonLength(3);
            await checkPartyLength(2);
            await checkPartyMemberLength(newLeaseParty.id, 2);
            await checkPartyMemberLength(party.id, 1);

            await checkCommForParty(party.id, messageId);
          });

          it.skip('when the party is closed should create a new party for the new user', async () => {
            const { newLeaseParty, activeLeaseParty, renewalLeaseParty } = await setupDataForNewLeaseParty();
            expectOnlyNewLease(newLeaseParty, activeLeaseParty, renewalLeaseParty);

            const party = await setupExistingPartyDataForProperty(newLeaseParty.assignedPropertyId, newLeaseParty.userId, newLeaseParty.teams);

            await checkPersonLength(3);
            await checkPartyMemberLength(newLeaseParty.id, 2);
            await checkPartyMemberLength(party.id, 1);
            await checkPartyLength(2);

            const lease = await getSubmittedOrExecutedLeaseByPartyId(ctx, newLeaseParty.id);
            const authUser = await loadUserById(ctx, newLeaseParty.id);
            const newCtx = { ...ctx, authUser };

            await voidLease(newCtx, lease.id);
            // from the ui you cannot close a party until you void the lease, so having a lease or not should not be relevant at this point
            await closeParty({ ...ctx, authUser: { id: newLeaseParty.userId } }, newLeaseParty.id, DALTypes.ClosePartyReasons.NOT_INTERESTED);

            const messageId = await createAndSendMail(newLeaseParty.emailIdentifier);

            await checkPersonLength(3);
            await checkPartyLength(2);
            await checkPartyMemberLength(newLeaseParty.id, 2);
            await checkPartyMemberLength(party.id, 1);

            await checkCommForParty(party.id, messageId);
          });
        });

        describe('when receiving a new email from an existing originator on different property', async () => {
          it('when the party is not closed should create a new party', async () => {
            const { newLeaseParty, activeLeaseParty, renewalLeaseParty } = await setupDataForNewLeaseParty();
            expectOnlyNewLease(newLeaseParty, activeLeaseParty, renewalLeaseParty);

            const party = await setupNewPartyOnNewProperty(newLeaseParty.userId, newLeaseParty.teams);

            await checkPersonLength(3);
            await checkPartyMemberLength(newLeaseParty.id, 2);
            await checkPartyMemberLength(party.id, 1);
            await checkPartyLength(2);

            const messageId = await createAndSendMail(newLeaseParty.emailIdentifier);

            await checkPersonLength(3);
            await checkPartyLength(3);
            await checkPartyMemberLength(newLeaseParty.id, 2);
            await checkPartyMemberLength(party.id, 1);

            await checkCommNotInParties([party.id, newLeaseParty.id], messageId);
          });

          it('when the party is closed should create a new party for the new user', async () => {
            const { newLeaseParty, activeLeaseParty, renewalLeaseParty } = await setupDataForNewLeaseParty();
            expectOnlyNewLease(newLeaseParty, activeLeaseParty, renewalLeaseParty);

            const party = await setupNewPartyOnNewProperty(newLeaseParty.userId, newLeaseParty.teams);

            await checkPersonLength(3);
            await checkPartyMemberLength(newLeaseParty.id, 2);
            await checkPartyMemberLength(party.id, 1);
            await checkPartyLength(2);

            const lease = await getSubmittedOrExecutedLeaseByPartyId(ctx, newLeaseParty.id);
            const authUser = await loadUserById(ctx, newLeaseParty.id);
            const newCtx = { ...ctx, authUser };

            await voidLease(newCtx, lease.id);
            // from the ui you cannot close a party until you void the lease, so having a lease or not should not be relevant at this point
            await closeParty({ ...ctx, authUser: { id: newLeaseParty.userId } }, newLeaseParty.id, DALTypes.ClosePartyReasons.NOT_INTERESTED);

            const messageId = await createAndSendMail(newLeaseParty.emailIdentifier);

            await checkPersonLength(3);
            await checkPartyLength(3, partyWfStatesSubset.all);
            await checkPartyMemberLength(newLeaseParty.id, 2);
            await checkPartyMemberLength(party.id, 1);

            await checkCommNotInParties([party.id, newLeaseParty.id], messageId);
          });
        });
      });

      describe('given an existing new lease party without a lease', async () => {
        const createASimpleParty = async () => {
          const { id: personId } = await createAPerson();
          const contactInfos = [
            {
              type: 'email',
              value: 'john+doe@google.com',
              isSpam: false,
            },
          ];
          await saveContactInfo(ctx, contactInfos, personId);

          const property = await createAProperty();

          const user = await createAUser();
          const team = await createATeam();

          await createATeamMember({ ctx, teamId: team.id, userId: user.id });

          const party = await createAParty({
            userId: user.id,
            teams: [team.id],
            assignedPropertyId: property.id,
            ownerTeam: team.id,
          });
          await createAPartyMember(party.id, {
            personId,
          });
          return party;
        };
        describe('when receiving a new email from an unknown originator', async () => {
          it('when the party is not closed should add the user to the party', async () => {
            const baseParty = await createASimpleParty();

            await checkPersonLength(1);
            await checkPartyMemberLength(baseParty.id, 1);

            const messageId = await createAndSendMail(baseParty.emailIdentifier);

            await checkPartyLength(1);
            await checkPartyMemberLength(baseParty.id, 2);

            await checkCommForParty(baseParty.id, messageId);
          });
        });

        describe('when receiving a new email from an known originator with party on same property', async () => {
          it('when the party is not closed should add the user to the party', async () => {
            const baseParty = await createASimpleParty();
            const party = await setupExistingPartyDataForProperty(baseParty.assignedPropertyId, baseParty.userId, baseParty.teams);

            await checkPersonLength(2);
            await checkPartyMemberLength(baseParty.id, 1);
            await checkPartyMemberLength(party.id, 1);

            const messageId = await createAndSendMail(baseParty.emailIdentifier);

            await checkPartyLength(2);
            await checkPartyMemberLength(baseParty.id, 2);
            await checkPartyMemberLength(party.id, 1);

            await checkCommForParty(baseParty.id, messageId);
          });
        });

        describe('when receiving a new email from an known originator with party on different property', async () => {
          it('when the party is not closed should add the user to the party', async () => {
            const baseParty = await createASimpleParty();
            const party = await setupNewPartyOnNewProperty(baseParty.userId, baseParty.teams);

            await checkPersonLength(2);
            await checkPartyMemberLength(baseParty.id, 1);
            await checkPartyMemberLength(party.id, 1);

            const messageId = await createAndSendMail(baseParty.emailIdentifier);

            await checkPartyLength(2);
            await checkPartyMemberLength(baseParty.id, 2);
            await checkPartyMemberLength(party.id, 1);

            await checkCommForParty(baseParty.id, messageId);
          });
        });
      });

      describe('given a new lease and active lease party', async () => {
        const setupNewLeaseAndActiveLease = async () => {
          const leaseStartDate = now().add(-1, 'days').format(DATE_US_FORMAT);

          const leaseEndDate = now().add(100, 'days').format(DATE_US_FORMAT);

          const { leaseId } = await createNewLeaseParty({
            leaseStartDate,
            leaseEndDate,
            shouldSignLease: true,
            shouldCounterSignLease: true,
          });

          const lease = await getLeaseById(ctx, leaseId);
          expect(lease.status).to.equal(DALTypes.LeaseStatus.EXECUTED);

          await callProcessWorkflowsJob();

          const newLeaseParty = await getPartyBy(ctx, { workflowName: DALTypes.WorkflowName.NEW_LEASE });
          const activeLeaseParty = await getPartyBy(ctx, { workflowName: DALTypes.WorkflowName.ACTIVE_LEASE });
          const renewalParty = await getPartyBy(ctx, { workflowName: DALTypes.WorkflowName.RENEWAL });
          return { newLeaseParty, activeLeaseParty, renewalParty, lease };
        };

        const expectNewLeaseActiveLease = (newLeaseParty, activeLeaseParty, renewalLeaseParty) => {
          expect(newLeaseParty).to.be.ok;
          expect(activeLeaseParty).to.be.ok;
          expect(renewalLeaseParty).to.be.undefined;
        };
        describe('when receiving a new email from an unknown originator', async () => {
          describe('when the new lease is still active and the email contains the new lease party identifier', async () => {
            it('it should create a new party for the new user', async () => {
              const { newLeaseParty, activeLeaseParty, renewalParty } = await setupNewLeaseAndActiveLease();
              expectNewLeaseActiveLease(newLeaseParty, activeLeaseParty, renewalParty);

              await checkPersonLength(2);
              await checkPartyMemberLength(newLeaseParty.id, 2);
              await checkPartyMemberLength(activeLeaseParty.id, 2);

              await createAndSendMail(newLeaseParty.emailIdentifier);

              await checkPartyLength(3, partyWfStatesSubset.all);
              await checkPartyMemberLength(newLeaseParty.id, 2);
              await checkPartyMemberLength(activeLeaseParty.id, 2);
            });
          });

          describe('when the new lease is archived and the email contains the new lease party identifier', async () => {
            it('it should create a new party for the new user', async () => {
              const { newLeaseParty, activeLeaseParty, renewalParty } = await setupNewLeaseAndActiveLease();
              expectNewLeaseActiveLease(newLeaseParty, activeLeaseParty, renewalParty);
              await checkPersonLength(2);
              await checkPartyMemberLength(newLeaseParty.id, 2);
              await checkPartyMemberLength(activeLeaseParty.id, 2);

              const authUser = await createAUser();
              const newCtx = { ...ctx, authUser };

              const condition = payload => payload.partyId === newLeaseParty.id;

              const { task: task2 } = await setupQueueToWaitFor([condition], ['tasks']);

              await archiveParty(newCtx, { partyId: newLeaseParty.id, archiveReasonId: DALTypes.ArchivePartyReasons.RESIDENT_CREATED });

              await task2;

              await createAndSendMail(newLeaseParty.emailIdentifier);

              await checkPartyLength(3, partyWfStatesSubset.all);
              await checkPartyMemberLength(newLeaseParty.id, 2);
              await checkPartyMemberLength(activeLeaseParty.id, 2);
            });
          });

          describe('when the new lease is archived and the email contains the active lease party identifier', async () => {
            it('it should create a new party for the new user', async () => {
              const { newLeaseParty, activeLeaseParty, renewalParty } = await setupNewLeaseAndActiveLease();
              expectNewLeaseActiveLease(newLeaseParty, activeLeaseParty, renewalParty);

              await checkPersonLength(2);
              await checkPartyMemberLength(newLeaseParty.id, 2);
              await checkPartyMemberLength(activeLeaseParty.id, 2);

              const authUser = await createAUser();
              const newCtx = { ...ctx, authUser };

              const condition = payload => payload.partyId === newLeaseParty.id;

              const { task: task2 } = await setupQueueToWaitFor([condition], ['tasks']);

              await archiveParty(newCtx, { partyId: newLeaseParty.id, archiveReasonId: DALTypes.ArchivePartyReasons.RESIDENT_CREATED });

              await task2;

              await createAndSendMail(activeLeaseParty.emailIdentifier);

              await checkPartyLength(3, partyWfStatesSubset.all);
              await checkPartyMemberLength(newLeaseParty.id, 2);
              await checkPartyMemberLength(activeLeaseParty.id, 2);
            });
          });

          describe('when the new lease is closed, active lease is archived and the email contains the new lease party identifier', async () => {
            it('it should create a new party for the new user', async () => {
              const { newLeaseParty, activeLeaseParty, renewalParty, lease } = await setupNewLeaseAndActiveLease();
              expectNewLeaseActiveLease(newLeaseParty, activeLeaseParty, renewalParty);

              await checkPersonLength(2);
              await checkPartyMemberLength(newLeaseParty.id, 2);
              await checkPartyMemberLength(activeLeaseParty.id, 2);

              const authUser = await loadUserById(ctx, newLeaseParty.id);
              const newCtx = { ...ctx, authUser };

              await voidLease(newCtx, lease.id, true);

              const condition = payload => payload.partyId === newLeaseParty.id;

              const { task: task2 } = await setupQueueToWaitFor([condition], ['tasks']);

              await closeParty(newCtx, newLeaseParty.id, DALTypes.ClosePartyReasons.NOT_INTERESTED);

              await task2;

              await createAndSendMail(newLeaseParty.emailIdentifier);

              const parties = await loadParties(ctx, partyWfStatesSubset.all);

              expect(parties.length).to.equal(3);
              await checkPartyMemberLength(newLeaseParty.id, 2);
              await checkPartyMemberLength(activeLeaseParty.id, 2);

              const NLParty = parties.find(p => p.id === newLeaseParty.id);
              const ALParty = parties.find(p => p.id === newLeaseParty.id);

              expect(NLParty.endDate).to.not.be.null;
              expect(ALParty.archiveDate).to.not.be.null;
            });
          });

          describe('when the new lease is closed, active lease is archived and the email contains the active lease party identifier', async () => {
            it('it should create a new party for the new user', async () => {
              const { newLeaseParty, activeLeaseParty, renewalParty, lease } = await setupNewLeaseAndActiveLease();
              expectNewLeaseActiveLease(newLeaseParty, activeLeaseParty, renewalParty);

              await checkPersonLength(2);
              await checkPartyMemberLength(newLeaseParty.id, 2);
              await checkPartyMemberLength(activeLeaseParty.id, 2);

              const authUser = await loadUserById(ctx, activeLeaseParty.id);
              const newCtx = { ...ctx, authUser };

              await voidLease(newCtx, lease.id, true);

              const condition = payload => payload.partyId === newLeaseParty.id;

              const { task: task2 } = await setupQueueToWaitFor([condition], ['tasks']);

              await closeParty(newCtx, newLeaseParty.id, DALTypes.ClosePartyReasons.NOT_INTERESTED);

              await task2;
              await createAndSendMail(activeLeaseParty.emailIdentifier);

              const parties = await loadParties(ctx, partyWfStatesSubset.all);

              expect(parties.length).to.equal(3);
              await checkPartyMemberLength(newLeaseParty.id, 2);
              await checkPartyMemberLength(activeLeaseParty.id, 2);

              const NLParty = parties.find(p => p.id === newLeaseParty.id);
              const ALParty = parties.find(p => p.id === newLeaseParty.id);

              expect(NLParty.endDate).to.not.be.null;
              expect(ALParty.archiveDate).to.not.be.null;
            });
          });
        });

        describe('when receiving a new email from an known originator with party on same property', async () => {
          describe('when the new lease is still active and the email contains the new lease party identifier', async () => {
            it.skip('it should add the comm to the existing party', async () => {
              const { newLeaseParty, activeLeaseParty, renewalParty } = await setupNewLeaseAndActiveLease();
              expectNewLeaseActiveLease(newLeaseParty, activeLeaseParty, renewalParty);

              const party = await setupExistingPartyDataForProperty(newLeaseParty.assignedPropertyId, newLeaseParty.userId, newLeaseParty.teams);

              await checkPersonLength(3);
              await checkPartyMemberLength(newLeaseParty.id, 2);
              await checkPartyMemberLength(activeLeaseParty.id, 2);
              await checkPartyMemberLength(party.id, 1);

              const messageId = await createAndSendMail(newLeaseParty.emailIdentifier);

              await checkPartyLength(3, partyWfStatesSubset.all);
              await checkPartyMemberLength(newLeaseParty.id, 2);
              await checkPartyMemberLength(activeLeaseParty.id, 2);

              await checkCommForParty(party.id, messageId);
            });
          });

          describe('when the new lease is archived and the email contains the new lease party identifier', async () => {
            it.skip('it should create a new party for the new user', async () => {
              const { newLeaseParty, activeLeaseParty, renewalParty } = await setupNewLeaseAndActiveLease();
              expectNewLeaseActiveLease(newLeaseParty, activeLeaseParty, renewalParty);

              const party = await setupExistingPartyDataForProperty(newLeaseParty.assignedPropertyId, newLeaseParty.userId, newLeaseParty.teams);

              await checkPersonLength(3);

              await checkPartyLength(3, partyWfStatesSubset.all);
              await checkPartyMemberLength(newLeaseParty.id, 2);
              await checkPartyMemberLength(activeLeaseParty.id, 2);
              await checkPartyMemberLength(party.id, 1);

              const authUser = await createAUser();
              const newCtx = { ...ctx, authUser };

              const condition = payload => payload.partyId === newLeaseParty.id;

              const { task: task2 } = await setupQueueToWaitFor([condition], ['tasks']);

              await archiveParty(newCtx, { partyId: newLeaseParty.id, archiveReasonId: DALTypes.ArchivePartyReasons.RESIDENT_CREATED });

              await task2;

              const messageId = await createAndSendMail(newLeaseParty.emailIdentifier);

              await checkPartyLength(3, partyWfStatesSubset.all);
              await checkPartyMemberLength(newLeaseParty.id, 2);
              await checkPartyMemberLength(activeLeaseParty.id, 2);

              await checkCommForParty(party.id, messageId);
            });
          });

          describe('when the new lease is archived and the email contains the active lease party identifier', async () => {
            it.skip('it should create a new party for the new user', async () => {
              const { newLeaseParty, activeLeaseParty, renewalParty } = await setupNewLeaseAndActiveLease();
              expectNewLeaseActiveLease(newLeaseParty, activeLeaseParty, renewalParty);

              const party = await setupExistingPartyDataForProperty(newLeaseParty.assignedPropertyId, newLeaseParty.userId, newLeaseParty.teams);

              await checkPersonLength(3);

              await checkPartyMemberLength(party.id, 1);
              await checkPartyMemberLength(newLeaseParty.id, 2);
              await checkPartyMemberLength(activeLeaseParty.id, 2);

              await checkPartyLength(3, partyWfStatesSubset.all);

              const authUser = await createAUser();
              const newCtx = { ...ctx, authUser };

              const condition = payload => payload.partyId === newLeaseParty.id;

              const { task: task2 } = await setupQueueToWaitFor([condition], ['tasks']);

              await archiveParty(newCtx, { partyId: newLeaseParty.id, archiveReasonId: DALTypes.ArchivePartyReasons.RESIDENT_CREATED });

              await task2;

              const messageId = await createAndSendMail(activeLeaseParty.emailIdentifier);

              await checkPartyLength(3, partyWfStatesSubset.all);
              await checkPartyMemberLength(newLeaseParty.id, 2);
              await checkPartyMemberLength(activeLeaseParty.id, 2);

              await checkCommForParty(party.id, messageId);
            });
          });

          describe('when the new lease is closed, active lease is archived and the email contains the new lease party identifier', async () => {
            it('it should create a new party for the new user', async () => {
              const { newLeaseParty, activeLeaseParty, renewalParty, lease } = await setupNewLeaseAndActiveLease();
              expectNewLeaseActiveLease(newLeaseParty, activeLeaseParty, renewalParty);

              const party = await setupExistingPartyDataForProperty(newLeaseParty.assignedPropertyId, newLeaseParty.userId, newLeaseParty.teams);
              await checkPartyLength(3, partyWfStatesSubset.all);

              await checkPersonLength(3);
              await checkPartyMemberLength(newLeaseParty.id, 2);
              await checkPartyMemberLength(activeLeaseParty.id, 2);

              const authUser = await loadUserById(ctx, newLeaseParty.id);
              const newCtx = { ...ctx, authUser };

              await voidLease(newCtx, lease.id, true);

              const condition = payload => payload.partyId === newLeaseParty.id;

              const { task: task2 } = await setupQueueToWaitFor([condition], ['tasks']);

              await closeParty(newCtx, newLeaseParty.id, DALTypes.ClosePartyReasons.NOT_INTERESTED);

              await task2;

              const messageId = await createAndSendMail(newLeaseParty.emailIdentifier);

              const parties = await loadParties(ctx, partyWfStatesSubset.all);
              await checkPersonLength(3);

              expect(parties.length).to.equal(3);
              await checkPartyMemberLength(newLeaseParty.id, 2);
              await checkPartyMemberLength(activeLeaseParty.id, 2);

              const NLParty = parties.find(p => p.id === newLeaseParty.id);
              const ALParty = parties.find(p => p.id === newLeaseParty.id);

              expect(NLParty.endDate).to.not.be.null;
              expect(ALParty.archiveDate).to.not.be.null;
              await checkCommForParty(party.id, messageId);
            });
          });

          describe('when the new lease is closed, active lease is archived and the email contains the active lease party identifier', async () => {
            it.skip('it should create a new party for the new user', async () => {
              const { newLeaseParty, activeLeaseParty, renewalParty, lease } = await setupNewLeaseAndActiveLease();
              expectNewLeaseActiveLease(newLeaseParty, activeLeaseParty, renewalParty);

              const party = await setupExistingPartyDataForProperty(newLeaseParty.assignedPropertyId, newLeaseParty.userId, newLeaseParty.teams);
              await checkPartyLength(3, partyWfStatesSubset.all);

              await checkPersonLength(3);
              await checkPartyMemberLength(newLeaseParty.id, 2);
              await checkPartyMemberLength(activeLeaseParty.id, 2);

              const authUser = await loadUserById(ctx, activeLeaseParty.id);
              const newCtx = { ...ctx, authUser };

              await voidLease(newCtx, lease.id, true);

              const condition = payload => payload.partyId === newLeaseParty.id;

              const { task: task2 } = await setupQueueToWaitFor([condition], ['tasks']);

              await closeParty(newCtx, newLeaseParty.id, DALTypes.ClosePartyReasons.NOT_INTERESTED);

              await task2;
              const messageId = await createAndSendMail(activeLeaseParty.emailIdentifier);

              const parties = await loadParties(ctx, partyWfStatesSubset.all);
              await checkPersonLength(3);
              expect(parties.length).to.equal(3);
              await checkPartyMemberLength(newLeaseParty.id, 2);
              await checkPartyMemberLength(activeLeaseParty.id, 2);

              const NLParty = parties.find(p => p.id === newLeaseParty.id);
              const ALParty = parties.find(p => p.id === newLeaseParty.id);

              expect(NLParty.endDate).to.not.be.null;
              expect(ALParty.archiveDate).to.not.be.null;
              await checkCommForParty(party.id, messageId);
            });
          });
        });

        describe('when receiving a new email from an known originator with party on different property', async () => {
          describe('when the new lease is still active and the email contains the new lease party identifier', async () => {
            it('it should create a new party for the user', async () => {
              const { newLeaseParty, activeLeaseParty, renewalParty } = await setupNewLeaseAndActiveLease();
              expectNewLeaseActiveLease(newLeaseParty, activeLeaseParty, renewalParty);

              const party = await setupNewPartyOnNewProperty(newLeaseParty.userId, newLeaseParty.teams);

              await checkPersonLength(3);
              await checkPartyMemberLength(newLeaseParty.id, 2);
              await checkPartyMemberLength(activeLeaseParty.id, 2);
              await checkPartyMemberLength(party.id, 1);

              const messageId = await createAndSendMail(newLeaseParty.emailIdentifier);

              await checkPartyLength(4, partyWfStatesSubset.all);
              await checkPartyMemberLength(newLeaseParty.id, 2);
              await checkPartyMemberLength(activeLeaseParty.id, 2);

              await checkCommNotInParties([party.id, newLeaseParty.id, activeLeaseParty.id], messageId);
            });
          });

          describe('when the new lease is archived and the email contains the new lease party identifier', async () => {
            it('it should create a new party for the new user', async () => {
              const { newLeaseParty, activeLeaseParty, renewalParty } = await setupNewLeaseAndActiveLease();
              expectNewLeaseActiveLease(newLeaseParty, activeLeaseParty, renewalParty);

              const party = await setupNewPartyOnNewProperty(newLeaseParty.userId, newLeaseParty.teams);

              await checkPersonLength(3);

              await checkPartyLength(3, partyWfStatesSubset.all);
              await checkPartyMemberLength(newLeaseParty.id, 2);
              await checkPartyMemberLength(activeLeaseParty.id, 2);
              await checkPartyMemberLength(party.id, 1);

              const authUser = await createAUser();
              const newCtx = { ...ctx, authUser };

              const condition = payload => payload.partyId === newLeaseParty.id;

              const { task: task2 } = await setupQueueToWaitFor([condition], ['tasks']);

              await archiveParty(newCtx, { partyId: newLeaseParty.id, archiveReasonId: DALTypes.ArchivePartyReasons.RESIDENT_CREATED });

              await task2;

              const messageId = await createAndSendMail(newLeaseParty.emailIdentifier);

              await checkPartyLength(4, partyWfStatesSubset.all);
              await checkPartyMemberLength(newLeaseParty.id, 2);
              await checkPartyMemberLength(activeLeaseParty.id, 2);

              await checkCommNotInParties([party.id, newLeaseParty.id, activeLeaseParty.id], messageId);
            });
          });

          describe('when the new lease is archived and the email contains the active lease party identifier', async () => {
            it('it should create a new party for the new user', async () => {
              const { newLeaseParty, activeLeaseParty, renewalParty } = await setupNewLeaseAndActiveLease();
              expectNewLeaseActiveLease(newLeaseParty, activeLeaseParty, renewalParty);

              const party = await setupNewPartyOnNewProperty(newLeaseParty.userId, newLeaseParty.teams);

              await checkPersonLength(3);

              await checkPartyMemberLength(party.id, 1);
              await checkPartyMemberLength(newLeaseParty.id, 2);
              await checkPartyMemberLength(activeLeaseParty.id, 2);

              await checkPartyLength(3, partyWfStatesSubset.all);

              const authUser = await createAUser();
              const newCtx = { ...ctx, authUser };

              const condition = payload => payload.partyId === newLeaseParty.id;

              const { task: task2 } = await setupQueueToWaitFor([condition], ['tasks']);

              await archiveParty(newCtx, { partyId: newLeaseParty.id, archiveReasonId: DALTypes.ArchivePartyReasons.RESIDENT_CREATED });

              await task2;

              const messageId = await createAndSendMail(activeLeaseParty.emailIdentifier);

              await checkPartyLength(4, partyWfStatesSubset.all);
              await checkPartyMemberLength(newLeaseParty.id, 2);
              await checkPartyMemberLength(activeLeaseParty.id, 2);

              await checkCommNotInParties([party.id, newLeaseParty.id, activeLeaseParty.id], messageId);
            });
          });

          describe('when the new lease is closed, active lease is archived and the email contains the new lease party identifier', async () => {
            it('it should create a new party for the new user', async () => {
              const { newLeaseParty, activeLeaseParty, renewalParty, lease } = await setupNewLeaseAndActiveLease();
              expectNewLeaseActiveLease(newLeaseParty, activeLeaseParty, renewalParty);

              const party = await setupNewPartyOnNewProperty(newLeaseParty.userId, newLeaseParty.teams);
              await checkPartyLength(3, partyWfStatesSubset.all);

              await checkPersonLength(3);
              await checkPartyMemberLength(newLeaseParty.id, 2);
              await checkPartyMemberLength(activeLeaseParty.id, 2);

              const authUser = await loadUserById(ctx, newLeaseParty.id);
              const newCtx = { ...ctx, authUser };

              await voidLease(newCtx, lease.id, true);

              const condition = payload => payload.partyId === newLeaseParty.id;

              const { task: task2 } = await setupQueueToWaitFor([condition], ['tasks']);

              await closeParty(newCtx, newLeaseParty.id, DALTypes.ClosePartyReasons.NOT_INTERESTED);

              await task2;

              const messageId = await createAndSendMail(newLeaseParty.emailIdentifier);

              const parties = await loadParties(ctx, partyWfStatesSubset.all);
              await checkPersonLength(3);

              expect(parties.length).to.equal(4);
              await checkPartyMemberLength(newLeaseParty.id, 2);
              await checkPartyMemberLength(activeLeaseParty.id, 2);

              const NLParty = parties.find(p => p.id === newLeaseParty.id);
              const ALParty = parties.find(p => p.id === newLeaseParty.id);

              expect(NLParty.endDate).to.not.be.null;
              expect(ALParty.archiveDate).to.not.be.null;
              await checkCommNotInParties([party.id, newLeaseParty.id, activeLeaseParty.id], messageId);
            });
          });

          describe('when the new lease is closed, active lease is archived and the email contains the active lease party identifier', async () => {
            it('it should create a new party for the new user', async () => {
              const { newLeaseParty, activeLeaseParty, renewalParty, lease } = await setupNewLeaseAndActiveLease();
              expectNewLeaseActiveLease(newLeaseParty, activeLeaseParty, renewalParty);

              const party = await setupNewPartyOnNewProperty(newLeaseParty.userId, newLeaseParty.teams);
              await checkPartyLength(3, partyWfStatesSubset.all);

              await checkPersonLength(3);
              await checkPartyMemberLength(newLeaseParty.id, 2);
              await checkPartyMemberLength(activeLeaseParty.id, 2);

              const authUser = await loadUserById(ctx, activeLeaseParty.id);
              const newCtx = { ...ctx, authUser };

              await voidLease(newCtx, lease.id, true);

              const condition = payload => payload.partyId === newLeaseParty.id;

              const { task: task2 } = await setupQueueToWaitFor([condition], ['tasks']);

              await closeParty(newCtx, newLeaseParty.id, DALTypes.ClosePartyReasons.NOT_INTERESTED);

              await task2;
              const messageId = await createAndSendMail(activeLeaseParty.emailIdentifier);

              const parties = await loadParties(ctx, partyWfStatesSubset.all);
              await checkPersonLength(3);
              expect(parties.length).to.equal(4);
              await checkPartyMemberLength(newLeaseParty.id, 2);
              await checkPartyMemberLength(activeLeaseParty.id, 2);

              const NLParty = parties.find(p => p.id === newLeaseParty.id);
              const ALParty = parties.find(p => p.id === newLeaseParty.id);

              expect(NLParty.endDate).to.not.be.null;
              expect(ALParty.archiveDate).to.not.be.null;
              await checkCommNotInParties([party.id, newLeaseParty.id, activeLeaseParty.id], messageId);
            });
          });
        });
      });
      describe('given an active lease party', async () => {
        describe('when receiving a party email from an unknown originator', async () => {
          it('it should create a new party for the new user', async () => {
            const activeLeaseParty = await setupActiveLease();

            const party = await getPartyBy(ctx, { id: activeLeaseParty.id });
            expect(party.workflowName).to.equal(DALTypes.WorkflowName.ACTIVE_LEASE);
            expect(party.workflowState).to.equal(DALTypes.WorkflowState.ACTIVE);

            await checkPartyMemberLength(party.id, 2);

            await createAndSendMail(activeLeaseParty.emailIdentifier);
            await checkPartyLength(2, partyWfStatesSubset.all);
            await checkPartyMemberLength(party.id, 2);
          });

          it('when receiving a program email with a reply to from a known originator, comm will be added to existing party', async () => {
            const activeLeaseParty = await setupActiveLease();

            const programEmailIdentifier = 'program-email-identifier';
            const programPropertyId = activeLeaseParty.assignedPropertyId;
            await createATeamProperty(activeLeaseParty.ownerTeam, programPropertyId);

            await createATeamPropertyProgram({
              teamId: activeLeaseParty.ownerTeam,
              propertyId: programPropertyId,
              directEmailIdentifier: programEmailIdentifier,
              commDirection: DALTypes.CommunicationDirection.IN,
            });

            const messageId = 'testMessageId';

            await createACommunicationEntry({
              parties: [activeLeaseParty.id],
              teams: activeLeaseParty.teams,
              messageId,
            });

            const party = await setupExistingPartyDataForProperty(activeLeaseParty.assignedPropertyId, activeLeaseParty.userId, activeLeaseParty.teams);

            await closeParty({ ...ctx, authUser: { id: party.userId } }, party.id, DALTypes.ClosePartyReasons.NOT_INTERESTED);

            const newMessageId = newId().toString();
            const replyEmail = getEmailDetails(newMessageId, programEmailIdentifier);
            await checkPartyMemberLength(activeLeaseParty.id, 2);

            await createAndSendMail(programEmailIdentifier, {
              ...replyEmail,
              msg: {
                ...replyEmail.msg,
                inReplyTo: messageId,
              },
            });
            await checkPartyLength(2, partyWfStatesSubset.all);
            await checkPartyMemberLength(activeLeaseParty.id, 2);
            await checkCommForParty(party.id, newMessageId);
          });
        });

        describe.skip('when receiving a party email from an known originator with party on same property', async () => {
          it('it should create add the comm to the existing party of the user', async () => {
            const activeLeaseParty = await setupActiveLease();
            await checkPartyLength(1, partyWfStatesSubset.all);

            const newParty = await setupExistingPartyDataForProperty(activeLeaseParty.assignedPropertyId, activeLeaseParty.userId, activeLeaseParty.teams);
            await checkPartyLength(2, partyWfStatesSubset.all);

            await checkPersonLength(3);

            const party = await getPartyBy(ctx, { id: activeLeaseParty.id });
            expect(party.workflowName).to.equal(DALTypes.WorkflowName.ACTIVE_LEASE);
            expect(party.workflowState).to.equal(DALTypes.WorkflowState.ACTIVE);

            await checkPartyMemberLength(party.id, 2);

            const messageId = await createAndSendMail(activeLeaseParty.emailIdentifier);
            await checkPartyLength(2, partyWfStatesSubset.all);
            await checkPartyMemberLength(party.id, 2);
            await checkCommForParty(newParty.id, messageId);
          });
        });

        describe('when receiving a party email from an known originator with party on different property', async () => {
          it('it should create a new party', async () => {
            const activeLeaseParty = await setupActiveLease();
            await checkPartyLength(1, partyWfStatesSubset.all);

            const newParty = await setupNewPartyOnNewProperty(activeLeaseParty.userId, activeLeaseParty.teams);
            await checkPartyLength(2, partyWfStatesSubset.all);

            await checkPersonLength(3);

            const party = await getPartyBy(ctx, { id: activeLeaseParty.id });
            expect(party.workflowName).to.equal(DALTypes.WorkflowName.ACTIVE_LEASE);
            expect(party.workflowState).to.equal(DALTypes.WorkflowState.ACTIVE);

            await checkPartyMemberLength(party.id, 2);

            const messageId = await createAndSendMail(activeLeaseParty.emailIdentifier);
            await checkPartyLength(3, partyWfStatesSubset.all);
            await checkPartyMemberLength(party.id, 2);
            await checkCommNotInParties([newParty.id, activeLeaseParty.id], messageId);
          });
        });

        describe('given a closed active lease party', async () => {
          describe('when receiving a party email from an unknown originator', async () => {
            it('it should create a new party for the new user', async () => {
              const activeLeaseParty = await setupActiveLease();

              const party = await getPartyBy(ctx, { id: activeLeaseParty.id });
              expect(party.workflowName).to.equal(DALTypes.WorkflowName.ACTIVE_LEASE);
              expect(party.workflowState).to.equal(DALTypes.WorkflowState.ACTIVE);
              await checkPartyMemberLength(party.id, 2);

              await closeParty({ ...ctx, authUser: { id: party.userId } }, party.id, DALTypes.ClosePartyReasons.NOT_INTERESTED);

              await createAndSendMail(activeLeaseParty.emailIdentifier);

              await checkPartyLength(2, partyWfStatesSubset.all);
              await checkPartyMemberLength(party.id, 2);
            });
          });

          describe('when receiving a party email from an known originator with party on same property', async () => {
            it('it should add the comm to his party', async () => {
              const activeLeaseParty = await setupActiveLease();

              const newParty = await setupExistingPartyDataForProperty(activeLeaseParty.assignedPropertyId, activeLeaseParty.userId, activeLeaseParty.teams);
              await checkPartyLength(2, partyWfStatesSubset.all);

              await checkPersonLength(3);

              const party = await getPartyBy(ctx, { id: activeLeaseParty.id });
              expect(party.workflowName).to.equal(DALTypes.WorkflowName.ACTIVE_LEASE);
              expect(party.workflowState).to.equal(DALTypes.WorkflowState.ACTIVE);
              await checkPartyMemberLength(party.id, 2);

              await closeParty({ ...ctx, authUser: { id: party.userId } }, party.id, DALTypes.ClosePartyReasons.NOT_INTERESTED);

              const messageId = await createAndSendMail(activeLeaseParty.emailIdentifier);

              await checkPartyLength(2, partyWfStatesSubset.all);
              await checkPartyMemberLength(party.id, 2);
              await checkCommForParty(newParty.id, messageId);
            });
          });

          describe('when receiving a party email from an known originator with party on different property', async () => {
            it('it should create a new party for the user', async () => {
              const activeLeaseParty = await setupActiveLease();

              const newParty = await setupNewPartyOnNewProperty(activeLeaseParty.userId, activeLeaseParty.teams);
              await checkPartyLength(2, partyWfStatesSubset.all);

              await checkPersonLength(3);

              const party = await getPartyBy(ctx, { id: activeLeaseParty.id });
              expect(party.workflowName).to.equal(DALTypes.WorkflowName.ACTIVE_LEASE);
              expect(party.workflowState).to.equal(DALTypes.WorkflowState.ACTIVE);
              await checkPartyMemberLength(party.id, 2);

              await closeParty({ ...ctx, authUser: { id: party.userId } }, party.id, DALTypes.ClosePartyReasons.NOT_INTERESTED);

              const messageId = await createAndSendMail(activeLeaseParty.emailIdentifier);

              await checkPartyLength(3, partyWfStatesSubset.all);
              await checkPartyMemberLength(party.id, 2);
              await checkCommNotInParties([newParty.id, activeLeaseParty.id], messageId);
            });
          });
        });
      });

      describe('given an active lease and renewal party', async () => {
        describe('when receiving a party email from an unknown originator for the active lease', async () => {
          it('it should create a new party for the new user', async () => {
            const activeLeaseParty = await setupActiveLease();

            await callProcessWorkflowsJob();

            const parties = await loadParties(ctx, partyWfStatesSubset.all);

            expect(parties.length).to.equal(2);

            const alParty = parties.find(p => p.id === activeLeaseParty.id);
            const rnParty = parties.find(p => p.id !== activeLeaseParty.id);

            await checkPartyMemberLength(alParty.id, 2);
            await checkPartyMemberLength(rnParty.id, 2);

            await createAndSendMail(activeLeaseParty.emailIdentifier);

            await checkPartyLength(3, partyWfStatesSubset.all);
            await checkPartyMemberLength(alParty.id, 2);
            await checkPartyMemberLength(rnParty.id, 2);
          });
        });

        describe('when receiving a party email from an unknown originator for the renewal lease', async () => {
          it.skip('it should create a new party for the user', async () => {
            const activeLeaseParty = await setupActiveLease();

            await callProcessWorkflowsJob();

            const parties = await loadParties(ctx, partyWfStatesSubset.all);

            expect(parties.length).to.equal(2);

            const alParty = parties.find(p => p.id === activeLeaseParty.id);
            const rnParty = parties.find(p => p.id !== activeLeaseParty.id);

            await checkPartyMemberLength(alParty.id, 2);
            await checkPartyMemberLength(rnParty.id, 2);

            await createAndSendMail(rnParty.emailIdentifier);

            await checkPartyLength(3, partyWfStatesSubset.all);
            await checkPartyMemberLength(alParty.id, 2);
            await checkPartyMemberLength(rnParty.id, 2);
          });
        });

        describe('when receiving a party email from an known originator for the active lease', async () => {
          it.skip('it should add the comm to his existing party', async () => {
            const activeLeaseParty = await setupActiveLease();

            await callProcessWorkflowsJob();

            const parties = await loadParties(ctx, partyWfStatesSubset.all);

            const newParty = await setupExistingPartyDataForProperty(activeLeaseParty.assignedPropertyId, activeLeaseParty.userId, activeLeaseParty.teams);
            await checkPartyLength(3, partyWfStatesSubset.all);

            await checkPersonLength(3);

            const alParty = parties.find(p => p.id === activeLeaseParty.id);
            const rnParty = parties.find(p => p.id !== activeLeaseParty.id);

            await checkPartyMemberLength(alParty.id, 2);
            await checkPartyMemberLength(rnParty.id, 2);

            const messageId = await createAndSendMail(activeLeaseParty.emailIdentifier);

            await checkPartyLength(3, partyWfStatesSubset.all);
            await checkPartyMemberLength(alParty.id, 2);
            await checkPartyMemberLength(rnParty.id, 2);
            await checkCommForParty(newParty.id, messageId);
          });
        });

        describe('when receiving a party email from an known originator for the renewal lease', async () => {
          it.skip('it should redirect the comm to his existing party', async () => {
            const activeLeaseParty = await setupActiveLease();

            await callProcessWorkflowsJob();

            const parties = await loadParties(ctx, partyWfStatesSubset.all);

            const newParty = await setupExistingPartyDataForProperty(activeLeaseParty.assignedPropertyId, activeLeaseParty.userId, activeLeaseParty.teams);
            await checkPartyLength(3, partyWfStatesSubset.all);

            await checkPersonLength(3);

            const alParty = parties.find(p => p.id === activeLeaseParty.id);
            const rnParty = parties.find(p => p.id !== activeLeaseParty.id);

            await checkPartyMemberLength(alParty.id, 2);
            await checkPartyMemberLength(rnParty.id, 2);

            const messageId = await createAndSendMail(rnParty.emailIdentifier);

            await checkPartyLength(3, partyWfStatesSubset.all);
            await checkPartyMemberLength(alParty.id, 2);
            await checkPartyMemberLength(rnParty.id, 2);
            await checkCommForParty(newParty.id, messageId);
          });
        });

        describe('when receiving a party email from an known originator on different party for the active lease', async () => {
          it('it should create a new party', async () => {
            const activeLeaseParty = await setupActiveLease();

            await callProcessWorkflowsJob();

            const parties = await loadParties(ctx, partyWfStatesSubset.all);

            const newParty = await setupNewPartyOnNewProperty(activeLeaseParty.userId, activeLeaseParty.teams);
            await checkPartyLength(3, partyWfStatesSubset.all);

            await checkPersonLength(3);

            const alParty = parties.find(p => p.id === activeLeaseParty.id);
            const rnParty = parties.find(p => p.id !== activeLeaseParty.id);

            await checkPartyMemberLength(alParty.id, 2);
            await checkPartyMemberLength(rnParty.id, 2);

            const messageId = await createAndSendMail(activeLeaseParty.emailIdentifier);

            await checkPartyLength(4, partyWfStatesSubset.all);
            await checkPartyMemberLength(alParty.id, 2);
            await checkPartyMemberLength(rnParty.id, 2);
            await checkCommNotInParties([...parties.map(p => p.id), newParty.id], messageId);
          });
        });

        describe('when receiving a party email from an known originator on a different property for the renewal lease', async () => {
          it.skip('it should create a new party', async () => {
            const activeLeaseParty = await setupActiveLease();

            await callProcessWorkflowsJob();

            const parties = await loadParties(ctx, partyWfStatesSubset.all);

            const newParty = await setupNewPartyOnNewProperty(activeLeaseParty.userId, activeLeaseParty.teams);
            await checkPartyLength(3, partyWfStatesSubset.all);

            await checkPersonLength(3);

            const alParty = parties.find(p => p.id === activeLeaseParty.id);
            const rnParty = parties.find(p => p.id !== activeLeaseParty.id);

            await checkPartyMemberLength(alParty.id, 2);
            await checkPartyMemberLength(rnParty.id, 2);

            const messageId = await createAndSendMail(rnParty.emailIdentifier);

            await checkPartyLength(4, partyWfStatesSubset.all);
            await checkPartyMemberLength(alParty.id, 2);
            await checkPartyMemberLength(rnParty.id, 2);
            await checkCommNotInParties([...parties.map(p => p.id), newParty.id], messageId);
          });
        });
      });

      describe('given a closed active lease  and renewal party ', async () => {
        describe('when receiving a party email from an unknown originator to the renewal party', async () => {
          it('it should create a new party for the new user', async () => {
            const activeLeaseParty = await setupActiveLease();

            await callProcessWorkflowsJob();

            const parties = await loadParties(ctx, partyWfStatesSubset.all);

            expect(parties.length).to.equal(2);

            const alParty = parties.find(p => p.id === activeLeaseParty.id);
            const rnParty = parties.find(p => p.id !== activeLeaseParty.id);

            await checkPartyMemberLength(alParty.id, 2);
            await checkPartyMemberLength(rnParty.id, 2);

            await closeParty({ ...ctx, authUser: { id: alParty.userId } }, alParty.id, DALTypes.ClosePartyReasons.NOT_INTERESTED);
            const authUser = await createAUser();
            const newCtx = { ...ctx, authUser };

            const condition = payload => payload.partyId === rnParty.id;

            const { task: task2 } = await setupQueueToWaitFor([condition], ['tasks']);

            await archiveParty(newCtx, { partyId: rnParty.id, archiveReasonId: DALTypes.ArchivePartyReasons.RESIDENT_CREATED });

            await task2;

            await createAndSendMail(rnParty.emailIdentifier);

            const partiesAfter = await loadParties(ctx, partyWfStatesSubset.all);
            expect(partiesAfter.length).to.equal(3);

            await checkPartyMemberLength(alParty.id, 2);
            await checkPartyMemberLength(rnParty.id, 2);
            const RNParty = partiesAfter.find(p => p.id === rnParty.id);
            const ALParty = partiesAfter.find(p => p.id === alParty.id);

            expect(RNParty.archiveDate).to.not.be.null;
            expect(ALParty.endDate).to.not.be.null;
          });
        });

        describe('when receiving a party email from an known originator with party on same property to the renewal party', async () => {
          it.skip('it should add the comm to the existing party of the user', async () => {
            const activeLeaseParty = await setupActiveLease();

            await callProcessWorkflowsJob();

            const parties = await loadParties(ctx, partyWfStatesSubset.all);

            expect(parties.length).to.equal(2);

            const alParty = parties.find(p => p.id === activeLeaseParty.id);
            const rnParty = parties.find(p => p.id !== activeLeaseParty.id);

            const newParty = await setupExistingPartyDataForProperty(activeLeaseParty.assignedPropertyId, activeLeaseParty.userId, activeLeaseParty.teams);

            await checkPartyMemberLength(alParty.id, 2);
            await checkPartyMemberLength(rnParty.id, 2);

            await closeParty({ ...ctx, authUser: { id: alParty.userId } }, alParty.id, DALTypes.ClosePartyReasons.NOT_INTERESTED);
            const authUser = await createAUser();
            const newCtx = { ...ctx, authUser };

            const condition = payload => payload.partyId === rnParty.id;

            const { task: task2 } = await setupQueueToWaitFor([condition], ['tasks']);

            await archiveParty(newCtx, { partyId: rnParty.id, archiveReasonId: DALTypes.ArchivePartyReasons.RESIDENT_CREATED });

            await task2;

            const messageId = await createAndSendMail(rnParty.emailIdentifier);

            const partiesAfter = await loadParties(ctx, partyWfStatesSubset.all);
            expect(partiesAfter.length).to.equal(3);

            await checkPartyMemberLength(alParty.id, 2);
            await checkPartyMemberLength(rnParty.id, 2);
            const RNParty = partiesAfter.find(p => p.id === rnParty.id);
            const ALParty = partiesAfter.find(p => p.id === alParty.id);

            expect(RNParty.archiveDate).to.not.be.null;
            expect(ALParty.endDate).to.not.be.null;

            await checkCommForParty(newParty.id, messageId);
          });
        });

        describe('when receiving a party email from an known originator with party on different property to the renewal party', async () => {
          it('it should create a new party', async () => {
            const activeLeaseParty = await setupActiveLease();

            await callProcessWorkflowsJob();

            const parties = await loadParties(ctx, partyWfStatesSubset.all);

            expect(parties.length).to.equal(2);

            const alParty = parties.find(p => p.id === activeLeaseParty.id);
            const rnParty = parties.find(p => p.id !== activeLeaseParty.id);

            const newParty = await setupNewPartyOnNewProperty(activeLeaseParty.userId, activeLeaseParty.teams);

            await checkPartyMemberLength(alParty.id, 2);
            await checkPartyMemberLength(rnParty.id, 2);

            await closeParty({ ...ctx, authUser: { id: alParty.userId } }, alParty.id, DALTypes.ClosePartyReasons.NOT_INTERESTED);
            const authUser = await createAUser();
            const newCtx = { ...ctx, authUser };

            const condition = payload => payload.partyId === rnParty.id;

            const { task: task2 } = await setupQueueToWaitFor([condition], ['tasks']);

            await archiveParty(newCtx, { partyId: rnParty.id, archiveReasonId: DALTypes.ArchivePartyReasons.RESIDENT_CREATED });

            await task2;

            const messageId = await createAndSendMail(rnParty.emailIdentifier);

            const partiesAfter = await loadParties(ctx, partyWfStatesSubset.all);
            expect(partiesAfter.length).to.equal(4);

            await checkPartyMemberLength(alParty.id, 2);
            await checkPartyMemberLength(rnParty.id, 2);
            const RNParty = partiesAfter.find(p => p.id === rnParty.id);
            const ALParty = partiesAfter.find(p => p.id === alParty.id);

            expect(RNParty.archiveDate).to.not.be.null;
            expect(ALParty.endDate).to.not.be.null;

            await checkCommNotInParties([...parties.map(p => p.id), newParty.id], messageId);
          });
        });
      });

      describe('archived new lease, an active lease and renewal party', async () => {
        describe('when receiving a party email from an unknown originator for the active lease', async () => {
          it('it should create a new party for the new user', async () => {
            const activeLeaseParty = await setupActiveLease();

            await callProcessWorkflowsJob();

            const parties = await loadParties(ctx, partyWfStatesSubset.all);

            expect(parties.length).to.equal(2);

            const alParty = parties.find(p => p.id === activeLeaseParty.id);
            const rnParty = parties.find(p => p.id !== activeLeaseParty.id);

            await setupNewLeasePartyFromData(alParty);

            await checkPartyMemberLength(alParty.id, 2);
            await checkPartyMemberLength(rnParty.id, 2);

            await createAndSendMail(activeLeaseParty.emailIdentifier);

            await checkPartyLength(4, partyWfStatesSubset.all);
            await checkPartyMemberLength(alParty.id, 2);
            await checkPartyMemberLength(rnParty.id, 2);
          });
        });

        describe('when receiving a party email from an unknown originator for the renewal lease', async () => {
          it.skip('it should create a new party for the user', async () => {
            const activeLeaseParty = await setupActiveLease();

            await callProcessWorkflowsJob();

            const parties = await loadParties(ctx, partyWfStatesSubset.all);

            expect(parties.length).to.equal(2);

            const alParty = parties.find(p => p.id === activeLeaseParty.id);
            const rnParty = parties.find(p => p.id !== activeLeaseParty.id);

            await checkPartyMemberLength(alParty.id, 2);
            await checkPartyMemberLength(rnParty.id, 2);
            await setupNewLeasePartyFromData(alParty);

            await createAndSendMail(rnParty.emailIdentifier);

            await checkPartyLength(4, partyWfStatesSubset.all);
            await checkPartyMemberLength(alParty.id, 2);
            await checkPartyMemberLength(rnParty.id, 2);
          });
        });

        describe('when receiving a party email from an unknown originator for the new lease', async () => {
          it('it should create a new party for the user', async () => {
            const activeLeaseParty = await setupActiveLease();

            await callProcessWorkflowsJob();

            const parties = await loadParties(ctx, partyWfStatesSubset.all);

            expect(parties.length).to.equal(2);

            const alParty = parties.find(p => p.id === activeLeaseParty.id);
            const rnParty = parties.find(p => p.id !== activeLeaseParty.id);

            await checkPartyMemberLength(alParty.id, 2);
            await checkPartyMemberLength(rnParty.id, 2);
            const nlParty = await setupNewLeasePartyFromData(alParty);

            await createAndSendMail(nlParty.emailIdentifier);

            await checkPartyLength(4, partyWfStatesSubset.all);
            await checkPartyMemberLength(alParty.id, 2);
            await checkPartyMemberLength(rnParty.id, 2);
            await checkPartyMemberLength(nlParty.id, 2);
          });
        });

        describe('when receiving a party email from an known originator on same property for the active lease', async () => {
          it.skip('it should add the comm to his existing party', async () => {
            const activeLeaseParty = await setupActiveLease();

            await callProcessWorkflowsJob();

            const parties = await loadParties(ctx, partyWfStatesSubset.all);

            const newParty = await setupExistingPartyDataForProperty(activeLeaseParty.assignedPropertyId, activeLeaseParty.userId, activeLeaseParty.teams);
            await checkPartyLength(3, partyWfStatesSubset.all);

            await checkPersonLength(3);

            const alParty = parties.find(p => p.id === activeLeaseParty.id);
            const rnParty = parties.find(p => p.id !== activeLeaseParty.id);

            await checkPartyMemberLength(alParty.id, 2);
            await checkPartyMemberLength(rnParty.id, 2);
            await setupNewLeasePartyFromData(alParty);

            const messageId = await createAndSendMail(activeLeaseParty.emailIdentifier);

            await checkPartyLength(4, partyWfStatesSubset.all);
            await checkPartyMemberLength(alParty.id, 2);
            await checkPartyMemberLength(rnParty.id, 2);
            await checkCommForParty(newParty.id, messageId);
          });
        });

        describe('when receiving a party email from an known originator for the renewal lease', async () => {
          it.skip('it should redirect the comm to his existing party', async () => {
            const activeLeaseParty = await setupActiveLease();

            await callProcessWorkflowsJob();

            const parties = await loadParties(ctx, partyWfStatesSubset.all);

            const newParty = await setupExistingPartyDataForProperty(activeLeaseParty.assignedPropertyId, activeLeaseParty.userId, activeLeaseParty.teams);
            await checkPartyLength(3, partyWfStatesSubset.all);

            await checkPersonLength(3);

            const alParty = parties.find(p => p.id === activeLeaseParty.id);
            const rnParty = parties.find(p => p.id !== activeLeaseParty.id);
            await setupNewLeasePartyFromData(alParty);

            await checkPartyMemberLength(alParty.id, 2);
            await checkPartyMemberLength(rnParty.id, 2);

            const messageId = await createAndSendMail(rnParty.emailIdentifier);

            await checkPartyLength(4, partyWfStatesSubset.all);
            await checkPartyMemberLength(alParty.id, 2);
            await checkPartyMemberLength(rnParty.id, 2);
            await checkCommForParty(newParty.id, messageId);
          });
        });

        describe('when receiving a party email from an known originator for the new lease', async () => {
          it.skip('it should redirect the comm to his existing party', async () => {
            const activeLeaseParty = await setupActiveLease();

            await callProcessWorkflowsJob();

            const parties = await loadParties(ctx, partyWfStatesSubset.all);

            const newParty = await setupExistingPartyDataForProperty(activeLeaseParty.assignedPropertyId, activeLeaseParty.userId, activeLeaseParty.teams);
            await checkPartyLength(3, partyWfStatesSubset.all);

            await checkPersonLength(3);

            const alParty = parties.find(p => p.id === activeLeaseParty.id);
            const rnParty = parties.find(p => p.id !== activeLeaseParty.id);
            const nlParty = await setupNewLeasePartyFromData(alParty);

            await checkPartyMemberLength(alParty.id, 2);
            await checkPartyMemberLength(rnParty.id, 2);

            const messageId = await createAndSendMail(nlParty.emailIdentifier);

            await checkPartyLength(4, partyWfStatesSubset.all);
            await checkPartyMemberLength(alParty.id, 2);
            await checkPartyMemberLength(rnParty.id, 2);
            await checkCommForParty(newParty.id, messageId);
          });
        });

        describe('when receiving a party email from an known originator on different party for the active lease', async () => {
          it('it should create a new party', async () => {
            const activeLeaseParty = await setupActiveLease();

            await callProcessWorkflowsJob();

            const parties = await loadParties(ctx, partyWfStatesSubset.all);

            const newParty = await setupNewPartyOnNewProperty(activeLeaseParty.userId, activeLeaseParty.teams);
            await checkPartyLength(3, partyWfStatesSubset.all);

            await checkPersonLength(3);

            const alParty = parties.find(p => p.id === activeLeaseParty.id);
            const rnParty = parties.find(p => p.id !== activeLeaseParty.id);
            const nlParty = await setupNewLeasePartyFromData(alParty);

            await checkPartyMemberLength(alParty.id, 2);
            await checkPartyMemberLength(rnParty.id, 2);

            const messageId = await createAndSendMail(activeLeaseParty.emailIdentifier);

            await checkPartyLength(5, partyWfStatesSubset.all);
            await checkPartyMemberLength(alParty.id, 2);
            await checkPartyMemberLength(rnParty.id, 2);
            await checkCommNotInParties([...parties.map(p => p.id), newParty.id, nlParty.id], messageId);
          });
        });

        describe('when receiving a party email from an known originator on a different property for the renewal lease', async () => {
          it.skip('it should create a new party', async () => {
            const activeLeaseParty = await setupActiveLease();

            await callProcessWorkflowsJob();

            const parties = await loadParties(ctx, partyWfStatesSubset.all);

            const newParty = await setupNewPartyOnNewProperty(activeLeaseParty.userId, activeLeaseParty.teams);
            await checkPartyLength(3, partyWfStatesSubset.all);

            await checkPersonLength(3);

            const alParty = parties.find(p => p.id === activeLeaseParty.id);
            const rnParty = parties.find(p => p.id !== activeLeaseParty.id);

            await checkPartyMemberLength(alParty.id, 2);
            await checkPartyMemberLength(rnParty.id, 2);
            const nlParty = await setupNewLeasePartyFromData(alParty);

            const messageId = await createAndSendMail(rnParty.emailIdentifier);

            await checkPartyLength(5, partyWfStatesSubset.all);
            await checkPartyMemberLength(alParty.id, 2);
            await checkPartyMemberLength(rnParty.id, 2);
            await checkCommNotInParties([...parties.map(p => p.id), newParty.id, nlParty.id], messageId);
          });
        });

        describe('when receiving a party email from an known originator on a different property for the new lease', async () => {
          it('it should create a new party', async () => {
            const activeLeaseParty = await setupActiveLease();

            await callProcessWorkflowsJob();

            const parties = await loadParties(ctx, partyWfStatesSubset.all);

            const newParty = await setupNewPartyOnNewProperty(activeLeaseParty.userId, activeLeaseParty.teams);
            await checkPartyLength(3, partyWfStatesSubset.all);

            await checkPersonLength(3);

            const alParty = parties.find(p => p.id === activeLeaseParty.id);
            const rnParty = parties.find(p => p.id !== activeLeaseParty.id);

            await checkPartyMemberLength(alParty.id, 2);
            await checkPartyMemberLength(rnParty.id, 2);
            const nlParty = await setupNewLeasePartyFromData(alParty);

            const messageId = await createAndSendMail(nlParty.emailIdentifier);

            await checkPartyLength(5, partyWfStatesSubset.all);
            await checkPartyMemberLength(alParty.id, 2);
            await checkPartyMemberLength(rnParty.id, 2);
            await checkPartyMemberLength(nlParty.id, 2);
            await checkCommNotInParties([...parties.map(p => p.id), newParty.id, nlParty.id], messageId);
          });
        });
      });
    });
  });
});
