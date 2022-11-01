/*
 * Copyright (c) 2022 Reva Technology Inc., all rights reserved.
 * Unauthorized copying of this file, via any medium is strictly prohibited
 * Licensed under the Elastic License 2.0; you may not use this file except
 * in compliance with the Elastic License 2.0.
 */

import request from 'supertest';
import { expect } from 'chai';
import { mapSeries } from 'bluebird';
import app from '../../../../server/api/api';
import { setupConsumers } from '../../../../server/workers/consumer';
import { waitFor, getAuthHeader } from '../../../../server/testUtils/apiHelper';
import { chan, createResolverMatcher } from '../../../../server/testUtils/setupTestGlobalContext';
import { waitForQueueIdle } from '../../../../server/testUtils/queueHelper';
import { testCtx as ctx, getAPerson, createAUser } from '../../../../server/testUtils/repoHelper';
import { createJWTToken } from '../../../../common/server/jwt-helpers';
import { createScreeningTestData, createTestQuotes } from '../../test-utils/screening-test-helper';
import { updateApplicationCreationDate } from '../../test-utils/repo-helper';
import {
  sendPaymentNotification as sendPaymentNotificationAPI,
  createOrUpdatePersonApplication,
  getScreeningSummary,
  resetCreditRequest,
} from '../../test-utils/api-helper';
import { updateProperty } from '../../../../server/dal/propertyRepo';
import { updatePersonApplication } from '../../dal/person-application-repo';
import { DALTypes } from '../../../../common/enums/DALTypes';
import { sendMessage } from '../../../../server/services/pubsub';
import { APP_EXCHANGE, SCREENING_MESSAGE_TYPE } from '../../../../server/helpers/message-constants';
import { getAllScreeningResultsForParty } from '../../services/screening';
import { now } from '../../../../common/helpers/moment-utils';

const sendPublishedQuoteToScreen = async quote => {
  const message = {
    quoteId: quote.id,
    partyId: quote.partyId,
    tenantId: ctx.tenantId,
  };

  await sendMessage({
    exchange: APP_EXCHANGE,
    key: SCREENING_MESSAGE_TYPE.QUOTE_PUBLISHED,
    message,
    ctx,
  });
};

const sendRerunScreening = async (tenantId, partyId) => {
  const message = {
    tenantId,
    partyId,
  };

  await sendMessage({
    exchange: APP_EXCHANGE,
    key: SCREENING_MESSAGE_TYPE.RERUN_EXPIRED_SCREENING,
    message,
    ctx,
  });
};

const forceScreeningsToExpire = async screeningResults => {
  const creationDate = now().add(-32, 'days').toDate();

  await mapSeries(
    screeningResults,
    async screeningResult =>
      await updateApplicationCreationDate({
        tenantId: ctx.tenantId,
        submissionRequestId: screeningResult.submissionRequestId,
        submissionResponseId: screeningResult.id,
        creationDate,
      }),
  );
};

describe('screening workflow', () => {
  let matcher;

  const sendPaymentNotification = async ({ invoiceId, personApplicationId, propertyId, waitForScreeningCompleted = false }) => {
    const conditionForPaymentNotificationReceived = (paymentMsg, processed) => paymentMsg.invoiceId === invoiceId && processed;

    const conditionForScreeningResponseReceived = (screeningMsg, processed, msg) => msg.fields.routingKey === 'payment_processed' && processed;

    const conditions = [conditionForPaymentNotificationReceived, waitForScreeningCompleted ? conditionForScreeningResponseReceived : null].filter(item => item);

    const { resolvers, promises } = waitFor(conditions);
    matcher.addWaiters(resolvers);

    await sendPaymentNotificationAPI(invoiceId, personApplicationId, propertyId);
    await Promise.all(promises);
  };

  const getScreeningResults = async ({ party, residents, guarantors }) => {
    const partyId = party.id;
    const personIds = [].concat(
      residents.map(resident => resident.personId),
      guarantors.map(guarantor => guarantor.personId),
    );
    const token = createJWTToken({ tenantId: ctx.tenantId });
    const { body } = await request(app)
      .get(`/parties/${partyId}/screeningResult?token=${token}&personIds=${personIds.join(',')}`)
      .expect(200);
    return body;
  };

  const getPartyDetails = async ({ party }) => {
    const partyId = party.id;
    const token = createJWTToken({ tenantId: ctx.tenantId });
    const { body } = await request(app).get(`/partyDetails/${partyId}?token=${token}`).expect(200);
    return body;
  };

  const removePartyMember = async ({ party, memberId, userId }) => {
    const { body } = await request(app).del(`/parties/${party.id}/members/${memberId}`).set(getAuthHeader(ctx.tenantId, userId)).expect(200);
    return body;
  };

  const verifyAllQuotesHaveScreening = ({ quotes, screeningResults }) => {
    const quotesWithScreening = quotes.map(quote => screeningResults.some(screeningResult => screeningResult.quoteId === quote.id));
    const allQuotesHaveScreening = quotesWithScreening.every(item => item);

    expect(allQuotesHaveScreening).to.be.equal(true);
  };

  const setupMsgQueueAndWaitFor = async (conditions, workerKeysToBeStarted) => {
    const { resolvers, promises } = waitFor(conditions);
    matcher = createResolverMatcher(resolvers);
    await setupConsumers(chan(), matcher, workerKeysToBeStarted);
    return { task: Promise.all(promises) };
  };

  const getResidentsMessages = (personApplications, invoices, property) =>
    personApplications.map((application, index) => ({
      invoiceId: invoices[index].id,
      personApplicationId: application.id,
      propertyId: property.id,
    }));

  const getApplicationsDataWhereOneMemberHasZeroIncome = personApplications => [
    {
      ...personApplications[0].applicationData,
      grossIncome: 0,
      grossIncomeMonthly: 0,
      grossIncomeFrequency: 'YEARLY',
    },
    {
      ...personApplications[1].applicationData,
      grossIncome: 60000,
      grossIncomeMonthly: 5000,
      grossIncomeFrequency: 'YEARLY',
    },
  ];
  const updatePropertyWithCustomSettings = async property => {
    const screening = {
      ...property.settings.screening,
      incomePolicyRoommates: DALTypes.IncomePolicyRoommates.COMBINED,
      incomePolicyGuarantors: DALTypes.IncomePolicyGuarantors.PRORATED_POOL,
    };
    await updateProperty(ctx, { id: property.id }, { settings: { ...property.settings, screening } });
  };

  beforeEach(async () => {
    await setupMsgQueueAndWaitFor([], ['screening']);
  });

  describe('on getting payment confirmation', () => {
    describe('when party has only a quote', () => {
      // This tests fails randomly, and even when successful it still throws errors
      it.skip('should complete screening workflow with credit blocked and resetCredit request', async () => {
        const { party, quotes, personApplications, invoices, residents, guarantors, property } = await createScreeningTestData({
          memberSettings: { numberOfResidents: 1, numberOfGuarantors: 0, updatedApplicantsNames: [{ firstName: 'Joe', lastName: 'Freeze' }] },
          quoteSettings: { numberOfQuotes: 1, numberOfLeaseTerms: 1 },
          maskSSN: false,
        });
        const [msgResident] = getResidentsMessages(personApplications, invoices, property);

        await sendPaymentNotification({ ...msgResident });

        const personApplication = {
          personId: personApplications[0].personId,
          partyId: personApplications[0].partyId,
          applicationData: personApplications[0].applicationData,
          sendSsnEnabled: true,
        };
        await createOrUpdatePersonApplication(personApplication);

        await waitForQueueIdle();

        const user = await createAUser({ email: 'admin@reva.tech' });
        await resetCreditRequest(user.id, party.id);

        const { screeningResults } = await getScreeningResults({
          party,
          residents,
          guarantors,
        });

        expect(screeningResults[0].isObsolete).to.be.false;
        expect(screeningResults[1].isObsolete).to.be.true;
        expect(screeningResults[2].isObsolete).to.be.true;

        verifyAllQuotesHaveScreening({ quotes, screeningResults });
      });

      it('should complete screening workflow', async () => {
        const { party, quotes, personApplications, invoices, residents, guarantors, property, leaseTerms } = await createScreeningTestData();
        const [msgResident, msgGuarantor] = getResidentsMessages(personApplications, invoices, property);

        await sendPaymentNotification({ ...msgResident });
        await sendPaymentNotification({
          ...msgGuarantor,
          waitForScreeningCompleted: true,
        });

        const { screeningResults } = await getScreeningResults({
          party,
          residents,
          guarantors,
        });

        const { body: screeningSummary } = await getScreeningSummary(personApplications[0].partyId, screeningResults[0].quoteId, leaseTerms[0].id);

        expect(screeningSummary.hasApplicationScreeningStarted).to.equal(true);
        verifyAllQuotesHaveScreening({ quotes, screeningResults });
      });

      describe('and the resident has income 0 and incomePolicyRoommates property setting is set', () => {
        it('should complete screening workflow', async () => {
          const memberSettings = { numberOfResidents: 2 };
          const { party, quotes, personApplications, invoices, residents, guarantors, property } = await createScreeningTestData({
            memberSettings,
            maskSSN: false,
          });

          await updatePropertyWithCustomSettings(property);
          const [msgResident1, msgResident2, msgGuarantor] = getResidentsMessages(personApplications, invoices, property);
          const [applicationData1, applicationData2] = getApplicationsDataWhereOneMemberHasZeroIncome(personApplications);
          await updatePersonApplication(ctx, msgResident1.personApplicationId, { applicationData: applicationData1 });
          await updatePersonApplication(ctx, msgResident2.personApplicationId, { applicationData: applicationData2 });

          await sendPaymentNotification({ ...msgResident1 });
          await sendPaymentNotification({ ...msgResident2 });
          await sendPaymentNotification({
            ...msgGuarantor,
            waitForScreeningCompleted: true,
          });

          const { screeningResults } = await getScreeningResults({
            party,
            residents,
            guarantors,
          });
          verifyAllQuotesHaveScreening({ quotes, screeningResults });
        });
      });

      describe('and two lease terms', () => {
        it('should complete screening workflow', async () => {
          const memberSettings = {
            numberOfResidents: 1,
            numberOfGuarantors: 0,
          };
          const quoteSettings = { numberOfQuotes: 1, numberOfLeaseTerms: 2 };
          const { party, quotes, residents, guarantors, personApplications, invoices, property } = await createScreeningTestData({
            quoteSettings,
            memberSettings,
          });
          const [msgResident] = getResidentsMessages(personApplications, invoices, property);

          await sendPaymentNotification({
            ...msgResident,
            waitForScreeningCompleted: true,
          });

          const { screeningResults } = await getScreeningResults({
            party,
            residents,
            guarantors,
          });

          verifyAllQuotesHaveScreening({ quotes, screeningResults });
        });
      });

      describe('and there is a resident without email', () => {
        it('should complete screening workflow', async () => {
          const memberSettings = { missingEmail: true, numberOfGuarantors: 0 };
          const { personApplications, invoices, property } = await createScreeningTestData({ memberSettings });
          const [msgResident] = getResidentsMessages(personApplications, invoices, property);

          await sendPaymentNotification({
            ...msgResident,
            waitForScreeningCompleted: true,
          });
        });
      });

      describe('and there is a resident without phone', () => {
        it('should complete screening workflow', async () => {
          const memberSettings = { missingPhone: true, numberOfGuarantors: 0 };
          const { party, quotes, residents, guarantors, personApplications, invoices, property } = await createScreeningTestData({ memberSettings });
          const [msgResident] = getResidentsMessages(personApplications, invoices, property);

          await sendPaymentNotification({
            ...msgResident,
            waitForScreeningCompleted: true,
          });
          const { screeningResults } = await getScreeningResults({
            party,
            residents,
            guarantors,
          });

          verifyAllQuotesHaveScreening({ quotes, screeningResults });
        });
      });

      describe('and there is a resident with international address', () => {
        it('shouldnt create any screening request and should hold the application', async () => {
          const memberSettings = { missingPhone: true, numberOfGuarantors: 0 };
          const applicantSettings = { hasInternationalAddress: true };

          const { party, residents, guarantors, personApplications, invoices, property } = await createScreeningTestData({ memberSettings, applicantSettings });
          const [msgResident] = getResidentsMessages(personApplications, invoices, property);

          await sendPaymentNotification({
            ...msgResident,
            waitForScreeningCompleted: true,
          });
          const { screeningResults } = await getScreeningResults({
            party,
            residents,
            guarantors,
          });
          const { screeningSummary } = await getPartyDetails({ party });
          const isPartyApplicationOnHold = screeningSummary[0].screeningSummary.isPartyApplicationOnHold;

          expect(screeningResults.length).to.be.equal(0);
          expect(isPartyApplicationOnHold).to.be.true;
        });
      });

      describe('when there is a resident with itin', () => {
        it('should complete screening workflow and not sent socSecNumber', async () => {
          const memberSettings = { missingPhone: true, numberOfGuarantors: 0 };
          const applicantSettings = { hasItin: true };

          const { quotes, party, residents, guarantors, personApplications, invoices, property } = await createScreeningTestData({
            memberSettings,
            applicantSettings,
          });

          const msgResident = {
            invoiceId: invoices[0].id,
            personApplicationId: personApplications[0].id,
            propertyId: property.id,
          };

          await sendPaymentNotification({
            ...msgResident,
            waitForScreeningCompleted: true,
          });
          const { screeningResults } = await getScreeningResults({
            party,
            residents,
            guarantors,
          });
          verifyAllQuotesHaveScreening({ quotes, screeningResults });

          expect(screeningResults[0].applicantData.applicants[0].socSecNumber).to.be.undefined;
        });
      });
    });

    describe('when party has more than one quote', () => {
      it('should complete screening workflow', async () => {
        const memberSettings = { numberOfResidents: 2 };
        const quoteSettings = { numberOfQuotes: 2 };
        const { party, quotes, residents, guarantors, personApplications, invoices, property } = await createScreeningTestData({
          quoteSettings,
          memberSettings,
        });
        const [msgResident1, msgResident2, msgGuarantor] = getResidentsMessages(personApplications, invoices, property);

        await sendPaymentNotification({ ...msgResident1 });
        await sendPaymentNotification({ ...msgResident2 });
        await sendPaymentNotification({
          ...msgGuarantor,
          waitForScreeningCompleted: true,
        });

        await waitForQueueIdle();

        const { screeningResults } = await getScreeningResults({
          party,
          residents,
          guarantors,
        });

        verifyAllQuotesHaveScreening({ quotes, screeningResults });
      });
    });
  });

  describe('when there is a resident without fullName and a new name is set in the application', () => {
    it('the resident fullName should be updated', async () => {
      const memberSettings = { missingFullName: true, numberOfResidents: 1, updatedApplicantsNames: [{ firstName: 'Tom', lastName: 'Smith' }] };
      const { personApplications, invoices, property } = await createScreeningTestData({ memberSettings });

      const msgResident = {
        invoiceId: invoices[0].id,
        personApplicationId: personApplications[0].id,
        propertyId: property.id,
      };
      await sendPaymentNotification({ ...msgResident });

      const person = await getAPerson(personApplications[0].personId);
      expect(person.fullName).to.be.equal('Tom Smith');
    });
  });

  describe('when there is a guarantor with an email as fullName and a new name is set in the application', () => {
    it('the resident fullName should be updated', async () => {
      const memberSettings = { setNameAsEmail: true, numberOfGuarantors: 1, updatedApplicantsNames: [{ firstName: 'Ann', lastName: 'Smith' }] };
      const { personApplications, invoices, property } = await createScreeningTestData({ memberSettings });

      const msgResident = {
        invoiceId: invoices[0].id,
        personApplicationId: personApplications[0].id,
        propertyId: property.id,
      };
      await sendPaymentNotification({ ...msgResident });

      const person = await getAPerson(personApplications[0].personId);
      expect(person.fullName).to.be.equal('Ann Smith');
    });
  });

  describe('when there is a guarantor with a phone as fullName and a new name is set in the application', () => {
    it('the resident fullName should be updated', async () => {
      const memberSettings = { setNameAsPhone: true, numberOfGuarantors: 1, updatedApplicantsNames: [{ firstName: 'Bob', lastName: 'Smith' }] };
      const { personApplications, invoices, property } = await createScreeningTestData({ memberSettings });

      const msgResident = {
        invoiceId: invoices[0].id,
        personApplicationId: personApplications[0].id,
        propertyId: property.id,
      };
      await sendPaymentNotification({ ...msgResident });

      const person = await getAPerson(personApplications[0].personId);
      expect(person.fullName).to.be.equal('Bob Smith');
    });
  });

  describe('when there are expired applications', () => {
    describe('when party has only a quote', () => {
      describe('and a quote has been published', () => {
        xit('screening request shouldnt be sent', async () => {
          const { property, party, quotes, personApplications, invoices, residents, guarantors } = await createScreeningTestData();
          const [msgResident, msgGuarantor] = getResidentsMessages(personApplications, invoices, property);

          await sendPaymentNotification({ ...msgResident });
          await sendPaymentNotification({
            ...msgGuarantor,
            waitForScreeningCompleted: true,
          });

          const { screeningResults } = await getScreeningResults({
            party,
            residents,
            guarantors,
          });
          verifyAllQuotesHaveScreening({ quotes, screeningResults });
          const creationDate = now().add(-32, 'days').toDate();
          await mapSeries(
            screeningResults,
            async screeningResult =>
              await updateApplicationCreationDate({
                tenantId: ctx.tenantId,
                submissionRequestId: screeningResult.submissionRequestId,
                submissionResponseId: screeningResult.id,
                creationDate,
              }),
          );
          const { quotes: newQuotes } = await createTestQuotes({ party, property });

          await sendPublishedQuoteToScreen(newQuotes[0]);
          await waitForQueueIdle();
          const { screeningResults: screeningResults2 } = await getScreeningResults({
            party,
            residents,
            guarantors,
          });
          expect(screeningResults2.length).to.be.equal(1);
        });
      });

      describe('and a rerun screening is executed', () => {
        it('should send screening request for all the quotes', async () => {
          const { party, quotes, personApplications, invoices, residents, guarantors, property } = await createScreeningTestData();
          const [msgResident, msgGuarantor] = getResidentsMessages(personApplications, invoices, property);

          await sendPaymentNotification({ ...msgResident });
          await sendPaymentNotification({
            ...msgGuarantor,
            waitForScreeningCompleted: true,
          });

          await waitForQueueIdle();
          const { screeningResults } = await getScreeningResults({
            party,
            residents,
            guarantors,
          });
          verifyAllQuotesHaveScreening({ quotes, screeningResults });

          await forceScreeningsToExpire(screeningResults);

          await sendRerunScreening(ctx, party.id);
          await waitForQueueIdle();
          const { screeningResults: screeningResults2 } = await getScreeningResults({
            party,
            residents,
            guarantors,
          });
          expect(screeningResults2.length).to.be.equal(2);
          expect(screeningResults[0].requestType).to.be.equal('New');
        });
      });

      describe('when one member was removed after get screenings', () => {
        it('should return one obsolete screening request and one new request', async () => {
          const test = await createScreeningTestData();
          const { party, personApplications, invoices, guarantors, property } = test;
          const [msgResident, msgGuarantor] = getResidentsMessages(personApplications, invoices, property);

          await sendPaymentNotification({ ...msgResident });
          await sendPaymentNotification({
            ...msgGuarantor,
            waitForScreeningCompleted: true,
          });

          await waitForQueueIdle();
          const { screeningResults } = await getAllScreeningResultsForParty(ctx, party.id, { excludeObsolete: false });
          expect(screeningResults.length).to.be.equal(1);
          expect(screeningResults[0].isObsolete).to.be.false;
          await removePartyMember({ party, memberId: guarantors[0].id, userId: party.userId });
          await waitForQueueIdle();
          const { screeningResults: screeningResults2 } = await getAllScreeningResultsForParty(ctx, party.id, { excludeObsolete: false });
          expect(screeningResults2.length).to.be.equal(2);
          const obsoleteRequest = screeningResults2.filter(screening => screening.isObsolete);
          expect(obsoleteRequest.length).to.be.equal(1);
        });
      });
    });

    describe('when party has more than one quote', () => {
      describe('and a quote has been published', () => {
        it('screening request shouldnt be sent', async () => {
          const memberSettings = { numberOfResidents: 2 };
          const quoteSettings = { numberOfQuotes: 2 };
          const { property, party, quotes, residents, guarantors, personApplications, invoices } = await createScreeningTestData({
            quoteSettings,
            memberSettings,
          });
          const [msgResident1, msgResident2, msgGuarantor] = getResidentsMessages(personApplications, invoices, property);

          await sendPaymentNotification({ ...msgResident1 });
          await sendPaymentNotification({ ...msgResident2 });
          await sendPaymentNotification({
            ...msgGuarantor,
            waitForScreeningCompleted: true,
          });
          await waitForQueueIdle();
          const { screeningResults } = await getScreeningResults({
            party,
            residents,
            guarantors,
          });

          verifyAllQuotesHaveScreening({ quotes, screeningResults });

          await forceScreeningsToExpire(screeningResults);

          const { quotes: newQuotes } = await createTestQuotes({ party, property });

          await sendPublishedQuoteToScreen(newQuotes[0]);
          await waitForQueueIdle();
          const { screeningResults: screeningResults2 } = await getScreeningResults({
            party,
            residents,
            guarantors,
          });
          expect(screeningResults2.length).to.be.equal(2);
        });
      });
    });
  });

  describe('when the applicant completes part1 but doesnt pay', () => {
    describe('and has an international address', () => {
      it('international hold should not be placed', async () => {
        const memberSettings = { setNameAsEmail: true, numberOfGuarantors: 0 };
        const applicantSettings = { hasInternationalAddress: true };

        const { personApplications } = await createScreeningTestData({ memberSettings, applicantSettings });
        const personApplication = {
          personId: personApplications[0].personId,
          partyId: personApplications[0].partyId,
          applicationData: personApplications[0].applicationData,
        };
        await createOrUpdatePersonApplication(personApplication).expect(200);

        const { body: screeningSummary } = await getScreeningSummary(personApplication.partyId);
        expect(screeningSummary.holdReasons.length).to.be.equal(0);
      });
    });
  });
});
