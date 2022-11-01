/*
 * Copyright (c) 2022 Reva Technology Inc., all rights reserved.
 * Unauthorized copying of this file, via any medium is strictly prohibited
 * Licensed under the Elastic License 2.0; you may not use this file except
 * in compliance with the Elastic License 2.0.
 */

import chai from 'chai';
import sinonChai from 'sinon-chai';
import newId from 'uuid/v4';
import request from 'supertest';
import config from '../../../config';
import app from '../../api';

import { getPartyBy, loadParties, getPartyMembersByPartyIds, updateParty } from '../../../dal/partyRepo';

import { getActiveLeaseWorkflowDataByPartyId, saveActiveLeaseWorkflowData } from '../../../dal/activeLeaseWorkflowRepo';

import { DALTypes } from '../../../../common/enums/DALTypes';
import { now } from '../../../../common/helpers/moment-utils';
import { DATE_US_FORMAT } from '../../../../common/date-constants';
import { testCtx as ctx, createATeamPropertyProgram, createASource } from '../../../testUtils/repoHelper';

import {
  createNewLeaseParty,
  callProcessWorkflowsJob,
  setupMsgQueueAndWaitFor,
  createActiveLeasePartyFromNewLease,
} from '../../../testUtils/partyWorkflowTestHelper';

import { createRenewalLeaseParty } from '../../../services/workflows';

import { getKeyByValue } from '../../../../common/enums/enumHelper';

import { partyWfStatesSubset } from '../../../../common/enums/partyTypes';
import { tenant, chan, createResolverMatcher } from '../../../testUtils/setupTestGlobalContext';
import { waitFor } from '../../../testUtils/apiHelper';
import { setupConsumers } from '../../../workers/consumer';
import { setGetEmailDetailsFunction, setDeleteS3MailFunction } from '../../../workers/communication/inboundEmailHandler';
import { getAllComms } from '../../../dal/communicationRepo';
import { postSms, makeUsersSipEndpointsOnline, postDirect } from '../../../testUtils/telephonyHelper';
import { loadUserById } from '../../../services/users';
import { setTelephonyOps } from '../../../services/telephony/providerApiOperations';
import { setDelayFunc } from '../../../services/telephony/hangup';
import { CallStatus } from '../../../services/telephony/enums';

chai.use(sinonChai);
const expect = chai.expect;

describe('Process incomming comms', () => {
  const getResident = members => members.find(pm => pm.memberType === DALTypes.MemberType.RESIDENT);

  beforeEach(async () => {
    setDeleteS3MailFunction(() => true);
    await setupMsgQueueAndWaitFor([], ['lease']);
    await createASource('transfer-agent', 'transfer-agent', '', 'Agent');
    setTelephonyOps({ getCallDetails: () => ({}) });
    setDelayFunc(async func => await func());
  });

  const programEmailIdentifier = 'program-email-identifier';
  const tenantPhoneNumber = tenant.metadata.phoneNumbers[0].phoneNumber;
  const programDirectPhoneIdentifier = tenantPhoneNumber;
  const postEmailUrl = `/webhooks/email?api-token=${config.tokens.api}`;

  const setupMeesageQueueForSMS = async (conditions, workerKeysToBeStarted) => {
    const matcher = createResolverMatcher();
    const { resolvers, promises } = waitFor(conditions);
    matcher.addWaiters(resolvers);
    await setupConsumers(chan(), matcher, workerKeysToBeStarted);
    return { task: Promise.all(promises) };
  };

  const setupMessageQueueForEmail = async (msgId, condition = (m, handlerSucceeded) => m.Key === msgId && handlerSucceeded) => {
    const { resolvers, promises } = waitFor([condition]);
    const matcher = createResolverMatcher(resolvers);
    await setupConsumers(chan(), matcher, ['mail']);

    return { task: Promise.all(promises) };
  };

  const setupForIncomingCall = async party => {
    const user = await loadUserById(ctx, party.userId);
    makeUsersSipEndpointsOnline([user]);
  };

  const getMailData = messageId => ({ Bucket: 'test', Key: messageId });
  let emailDetails;

  const getEmailDetails = (msgId, fromEmail, fromName, toAddress) => ({
    event: 'inbound',
    msg: {
      emails: [`${toAddress}@${tenant.name}.${config.mail.emailDomain}`],
      from_email: fromEmail,
      from_name: fromName,
      text: 'quertyiop',
      subject: 'querty',
      messageId: msgId,
    },
  });

  const createProgramDataFromPartyData = async party => {
    await createATeamPropertyProgram({
      teamId: party.ownerTeam,
      propertyId: party.assignedPropertyId,
      directEmailIdentifier: programEmailIdentifier,
      directPhoneIdentifier: programDirectPhoneIdentifier,
      commDirection: DALTypes.CommunicationDirection.IN,
    });
  };

  const getResidentContactInfo = async party => {
    const partyMembers = await getPartyMembersByPartyIds(ctx, [party.id]);
    const resident = getResident(partyMembers);

    const { defaultEmail, defaultPhone } = resident.contactInfo;
    return { defaultEmail, defaultPhone, residentName: resident.fullName };
  };

  const createAndSendMail = async (party, toAddress) => {
    const messageId = newId().toString();
    const mailData = getMailData(messageId);
    const { defaultEmail, residentName } = await getResidentContactInfo(party);

    emailDetails = getEmailDetails(messageId, defaultEmail, residentName, toAddress);
    setGetEmailDetailsFunction(() => emailDetails);

    const { task } = await setupMessageQueueForEmail(messageId);
    await request(app).post(postEmailUrl).send(mailData).expect(200);
    const results = await task;
    results.forEach(x => expect(x).to.be.true);
    return messageId;
  };

  const createAndSendSMS = async party => {
    const msgId = newId().toString();
    const { defaultPhone } = await getResidentContactInfo(party);
    const testData = {
      To: programDirectPhoneIdentifier,
      From: defaultPhone,
      TotalRate: '0',
      Units: '1',
      Text: 'Test incoming SMS message!',
      TotalAmount: '0',
      Type: 'sms',
      MessageUUID: msgId,
    };

    const condition = msg => msg.MessageUUID === msgId;
    const { task } = await setupMeesageQueueForSMS([condition], ['sms']);

    await postSms().send(testData).expect(200);
    await task;
  };

  const makeACall = async party => {
    setupForIncomingCall(party);
    const msgId = newId().toString();
    const { defaultPhone, residentName } = await getResidentContactInfo(party);
    await postDirect()
      .send({ To: programDirectPhoneIdentifier })
      .send({ CallerName: residentName })
      .send({ CallStatus: CallStatus.RINGING })
      .send({ From: defaultPhone })
      .send({ CallUUID: msgId });
  };

  const checkNewPartyAdeedAndCommOnCorrectPartyForExistingPerson = async (partiesCount, newLeaseParty, activeLeaseParty, renewalParty = {}) => {
    const partiesAfterMail = await loadParties(ctx, partyWfStatesSubset.all);

    const partyMembersNL = await getPartyMembersByPartyIds(ctx, [newLeaseParty.id]);
    const nlResident = getResident(partyMembersNL);

    expect(partiesAfterMail.length).to.equal(partiesCount);

    const newlyAddedParty = partiesAfterMail.find(p => p.id !== newLeaseParty.id && p.id !== activeLeaseParty.id && p.id !== renewalParty.id);

    const communications = await getAllComms(ctx);

    expect(communications);
    expect(communications.length).to.equal(1);

    expect(communications[0].parties.length).to.equal(1);
    expect(communications[0].parties[0]).to.equal(newlyAddedParty.id);

    const personId = communications[0].persons.find(p => p === nlResident.personId);

    expect(personId).to.not.be.undefined;
  };

  const checkCommAddedOnArchivedActiveLeaseForExistingPerson = async (partiesCount, activeLeasePartyId) => {
    const partiesAfterComm = await loadParties(ctx, partyWfStatesSubset.all);

    const partyMembersNL = await getPartyMembersByPartyIds(ctx, [activeLeasePartyId]);
    const nlResident = getResident(partyMembersNL);

    expect(partiesAfterComm.length).to.equal(partiesCount);

    const communications = await getAllComms(ctx);

    expect(communications);
    expect(communications.length).to.equal(1);

    expect(communications[0].parties.length).to.equal(1);
    expect(communications[0].parties[0]).to.equal(activeLeasePartyId);

    const personId = communications[0].persons.find(p => p === nlResident.personId);
    expect(personId).to.not.be.undefined;
  };

  describe('Given an archived new lease and an archived active lease', () => {
    const setupParties = async archiveDate => {
      const newLeaseStartDate = now().add(-2, 'days').toISOString();
      const leaseEndDate = now().add(-1, 'days').format(DATE_US_FORMAT);

      const { party: newLeaseParty } = await createNewLeaseParty({
        leaseStartDate: newLeaseStartDate,
        leaseEndDate,
        shouldSignLease: true,
        shouldCounterSignLease: true,
      });
      expect(newLeaseParty).to.be.ok;

      const { activeLeaseParty } = await createActiveLeasePartyFromNewLease({ newLeaseParty });
      const renewalParty = await createRenewalLeaseParty(ctx, activeLeaseParty.id);

      const activeLeaseData = await getActiveLeaseWorkflowDataByPartyId(ctx, activeLeaseParty.id);
      await saveActiveLeaseWorkflowData(ctx, {
        ...activeLeaseData,
        metadata: {
          ...activeLeaseData.metadata,
          dateOfTheNotice: archiveDate,
          vacateDate: archiveDate,
          moveOutConfirmed: true,
        },
      });

      await callProcessWorkflowsJob();

      // the archive date was set to now() when Process Workflow job was executed, so we need to update it
      await updateParty(ctx, { id: activeLeaseParty.id, archiveDate });

      const partiesUntilThisPoint = await loadParties(ctx, partyWfStatesSubset.all);
      expect(partiesUntilThisPoint.length).to.equal(3);

      const archiveReasonIdResult = getKeyByValue(DALTypes.ArchivePartyReasons, DALTypes.ArchivePartyReasons.RESIDENTS_HAVE_MOVED_OUT);
      const updatedRenewalParty = await getPartyBy(ctx, { id: renewalParty.id });
      expect(updatedRenewalParty.archiveDate).not.to.be.null;
      expect(updatedRenewalParty.workflowState).to.equal(DALTypes.WorkflowState.ARCHIVED);
      expect(updatedRenewalParty.metadata.archiveReasonId).to.equal(archiveReasonIdResult);

      const updateActiveLeaseParty = await getPartyBy(ctx, { id: activeLeaseParty.id });
      expect(updateActiveLeaseParty.archiveDate).not.to.be.null;
      expect(updateActiveLeaseParty.workflowState).to.equal(DALTypes.WorkflowState.ARCHIVED);
      expect(updateActiveLeaseParty.metadata.archiveReasonId).to.equal(archiveReasonIdResult);

      return { newLeaseParty, activeLeaseParty, renewalParty };
    };

    describe('When the archive date is more than 120 days in the past', () => {
      const archiveDate = now().add(-121, 'days').toISOString();

      describe('When a call comes in from a known originator', async () => {
        it('should create a new party', async () => {
          const { newLeaseParty, activeLeaseParty, renewalParty } = await setupParties(archiveDate);

          await createProgramDataFromPartyData(newLeaseParty);
          await makeACall(newLeaseParty);

          await checkNewPartyAdeedAndCommOnCorrectPartyForExistingPerson(4, newLeaseParty, activeLeaseParty, renewalParty);
        });
      });

      describe('When a sms comes in from a known originator for a program on the same property', async () => {
        it('should create a new party', async () => {
          const { newLeaseParty, activeLeaseParty, renewalParty } = await setupParties(archiveDate);

          await createProgramDataFromPartyData(newLeaseParty);
          await createAndSendSMS(newLeaseParty);

          await checkNewPartyAdeedAndCommOnCorrectPartyForExistingPerson(4, newLeaseParty, activeLeaseParty, renewalParty);
        });
      });

      describe('When a email comes in from a known originator for a program on the same property', async () => {
        it('should create a new party', async () => {
          const { newLeaseParty, activeLeaseParty, renewalParty } = await setupParties(archiveDate);

          await createProgramDataFromPartyData(newLeaseParty);
          await createAndSendMail(newLeaseParty, programEmailIdentifier);

          await checkNewPartyAdeedAndCommOnCorrectPartyForExistingPerson(4, newLeaseParty, activeLeaseParty, renewalParty);
        });
      });

      describe('When a email comes in from a known originator for a party mail identifier', async () => {
        it('should create a new party', async () => {
          const { newLeaseParty, activeLeaseParty, renewalParty } = await setupParties(archiveDate);

          await createProgramDataFromPartyData(newLeaseParty);
          await createAndSendMail(newLeaseParty, renewalParty.emailIdentifier);

          await checkNewPartyAdeedAndCommOnCorrectPartyForExistingPerson(4, newLeaseParty, activeLeaseParty, renewalParty);
        });
      });
    });

    describe('When the archive date is less than 120 days in the past', () => {
      const archiveDate = now().add(-10, 'days').toISOString();

      describe('When a call comes in from a known originator', async () => {
        it('should add the comm to the last archived active lease', async () => {
          const { newLeaseParty, activeLeaseParty } = await setupParties(archiveDate);

          await createProgramDataFromPartyData(newLeaseParty);
          await makeACall(newLeaseParty);

          await checkCommAddedOnArchivedActiveLeaseForExistingPerson(3, activeLeaseParty.id);
        });
      });

      describe('When a sms comes in from a known originator for a program on the same property', async () => {
        it('should add the comm to the last archived active lease', async () => {
          const { newLeaseParty, activeLeaseParty } = await setupParties(archiveDate);

          await createProgramDataFromPartyData(newLeaseParty);
          await createAndSendSMS(newLeaseParty);

          await checkCommAddedOnArchivedActiveLeaseForExistingPerson(3, activeLeaseParty.id);
        });
      });

      describe('When a email comes in from a known originator for a program on the same property', async () => {
        it('should add the comm to the last archived active lease', async () => {
          const { newLeaseParty, activeLeaseParty } = await setupParties(archiveDate);

          await createProgramDataFromPartyData(newLeaseParty);
          await createAndSendMail(newLeaseParty, programEmailIdentifier);

          await checkCommAddedOnArchivedActiveLeaseForExistingPerson(3, activeLeaseParty.id);
        });
      });

      describe('When a email comes in from a known originator for a party email identifier', async () => {
        it('should add the comm to the last archived active lease', async () => {
          const { newLeaseParty, activeLeaseParty } = await setupParties(archiveDate);

          await createProgramDataFromPartyData(newLeaseParty);
          await createAndSendMail(newLeaseParty, newLeaseParty.emailIdentifier);

          await checkCommAddedOnArchivedActiveLeaseForExistingPerson(3, activeLeaseParty.id);
        });
      });

      describe('When there are two Active Leases archived', async () => {
        it('should add the comm to last archived active lease', async () => {
          const { newLeaseParty, renewalParty } = await setupParties(archiveDate);

          // to avoid complex setup, I'll change the workflow name of the Renewal, to have 2 Active Leases archived
          const secondActiveLeaseId = renewalParty.id;
          const secondActiveLeaseArchiveDate = now().add(-5, 'days').toISOString();
          await updateParty(ctx, {
            id: secondActiveLeaseId,
            workflowName: DALTypes.WorkflowName.ACTIVE_LEASE,
            archiveDate: secondActiveLeaseArchiveDate,
          });

          await createProgramDataFromPartyData(newLeaseParty);
          await createAndSendMail(newLeaseParty, newLeaseParty.emailIdentifier);

          await checkCommAddedOnArchivedActiveLeaseForExistingPerson(3, secondActiveLeaseId);
        });
      });
    });
  });
});
