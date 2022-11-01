/*
 * Copyright (c) 2022 Reva Technology Inc., all rights reserved.
 * Unauthorized copying of this file, via any medium is strictly prohibited
 * Licensed under the Elastic License 2.0; you may not use this file except
 * in compliance with the Elastic License 2.0.
 */

import { expect } from 'chai';
import request from 'supertest';
import app, { processDBEvents } from '../../api';
import decisionApp from '../../../decision_service/api';
import { getAuthHeader, waitFor } from '../../../testUtils/apiHelper';
import { getPartyLeases, getLeasesThatDoNotMatchStatus, updateLease } from '../../../dal/leaseRepo';
import { getTasksByPartyIds } from '../../../dal/tasksRepo';
import { loadAllQuotePromotions, loadPartiesByIds, getPartyBy, archiveParty } from '../../../dal/partyRepo';
import { tenant, enableAggregationTriggers } from '../../../testUtils/setupTestGlobalContext';
import {
  createLeaseTestData,
  createLease,
  publishLease,
  signLeaseByAllPartyMembers,
  counterSignLease,
  insertQuotePromotion,
  checkForPartyDocumentEventToBeSent,
} from '../../../testUtils/leaseTestHelper';

import { createAParty, createActiveLeaseData } from '../../../testUtils/repoHelper';

import { DALTypes } from '../../../../common/enums/DALTypes';
import { getKeyByValue } from '../../../../common/enums/enumHelper';
import { getEndDateFromStartDate } from '../../../../common/helpers/quotes';
import { DATE_US_FORMAT } from '../../../../common/date-constants';
import { signLease, fixLeaseStatusIfNeeded } from '../../../services/leases/leaseService';
import { getSignedDocumentsForLease } from '../../../dal/documentsRepo';
import { getS3Provider } from '../../../workers/upload/s3Provider';
import { getPrivateBucket } from '../../../workers/upload/uploadUtil';
import { getSignatureUrl } from '../../../services/leases/urls';
import { setWasLeaseCountersigned } from '../../../services/leases/fadv/fakeLeaseRequestor';
import { now } from '../../../../common/helpers/moment-utils';
import { setSubscriptionRequest, resetEventDeliveryMechanism } from '../../../workers/party/documentHistoryHandler';
import { setLeasingApiRequest } from '../../../decision_service/utils';
import { refreshSubscriptions } from '../../../dal/subscriptionsRepo';
import { createRenewalLeaseParty } from '../../../services/workflows';
import {
  callProcessWorkflowsJob,
  createNewLeaseParty,
  createActiveLeasePartyFromNewLease,
  setupMsgQueueAndWaitFor,
} from '../../../testUtils/partyWorkflowTestHelper';

describe('API/leases', () => {
  let matcher;
  let pgClient;

  beforeEach(async () => {
    setSubscriptionRequest(request(decisionApp));
    setLeasingApiRequest(() => request(app));
    resetEventDeliveryMechanism();
    const result = await setupMsgQueueAndWaitFor([], ['lease', 'tasks', 'history']);
    matcher = result.matcher;
    await enableAggregationTriggers(tenant.id);
    await refreshSubscriptions(tenant);
    pgClient = await processDBEvents();
  });
  afterEach(async () => {
    setWasLeaseCountersigned(false);
    await pgClient.close();
  });

  const expectedKeys = [
    'id',
    'quoteId',
    'leaseTermId',
    'partyId',
    'leaseTemplateId',
    'leaseData',
    'baselineData',
    'created_at',
    'external',
    'updated_at',
    'signDate',
    'status',
    'modified_by',
    'externalLeaseId',
  ];

  const publishedLease = {
    leaseStartDate: now().format(DATE_US_FORMAT),
    leaseEndDate: now().add(50, 'days').format(DATE_US_FORMAT),
    moveInDate: now().format(DATE_US_FORMAT),
    moveinRentEndDate: now().add(55, 'days').toDate(),
    unitRent: 500,
    rentersInsuranceFacts: 'buyInsuranceFlag',
    concessions: {},
    additionalCharges: {},
    oneTimeCharges: {
      unitDeposit: {
        amount: 2500,
        feeType: DALTypes.FeeType.DEPOSIT,
        quoteSectionName: DALTypes.QuoteSection.DEPOSIT,
        firstFee: true,
      },
    },
  };

  context('CRUD', () => {
    const promoteQuote = async (partyId, quoteId, leaseTermId, userId) => {
      const quotePromotionData = {
        quoteId,
        leaseTermId,
        promotionStatus: DALTypes.PromotionStatus.APPROVED,
        createApprovalTask: false,
      };

      const {
        resolvers,
        promises: [waitForFirstEvent],
      } = waitFor([checkForPartyDocumentEventToBeSent]);
      matcher.addWaiters(resolvers);
      const { body } = await request(app)
        .post(`/parties/${partyId}/quotePromotions`)
        .set(getAuthHeader(tenant.id, userId))
        .send(quotePromotionData)
        .expect(200);
      await waitForFirstEvent;
      return body;
    };

    describe('publishing a created lease', () => {
      it('should return 200', async () => {
        const { partyId, userId, promotedQuote, team } = await createLeaseTestData();

        // CREATE LEASE
        const lease = await createLease(partyId, userId, promotedQuote.id, team);
        expect(lease).to.have.all.keys(expectedKeys);

        // FETCH LEASE
        await request(app)
          .get(`/parties/${partyId}/leases`)
          .set(getAuthHeader(tenant.id, userId))
          .expect(200)
          .expect(res => expect(res.body.length).to.equal(1))
          .expect(res => expect(res.body[0]).to.have.all.keys([...expectedKeys, 'signatures']))
          .expect(res => expect(res.body[0].id).to.equal(lease.id))
          .expect(res => expect(res.body[0].modified_by).to.equal(userId));

        // PUBLISH LEASE
        const leaseTestData = {
          partyId,
          lease,
          userId,
          team,
          publishedLease,
          matcher,
        };
        const publishedLeaseRes = await publishLease(leaseTestData);
        expect(publishedLeaseRes).to.have.all.keys(expectedKeys);
        expect(publishedLeaseRes.status).to.equal(DALTypes.LeaseStatus.DRAFT);
      });
    });

    describe('publishing an already published lease', () => {
      it('should return 200', async () => {
        const { partyId, userId, promotedQuote, team } = await createLeaseTestData();

        const lease = await createLease(partyId, userId, promotedQuote.id, team);
        expect(lease).to.have.all.keys(expectedKeys);

        const leaseTestData = {
          partyId,
          lease,
          userId,
          team,
          publishedLease,
          matcher,
        };
        await publishLease(leaseTestData);
        publishedLease.unitRent = 1000;
        const updatedLease = await publishLease(leaseTestData);

        expect(updatedLease).to.be.ok;
        expect(updatedLease.status).to.equal(DALTypes.LeaseStatus.SUBMITTED);
      });
    });

    describe('creating a lease', () => {
      // skipping this for now as we have to rework on the value field mapping
      it.skip('should create baseline and lease data', async () => {
        const {
          partyId,
          leaseTerm,
          userId,
          quote,
          inventory,
          residents,
          guarantors,
          partyPets,
          securityDepositAmount,
          promotedQuote,
          holdDepositFee,
          applicationFee,
        } = await createLeaseTestData();

        const { body: lease } = await request(app)
          .post(`/parties/${partyId}/leases`)
          .set(getAuthHeader(tenant.id, userId))
          .send({
            promotedQuoteId: promotedQuote.id,
            partyId,
          })
          .expect(200);

        const quoteData = quote.publishedQuoteData;

        const documents = lease.leaseData.documents;
        expect(lease.baselineData.quote.unitNumber).to.deep.equal(inventory.name);
        expect(documents['6A02AD1A-8019-41F5-9B03-CB07F9D5B579'].UNITNUMBER.value).to.deep.equal(lease.baselineData.quote.unitNumber);

        expect(lease.baselineData.quote.leaseTerm).to.deep.equal(`${leaseTerm.termLength} ${leaseTerm.period}s`);
        expect(lease.leaseData.fields.INITIALLEASETERM.value).to.deep.equal(lease.baselineData.quote.leaseTerm);

        expect(lease.baselineData.quote.leaseStartDate).to.deep.equal(quoteData.leaseStartDate);
        expect(lease.leaseData.fields.BEGINLEASEDATE.value).to.deep.equal(lease.baselineData.quote.leaseStartDate);

        expect(lease.baselineData.quote.leaseEndDate).to.deep.equal(getEndDateFromStartDate(quoteData.leaseStartDate, leaseTerm).toISOString());
        expect(lease.leaseData.fields.ENDLEASEDATE.value).to.deep.equal(lease.baselineData.quote.leaseEndDate);

        expect(lease.leaseData.fields.RWMOVEINDATE.value).to.deep.equal(lease.baselineData.quote.leaseStartDate);
        expect(lease.leaseData.fields.RWMOVEOUTDATE.value).to.deep.equal(lease.baselineData.quote.leaseEndDate);

        expect(lease.baselineData.residents[0].name).to.deep.equal(residents[0].fullName);
        expect(lease.leaseData.fields.RESIDENTNAME01.value).to.deep.equal(lease.baselineData.residents[0].name);

        expect(lease.baselineData.residents[0].phone).to.deep.equal(residents[0].contactInfo.defaultPhone);
        expect(lease.leaseData.fields.RESIDENT01PHONE.value).to.deep.equal(lease.baselineData.residents[0].phone);

        expect(lease.baselineData.guarantors[0].name).to.deep.equal(guarantors[0].fullName);
        expect(lease.leaseData.fields.GUARANTOR01NAME.value).to.deep.equal(lease.baselineData.guarantors[0].name);

        expect(lease.baselineData.guarantors[0].phone).to.deep.equal(guarantors[0].contactInfo.defaultPhone);
        expect(lease.leaseData.fields.GUARANTOR01PHONE.value).to.deep.equal(lease.baselineData.guarantors[0].phone);

        expect(lease.baselineData.quote.securityDepositAmount).to.deep.equal(securityDepositAmount);
        expect(lease.leaseData.fields.SECURITYDEPOSIT.value).to.deep.equal(lease.baselineData.quote.securityDepositAmount);

        expect(lease.leaseData.fields.FIRSTRENTSTARTDATE.value).to.deep.equal(lease.baselineData.quote.leaseStartDate);

        expect(lease.baselineData.quote.monthlyRate).to.deep.equal(84);
        expect(lease.leaseData.fields.MONTHLYRATE.value).to.deep.equal(lease.baselineData.quote.monthlyRate);

        expect(lease.baselineData.quote.holdDepositAmount).to.deep.equal(holdDepositFee.absolutePrice);
        expect(lease.leaseData.fields.ADVANCERENT.value).to.deep.equal(lease.baselineData.quote.holdDepositAmount);

        expect(lease.baselineData.quote.applicationFeeAmount).to.deep.equal(applicationFee.absolutePrice);
        expect(lease.leaseData.fields.APPLICATIONFEES.value).to.deep.equal(lease.baselineData.quote.applicationFeeAmount);

        expect(lease.baselineData.pets[0].name).to.deep.equal(partyPets[0].info.name);
        expect(lease.leaseData.fields.PETNAME.value).to.deep.equal(lease.baselineData.pets[0].name);

        expect(lease.baselineData.pets[0].type).to.deep.equal(partyPets[0].info.type);
        expect(lease.leaseData.fields.PETTYPE.value).to.deep.equal(lease.baselineData.pets[0].type);

        expect(lease.baselineData.pets[0].breed).to.deep.equal(partyPets[0].info.breed);
        expect(lease.leaseData.fields.PETBREED.value).to.deep.equal(lease.baselineData.pets[0].breed);

        expect(lease.baselineData.pets[0].weight).to.deep.equal(partyPets[0].info.size);
        expect(lease.leaseData.fields.PETWEIGHT.value).to.deep.equal(lease.baselineData.pets[0].weight);

        expect(lease.leaseData.fields.PETADD.value).to.deep.equal(lease.baselineData.pets.length);
      });
    });

    describe('Countersign task', () => {
      describe('when the lease is signed by all party members', () => {
        /*
        Hey team, could someone please look at the test helper function signLeaseByAllPartyMembers  in server/api/__integration__/leasing/leases-test.js ?  To check that the signatures are complete, the function only waits for for the partyDocuments related to the signature events to be sent, and not for the subsequent decision service activity (e.g. creating a countersignature task) to finish.  As a result, there is a race condition, and the test will fail this function returns before the decision service activity is complete.  I will disable this test in my branch. (cc @mircea who most recently touched this) (edited
          */
        it.skip('the Countersign task should be created', async () => {
          const { partyId, userId, promotedQuote } = await createLeaseTestData();

          const lease = await createLease(partyId, userId, promotedQuote.id);
          const leaseTestData = {
            partyId,
            lease,
            userId,
            publishedLease,
            matcher,
          };

          await publishLease(leaseTestData);
          await signLeaseByAllPartyMembers(lease.id, partyId, matcher);

          const partyTasks = await getTasksByPartyIds({ tenantId: tenant.id }, [partyId]);
          expect(partyTasks.length).to.equal(1);
          expect(partyTasks[0].name).to.equal(DALTypes.TaskNames.COUNTERSIGN_LEASE);
          expect(partyTasks[0].state).to.equal(DALTypes.TaskStates.ACTIVE);
        });
      });

      describe('when the lease is countersigned', () => {
        it.skip('the Countersign task should be marked as completed and the lease should be marked as executed', async () => {
          const { partyId, userId, promotedQuote } = await createLeaseTestData();

          const lease = await createLease(partyId, userId, promotedQuote.id);
          const leaseTestData = {
            partyId,
            lease,
            userId,
            publishedLease,
            matcher,
          };
          await publishLease(leaseTestData);
          await signLeaseByAllPartyMembers(lease.id, partyId, matcher);

          // Countersign lease
          let [partyLease] = await getPartyLeases({ tenantId: tenant.id }, partyId);
          const ctx = { tenantId: tenant.id };
          const countersignerSignatures = partyLease.signatures.filter(item => item.userId);

          const {
            resolvers,
            promises: [waitForFirstEvent, waitForSecondEvent],
          } = waitFor([checkForPartyDocumentEventToBeSent, checkForPartyDocumentEventToBeSent]);
          matcher.addWaiters(resolvers);
          await signLease({
            ctx,
            envelopeId: countersignerSignatures[0].envelopeId,
            clientUserId: countersignerSignatures[0].metadata.clientUserId,
          });
          await waitForFirstEvent;

          // the lease should be marked as 'executed' only after both documents are countersigned
          [partyLease] = await getPartyLeases({ tenantId: tenant.id }, partyId);
          expect(partyLease.status).to.equal(DALTypes.LeaseStatus.SUBMITTED);

          await signLease({
            ctx,
            envelopeId: countersignerSignatures[1].envelopeId,
            clientUserId: countersignerSignatures[1].metadata.clientUserId,
          });
          await waitForSecondEvent;

          // Countersign task should be marked as completed
          const partyTasks = await getTasksByPartyIds({ tenantId: tenant.id }, [partyId]);
          expect(partyTasks.length).to.equal(1);

          const counterSigned = partyTasks.filter(task => task.name === DALTypes.TaskNames.COUNTERSIGN_LEASE);
          expect(counterSigned.length).to.equal(1);
          counterSigned.forEach(task => {
            expect(task.name).to.equal(DALTypes.TaskNames.COUNTERSIGN_LEASE);
            expect(task.state).to.equal(DALTypes.TaskStates.COMPLETED);
            expect(task.completionDate).to.not.be.null;
          });

          // the lease should be marked as 'executed'
          [partyLease] = await getPartyLeases({ tenantId: tenant.id }, partyId);
          expect(partyLease.status).to.equal(DALTypes.LeaseStatus.EXECUTED);
          expect(partyLease.signDate).to.not.be.null;
        });

        describe('when a new request to get the countersigner token is made after the lease was countersigner', () => {
          it.skip('should respond with status code 412 and LEASE_ALREADY_COUNTERSIGNED token', async () => {
            const { partyId, userId, promotedQuote } = await createLeaseTestData({
              appSettings: { shouldInsertQuotePromotion: true, shouldAddGuarantorToParty: false },
            });

            const lease = await createLease(partyId, userId, promotedQuote.id);
            const leaseTestData = {
              partyId,
              lease,
              userId,
              publishedLease,
              matcher,
            };
            await publishLease(leaseTestData);

            const [partyLease] = await getPartyLeases({ tenantId: tenant.id }, partyId);
            const countersignerSignatures = partyLease.signatures.filter(item => item.userId);

            setWasLeaseCountersigned(true);
            const { status, body } = await request(app)
              .get(`/leases/${countersignerSignatures[0].envelopeId}/token/${countersignerSignatures[0].metadata.clientUserId}`)
              .set(getAuthHeader(tenant.id, userId));

            expect(status).to.equal(412);
            expect(body.token).to.equal('LEASE_ALREADY_COUNTERSIGNED');
          });
        });

        xit('the signed lease documents should be saved to S3', async () => {
          const { partyId, userId, promotedQuote } = await createLeaseTestData();

          const lease = await createLease(partyId, userId, promotedQuote.id);
          const leaseTestData = {
            partyId,
            lease,
            userId,
            publishedLease,
            matcher,
          };
          await publishLease(leaseTestData);
          await signLeaseByAllPartyMembers(lease.id, partyId, matcher);

          const partyLease = await counterSignLease(lease.id, partyId);

          // signed lease documents should be saved to S3
          const ctx = { tenantId: tenant.id };
          const bucket = getPrivateBucket();
          const dbDocuments = await getSignedDocumentsForLease(ctx, partyLease.id);
          dbDocuments.forEach(doc => expect(getS3Provider().getObject(ctx, bucket, doc.metadata.path)).to.not.be.null);
        });
      });
    });

    describe('when the lease is countersigned but lease is not marked as executed', () => {
      it('calling fixLeaseStatusIfNeeded marks the lease as executed', async () => {
        const { partyId, userId, promotedQuote } = await createLeaseTestData();

        const lease = await createLease(partyId, userId, promotedQuote.id);
        const leaseTestData = {
          partyId,
          lease,
          userId,
          publishedLease,
          matcher,
        };
        await publishLease(leaseTestData);
        await signLeaseByAllPartyMembers(lease.id, partyId, matcher);

        // Countersign lease
        let [partyLease] = await getPartyLeases({ tenantId: tenant.id }, partyId);
        const ctx = { tenantId: tenant.id };
        const countersignerSignatures = partyLease.signatures.filter(item => item.userId);

        const {
          resolvers,
          promises: [waitForFirstEvent, waitForSecondEvent],
        } = waitFor([checkForPartyDocumentEventToBeSent, checkForPartyDocumentEventToBeSent]);
        matcher.addWaiters(resolvers);
        await signLease({
          ctx,
          envelopeId: countersignerSignatures[0].envelopeId,
          clientUserId: countersignerSignatures[0].metadata.clientUserId,
        });
        await waitForFirstEvent;
        await signLease({
          ctx,
          envelopeId: countersignerSignatures[1].envelopeId,
          clientUserId: countersignerSignatures[1].metadata.clientUserId,
        });
        await waitForSecondEvent;

        // the lease should be marked as 'executed'
        [partyLease] = await getPartyLeases({ tenantId: tenant.id }, partyId);
        expect(partyLease.status).to.equal(DALTypes.LeaseStatus.EXECUTED);
        expect(partyLease.signDate).to.not.be.null;

        const updatedLease = await updateLease(ctx, { id: partyLease.id, status: DALTypes.LeaseStatus.SUBMITTED });
        expect(updatedLease.status).to.equal(DALTypes.LeaseStatus.SUBMITTED);

        await fixLeaseStatusIfNeeded({ ...ctx, authUser: { id: userId } });

        const [fixedPartyLease] = await getPartyLeases({ tenantId: tenant.id }, partyId);
        expect(fixedPartyLease.status).to.equal(DALTypes.LeaseStatus.EXECUTED);
      });
    });

    describe('Void lease', () => {
      describe('When a lease is voided', () => {
        it('should void the lease, cancel the quote promotion and archive the active lease workflow if exists', async () => {
          const { partyId, userId, promotedQuote, team, inventory } = await createLeaseTestData({
            leaseStartDate: now().add(-1, 'day').toISOString(),
          });

          const lease = await createLease(partyId, userId, promotedQuote.id);
          const seedParty = await createAParty({ workflowName: DALTypes.WorkflowName.ACTIVE_LEASE, seedPartyId: partyId });

          await createActiveLeaseData({ partyId: seedParty.id, leaseId: lease.id, leaseData: { leaseEndDate: now(), inventoryId: inventory.id } });
          const leaseTestData = {
            partyId,
            lease,
            userId,
            team,
            publishedLease,
            matcher,
          };
          await publishLease(leaseTestData);
          await callProcessWorkflowsJob();
          const ctx = { tenantId: tenant.id };

          const activeLeaseParty = await getPartyBy(ctx, { seedPartyId: partyId });
          expect(activeLeaseParty).to.be.ok;

          // Void lease
          await request(app)
            .post(`/parties/${partyId}/leases/${lease.id}/void`)
            .set(getAuthHeader(tenant.id, userId, [team]))
            .send()
            .expect(200);

          // the lease should be voided, the promoted quote should be canceled
          const [voidedLease] = await getPartyLeases(ctx, partyId);
          expect(voidedLease.status).to.equal(DALTypes.LeaseStatus.VOIDED);

          const [canceledPromotion] = await loadAllQuotePromotions(ctx, partyId);
          expect(canceledPromotion.promotionStatus).to.equal(DALTypes.PromotionStatus.CANCELED);

          const updatedActiveLeaseParty = await getPartyBy(ctx, { seedPartyId: partyId });
          const archiveReasonIdResult = getKeyByValue(DALTypes.ArchivePartyReasons, DALTypes.ArchivePartyReasons.CORRESPONDING_LEASE_DOCUMENT_WAS_VOIDED);

          expect(updatedActiveLeaseParty.archiveDate).not.to.be.null;
          expect(updatedActiveLeaseParty.workflowState).to.equal(DALTypes.WorkflowState.ARCHIVED);
          expect(updatedActiveLeaseParty.metadata.archiveReasonId).to.equal(archiveReasonIdResult);
        });
      });

      describe('When there is a voided lease and the status to filter is "voided"', () => {
        it('should return all the lease except the voided one', async () => {
          const { partyId, userId, promotedQuote, team, leaseTerm, quote } = await createLeaseTestData();

          const lease = await createLease(partyId, userId, promotedQuote.id);

          // Void lease
          await request(app)
            .post(`/parties/${partyId}/leases/${lease.id}/void`)
            .set(getAuthHeader(tenant.id, userId, [team]))
            .send()
            .expect(200);

          const secondPromotedQuote = await insertQuotePromotion(partyId, quote.id, leaseTerm.id);
          const secondLease = await createLease(partyId, userId, secondPromotedQuote.id);
          const leaseTestData = {
            partyId,
            lease: secondLease,
            userId,
            team,
            publishedLease,
            matcher,
          };
          await publishLease(leaseTestData);

          const ctx = { tenantId: tenant.id };
          const [submittedLease] = await getLeasesThatDoNotMatchStatus(ctx, partyId, DALTypes.LeaseStatus.VOIDED);
          expect(submittedLease.status).to.equal(DALTypes.LeaseStatus.SUBMITTED);
        });
      });
    });

    describe('when a quote is promoted', () => {
      it('should create a lease and set assignedPropertId to associated party', async () => {
        const { userId, partyId, quote, leaseTerm, inventory } = await createLeaseTestData({ appSettings: { shouldInsertQuotePromotion: false } });

        await promoteQuote(partyId, quote.id, leaseTerm.id, userId);

        const leases = await getPartyLeases({ tenantId: tenant.id }, partyId);
        expect(leases.length).to.equal(1);
        const parties = await loadPartiesByIds({ tenantId: tenant.id }, [partyId]);
        expect(parties[0].assignedPropertyId).to.equal(inventory.propertyId);
      });
    });

    describe('when leases/signature-token is called for a voided lease', () => {
      it('should return a 200 status, a voided status and a redirect token', async () => {
        const { partyId, userId, promotedQuote, team, residents } = await createLeaseTestData();

        const lease = await createLease(partyId, userId, promotedQuote.id);
        const leaseTestData = {
          partyId,
          lease,
          userId,
          team,
          publishedLease,
          matcher,
        };
        await publishLease(leaseTestData);

        const [partyMember] = residents;
        const { token } = await getSignatureUrl({ tenantId: tenant.id }, lease.id, partyMember.id);

        // first time is valid
        await request(app).get(`/leases/signature-token?token=${token}`).set(getAuthHeader(tenant.id)).send().expect(200);

        /* Void lease */
        await request(app)
          .post(`/parties/${partyId}/leases/${lease.id}/void`)
          .set(getAuthHeader(tenant.id, userId, [team]))
          .send()
          .expect(200);

        // now we don't have the signature statuses anymore
        const response = await request(app).get(`/leases/signature-token?token=${token}`).set(getAuthHeader(tenant.id)).send();
        console.log('response: ', response);
        expect(response.status).to.equal(200);
        expect(response.body.token).to.not.be.undefined;
        expect(response.body.status).to.equal('voided');
      });
    });

    describe('Void executed lease', () => {
      describe('When a lease is voided from the active lease page', () => {
        describe('if the active lease party id is incorrect', () => {
          it('should return 400 and INCORRECT_PARTY_ID token', async () => {
            const newLeaseStartDate = now().add(-2, 'days').toISOString();
            const leaseEndDate = now().add(-1, 'days').format(DATE_US_FORMAT);
            const { partyId, party: newLeaseParty, leaseId, team } = await createNewLeaseParty({
              leaseStartDate: newLeaseStartDate,
              leaseEndDate,
              shouldSignLease: true,
              shouldCounterSignLease: true,
            });
            expect(newLeaseParty).to.be.ok;

            const response = await request(app)
              .post(`/parties/${partyId}/leases/${leaseId}/voidExecutedLease`)
              .set(getAuthHeader(tenant.id, newLeaseParty.userId, [team]))
              .send();

            expect(response.status).to.equal(400);
            expect(response.body.token).to.equal('INCORRECT_PARTY_ID');
          });
        });

        describe('if the new lease party id is incorrect', () => {
          it('should return 400 and INCORRECT_PARTY_ID token', async () => {
            const newLeaseStartDate = now().add(-2, 'days').toISOString();
            const leaseEndDate = now().add(-1, 'days').format(DATE_US_FORMAT);

            const { party: newLeaseParty, leaseId, team } = await createNewLeaseParty({
              leaseStartDate: newLeaseStartDate,
              leaseEndDate,
              shouldSignLease: true,
              shouldCounterSignLease: true,
            });
            expect(newLeaseParty).to.be.ok;

            const { activeLeaseParty } = await createActiveLeasePartyFromNewLease({ newLeaseParty });

            const response = await request(app)
              .post(`/parties/12345/leases/${leaseId}/voidExecutedLease`)
              .set(getAuthHeader(tenant.id, newLeaseParty.userId, [team]))
              .send({ activeLeasePartyId: activeLeaseParty.id });

            expect(response.status).to.equal(400);
            expect(response.body.token).to.equal('INCORRECT_PARTY_ID');
          });
        });

        describe('if the lease id is incorrect', () => {
          it('should return 400 and INCORRECT_LEASE_ID token', async () => {
            const newLeaseStartDate = now().add(-2, 'days').toISOString();
            const leaseEndDate = now().add(-1, 'days').format(DATE_US_FORMAT);

            const { partyId, party: newLeaseParty, team } = await createNewLeaseParty({
              leaseStartDate: newLeaseStartDate,
              leaseEndDate,
              shouldSignLease: true,
              shouldCounterSignLease: true,
            });
            expect(newLeaseParty).to.be.ok;

            const { activeLeaseParty } = await createActiveLeasePartyFromNewLease({ newLeaseParty });

            const response = await request(app)
              .post(`/parties/${partyId}/leases/1234/voidExecutedLease`)
              .set(getAuthHeader(tenant.id, newLeaseParty.userId, [team]))
              .send({ activeLeasePartyId: activeLeaseParty.id });

            expect(response.status).to.equal(400);
            expect(response.body.token).to.equal('INCORRECT_LEASE_ID');
          });
        });

        describe('if the new lease party is archived and the active lease is active', () => {
          it('should return 200, unarchive the new lease and archive the active lease party', async () => {
            const newLeaseStartDate = now().add(-2, 'days').toISOString();
            const leaseEndDate = now().add(-1, 'days').format(DATE_US_FORMAT);

            const { partyId, party: newLeaseParty, team, leaseId } = await createNewLeaseParty({
              leaseStartDate: newLeaseStartDate,
              leaseEndDate,
              shouldSignLease: true,
              shouldCounterSignLease: true,
            });
            expect(newLeaseParty).to.be.ok;

            const { activeLeaseParty } = await createActiveLeasePartyFromNewLease({ newLeaseParty });

            const ctx = { tenantId: tenant.id };
            await archiveParty(ctx, newLeaseParty.id, getKeyByValue(DALTypes.ArchivePartyReasons, DALTypes.ArchivePartyReasons.RESIDENT_CREATED));

            const updatedNewLeaseParty = await getPartyBy(ctx, { id: newLeaseParty.id });
            expect(updatedNewLeaseParty.workflowState).to.equal(DALTypes.WorkflowState.ARCHIVED);
            expect(updatedNewLeaseParty.archiveDate).to.be.not.null;

            const updatedActiveLeaseParty = await getPartyBy(ctx, { id: activeLeaseParty.id });
            expect(updatedActiveLeaseParty.workflowState).to.equal(DALTypes.WorkflowState.ACTIVE);
            expect(updatedActiveLeaseParty.archiveDate).to.be.null;
            expect(updatedActiveLeaseParty.seedPartyId).to.equal(newLeaseParty.id);

            const response = await request(app)
              .post(`/parties/${partyId}/leases/${leaseId}/voidExecutedLease`)
              .set(getAuthHeader(tenant.id, newLeaseParty.userId, [team]))
              .send({ activeLeasePartyId: activeLeaseParty.id });
            expect(response.status).to.equal(200);
            expect(response.body.navigateToPartyId).to.equal(newLeaseParty.id);

            const newLeasePartyAfterVoid = await getPartyBy(ctx, { id: newLeaseParty.id });
            expect(newLeasePartyAfterVoid.workflowState).to.equal(DALTypes.WorkflowState.ACTIVE);
            expect(newLeasePartyAfterVoid.archiveDate).to.be.null;

            const activeLeasePartyAfterVoid = await getPartyBy(ctx, { id: activeLeaseParty.id });
            expect(activeLeasePartyAfterVoid.workflowState).to.equal(DALTypes.WorkflowState.ARCHIVED);
            expect(activeLeasePartyAfterVoid.archiveDate).to.be.not.null;
            const archiveReasonId = getKeyByValue(DALTypes.ArchivePartyReasons, DALTypes.ArchivePartyReasons.CORRESPONDING_LEASE_DOCUMENT_WAS_VOIDED);
            expect(activeLeasePartyAfterVoid.metadata.archiveReasonId).to.equal(archiveReasonId);
            expect(activeLeasePartyAfterVoid.seedPartyId).to.equal(newLeaseParty.id);
          });
        });

        describe('if the new lease party is archived and the active lease and renewal associated are active', () => {
          it('should return 200, unarchive the new lease and archive the active lease and renewal', async () => {
            const newLeaseStartDate = now().add(-2, 'days').toISOString();
            const leaseEndDate = now().add(-1, 'days').format(DATE_US_FORMAT);

            const { partyId, party: newLeaseParty, team, leaseId } = await createNewLeaseParty({
              leaseStartDate: newLeaseStartDate,
              leaseEndDate,
              shouldSignLease: true,
              shouldCounterSignLease: true,
            });
            expect(newLeaseParty).to.be.ok;

            const { activeLeaseParty } = await createActiveLeasePartyFromNewLease({ newLeaseParty });

            const ctx = { tenantId: tenant.id };
            const renewalParty = await createRenewalLeaseParty(ctx, activeLeaseParty.id);

            await archiveParty(ctx, newLeaseParty.id, getKeyByValue(DALTypes.ArchivePartyReasons, DALTypes.ArchivePartyReasons.RESIDENT_CREATED));

            const updatedNewLeaseParty = await getPartyBy(ctx, { id: newLeaseParty.id });
            expect(updatedNewLeaseParty.workflowState).to.equal(DALTypes.WorkflowState.ARCHIVED);
            expect(updatedNewLeaseParty.archiveDate).to.be.not.null;

            const updatedActiveLeaseParty = await getPartyBy(ctx, { id: activeLeaseParty.id });
            expect(updatedActiveLeaseParty.workflowState).to.equal(DALTypes.WorkflowState.ACTIVE);
            expect(updatedActiveLeaseParty.archiveDate).to.be.null;
            expect(updatedActiveLeaseParty.seedPartyId).to.equal(newLeaseParty.id);

            const updatedRenewalParty = await getPartyBy(ctx, { id: renewalParty.id });
            expect(updatedRenewalParty.workflowState).to.equal(DALTypes.WorkflowState.ACTIVE);
            expect(updatedRenewalParty.archiveDate).to.be.null;
            expect(updatedRenewalParty.seedPartyId).to.equal(activeLeaseParty.id);

            const response = await request(app)
              .post(`/parties/${partyId}/leases/${leaseId}/voidExecutedLease`)
              .set(getAuthHeader(tenant.id, newLeaseParty.userId, [team]))
              .send({ activeLeasePartyId: activeLeaseParty.id });
            expect(response.status).to.equal(200);
            expect(response.body.navigateToPartyId).to.equal(newLeaseParty.id);

            const newLeasePartyAfterVoid = await getPartyBy(ctx, { id: newLeaseParty.id });
            expect(newLeasePartyAfterVoid.workflowState).to.equal(DALTypes.WorkflowState.ACTIVE);
            expect(newLeasePartyAfterVoid.archiveDate).to.be.null;

            const archiveReasonId = getKeyByValue(DALTypes.ArchivePartyReasons, DALTypes.ArchivePartyReasons.CORRESPONDING_LEASE_DOCUMENT_WAS_VOIDED);

            const activeLeasePartyAfterVoid = await getPartyBy(ctx, { id: activeLeaseParty.id });
            expect(activeLeasePartyAfterVoid.workflowState).to.equal(DALTypes.WorkflowState.ARCHIVED);
            expect(activeLeasePartyAfterVoid.archiveDate).to.be.not.null;
            expect(activeLeasePartyAfterVoid.metadata.archiveReasonId).to.equal(archiveReasonId);
            expect(activeLeasePartyAfterVoid.seedPartyId).to.equal(newLeaseParty.id);

            const renewalPartyAfterVoid = await getPartyBy(ctx, { id: renewalParty.id });
            expect(renewalPartyAfterVoid.workflowState).to.equal(DALTypes.WorkflowState.ARCHIVED);
            expect(renewalPartyAfterVoid.archiveDate).to.be.not.null;
            expect(renewalPartyAfterVoid.metadata.archiveReasonId).to.equal(archiveReasonId);
            expect(renewalPartyAfterVoid.seedPartyId).to.equal(activeLeaseParty.id);
          });
        });

        describe('if the new lease, active lease and renewal associated are active', () => {
          it('should return 200 and archive the active lease and renewal', async () => {
            const newLeaseStartDate = now().add(-2, 'days').toISOString();
            const leaseEndDate = now().add(-1, 'days').format(DATE_US_FORMAT);

            const { partyId, party: newLeaseParty, team, leaseId } = await createNewLeaseParty({
              leaseStartDate: newLeaseStartDate,
              leaseEndDate,
              shouldSignLease: true,
              shouldCounterSignLease: true,
            });
            expect(newLeaseParty).to.be.ok;

            const { activeLeaseParty } = await createActiveLeasePartyFromNewLease({ newLeaseParty });

            const ctx = { tenantId: tenant.id };
            const renewalParty = await createRenewalLeaseParty(ctx, activeLeaseParty.id);

            const updatedNewLeaseParty = await getPartyBy(ctx, { id: newLeaseParty.id });
            expect(updatedNewLeaseParty.workflowState).to.equal(DALTypes.WorkflowState.ACTIVE);
            expect(updatedNewLeaseParty.archiveDate).to.be.null;

            const updatedActiveLeaseParty = await getPartyBy(ctx, { id: activeLeaseParty.id });
            expect(updatedActiveLeaseParty.workflowState).to.equal(DALTypes.WorkflowState.ACTIVE);
            expect(updatedActiveLeaseParty.archiveDate).to.be.null;
            expect(updatedActiveLeaseParty.seedPartyId).to.equal(newLeaseParty.id);

            const updatedRenewalParty = await getPartyBy(ctx, { id: renewalParty.id });
            expect(updatedRenewalParty.workflowState).to.equal(DALTypes.WorkflowState.ACTIVE);
            expect(updatedRenewalParty.archiveDate).to.be.null;
            expect(updatedRenewalParty.seedPartyId).to.equal(activeLeaseParty.id);

            const response = await request(app)
              .post(`/parties/${partyId}/leases/${leaseId}/voidExecutedLease`)
              .set(getAuthHeader(tenant.id, newLeaseParty.userId, [team]))
              .send({ activeLeasePartyId: activeLeaseParty.id });
            expect(response.status).to.equal(200);
            expect(response.body.navigateToPartyId).to.equal(newLeaseParty.id);

            const newLeasePartyAfterVoid = await getPartyBy(ctx, { id: newLeaseParty.id });
            expect(newLeasePartyAfterVoid.workflowState).to.equal(DALTypes.WorkflowState.ACTIVE);
            expect(newLeasePartyAfterVoid.archiveDate).to.be.null;

            const archiveReasonId = getKeyByValue(DALTypes.ArchivePartyReasons, DALTypes.ArchivePartyReasons.CORRESPONDING_LEASE_DOCUMENT_WAS_VOIDED);

            const activeLeasePartyAfterVoid = await getPartyBy(ctx, { id: activeLeaseParty.id });
            expect(activeLeasePartyAfterVoid.workflowState).to.equal(DALTypes.WorkflowState.ARCHIVED);
            expect(activeLeasePartyAfterVoid.archiveDate).to.be.not.null;
            expect(activeLeasePartyAfterVoid.metadata.archiveReasonId).to.equal(archiveReasonId);
            expect(activeLeasePartyAfterVoid.seedPartyId).to.equal(newLeaseParty.id);

            const renewalPartyAfterVoid = await getPartyBy(ctx, { id: renewalParty.id });
            expect(renewalPartyAfterVoid.workflowState).to.equal(DALTypes.WorkflowState.ARCHIVED);
            expect(renewalPartyAfterVoid.archiveDate).to.be.not.null;
            expect(renewalPartyAfterVoid.metadata.archiveReasonId).to.equal(archiveReasonId);
            expect(renewalPartyAfterVoid.seedPartyId).to.equal(activeLeaseParty.id);
          });
        });
      });
    });
  });
});
