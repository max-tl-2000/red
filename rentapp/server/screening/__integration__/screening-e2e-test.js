/*
 * Copyright (c) 2022 Reva Technology Inc., all rights reserved.
 * Unauthorized copying of this file, via any medium is strictly prohibited
 * Licensed under the Elastic License 2.0; you may not use this file except
 * in compliance with the Elastic License 2.0.
 */

import map from 'lodash/map';
import { expect } from 'chai';
import { tenant, chan } from '../../../../server/testUtils/setupTestGlobalContext';
import { createScreeningTestData } from '../../test-utils/screening-test-helper';
import { createOrUpdatePersonApplication, sendPaymentNotification, updatePartyMember, linkPartyMember } from '../../test-utils/api-helper';
import { setupConsumers } from '../../../../server/workers/consumer';
import { DALTypes } from '../../../../common/enums/DALTypes';

// TODO: use API for this instead?
import { getAllScreeningResultsForParty } from '../../services/screening';
import { waitForQueueIdle } from '../../../../server/testUtils/queueHelper';
import loggerModule from '../../../../common/helpers/logger';
const logger = loggerModule.child({ subType: 'screeningE2ETest' });

// const context = { tenantId: tenant.id };

// waits for queue to be idle for at least quietTime seconds, up to timeout seconds

let testData;

const getResponsesAndRequestsIds = (screeningRequests, screeningResults) => ({
  requestsIds: map(screeningRequests, 'screeningRequestId'),
  resultsIds: map(screeningResults, 'screeningResponseId'),
});

const getObsoleteResults = screeningResults => screeningResults.filter(res => res.isObsolete);

const validateOldScreenings = (screeningsInfo, expectedScreeningsLength) => {
  const { screeningRequests, screeningResults, originalRequestIds, originalResponseIds } = screeningsInfo;
  expect(screeningRequests).to.have.lengthOf(expectedScreeningsLength);
  expect(screeningResults).to.have.lengthOf(expectedScreeningsLength);

  const numObsoleteResultsLength = getObsoleteResults(screeningResults).length;
  expect(numObsoleteResultsLength).to.equal(0);

  expect(originalRequestIds).not.to.contain.null;
  expect(originalResponseIds).not.to.contain.null;
};

const validateNewScreenings = (screeningsInfo, expectedScreeningsLength) => {
  const { newScreeningRequests, newScreeningResults, originalRequestIds, originalResponseIds } = screeningsInfo;
  expect(newScreeningRequests).to.have.lengthOf(2 * expectedScreeningsLength);
  const updatedNumObsoleteResultsLength = getObsoleteResults(newScreeningResults).length;
  expect(updatedNumObsoleteResultsLength).to.equal(expectedScreeningsLength);

  const { requestsIds: updatedRequestIds, resultsIds: updatedResponseIds } = getResponsesAndRequestsIds(newScreeningRequests, newScreeningResults);

  expect(updatedRequestIds).not.to.equal(originalRequestIds);
  expect(updatedResponseIds).not.to.equal(originalResponseIds);
  expect(updatedResponseIds).not.to.contain.null;
};

const validateTestData = ({ data, numberOfResidents, numberOfGuarantors, numberOfQuotes }) => {
  const { quotes, personApplications, invoices, residents, guarantors } = data;

  const numberOfInvoices = numberOfResidents + numberOfGuarantors;
  const numberOfPersonApplications = numberOfResidents + numberOfGuarantors;

  // confirm setup
  expect(residents).to.have.lengthOf(numberOfResidents);
  expect(guarantors).to.have.lengthOf(numberOfGuarantors);
  expect(quotes).to.have.lengthOf(numberOfQuotes);
  expect(invoices).to.have.lengthOf(numberOfInvoices);
  expect(personApplications).to.have.lengthOf(numberOfPersonApplications);
  personApplications.map(personApplication => expect(personApplication.paymentCompleted).to.be.false);
};

const sendPaymentNotifications = async (personApplications, invoices) => {
  logger.trace('sending payment   ');
  await personApplications.map(async (pa, index) => {
    await sendPaymentNotification(invoices[index].id, pa.id);
  });
  logger.trace('back from processing payment notification');

  await waitForQueueIdle();
};

const executeTestForRoleChange = async (memberSettings, quoteSettings, useGuarantor = true) => {
  const expectedScreeningsLength = quoteSettings.numberOfQuotes * quoteSettings.numberOfLeaseTerms;
  testData = await createScreeningTestData({ memberSettings, quoteSettings });
  await setupConsumers(chan(), null /* matcher */, ['screening']);
  const { party, personApplications, invoices, residents, guarantors, userId } = testData;
  await sendPaymentNotifications(personApplications, invoices);
  const { screeningResults, screeningRequests } = await getAllScreeningResultsForParty(tenant, party.id, { excludeObsolete: false });

  const { requestsIds: originalRequestIds, resultsIds: originalResponseIds } = getResponsesAndRequestsIds(screeningRequests, screeningResults);
  validateOldScreenings({ screeningRequests, screeningResults, originalRequestIds, originalResponseIds }, expectedScreeningsLength);

  const updatedMember = useGuarantor
    ? { ...guarantors[0], memberType: DALTypes.MemberType.RESIDENT }
    : { ...residents[0], memberType: DALTypes.MemberType.GUARANTOR };
  await updatePartyMember(updatedMember, party.id, userId);
  !useGuarantor && (await linkPartyMember(updatedMember.id, party.id, [residents[1].id], userId));
  await waitForQueueIdle();

  const { screeningResults: newScreeningResults, screeningRequests: newScreeningRequests } = await getAllScreeningResultsForParty(tenant, party.id, {
    excludeObsolete: false,
  });

  validateNewScreenings({ newScreeningRequests, newScreeningResults, originalRequestIds, originalResponseIds }, expectedScreeningsLength);
  screeningRequests.forEach(req => expect(req.requestType).to.equal('New'));
};

const executeApplicantUpdateTest = async ({ numberOfQuotes, numberOfLeaseTerms, numberOfResidents, numberOfGuarantors }) => {
  const quoteSettings = { numberOfQuotes, numberOfLeaseTerms };
  const expectedScreeningsLength = numberOfQuotes * numberOfLeaseTerms;

  const memberSettings = {
    numberOfResidents,
    numberOfGuarantors,
  };

  testData = await createScreeningTestData({ memberSettings, quoteSettings });
  await setupConsumers(chan(), null /* matcher */, ['screening']);
  const { party, personApplications, invoices, residents } = testData;

  validateTestData({ data: testData, numberOfResidents, numberOfGuarantors, numberOfQuotes });

  await sendPaymentNotifications(personApplications, invoices);
  const { screeningResults, screeningRequests } = await getAllScreeningResultsForParty(tenant, party.id, { excludeObsolete: false });

  const { requestsIds: originalRequestIds, resultsIds: originalResponseIds } = getResponsesAndRequestsIds(screeningRequests, screeningResults);

  validateOldScreenings({ screeningRequests, screeningResults, originalRequestIds, originalResponseIds }, expectedScreeningsLength);

  const updatedPersonApplication = {
    personId: residents[0].personId,
    partyId: party.id,
    partyApplicationId: personApplications[0].partyApplicationId,
    applicationData: {
      ...personApplications[0].applicationData,
      firstName: 'Jonathan',
      lastName: 'Doe',
    },
  };

  // this actually updates
  await createOrUpdatePersonApplication(updatedPersonApplication).expect(200);

  logger.trace('back from (update) createPersonApplication -- about to wait for queue idle');
  await waitForQueueIdle();

  const { screeningResults: newScreeningResults, screeningRequests: newScreeningRequests } = await getAllScreeningResultsForParty(tenant, party.id, {
    excludeObsolete: false,
  });

  validateNewScreenings({ newScreeningRequests, newScreeningResults, originalRequestIds, originalResponseIds }, expectedScreeningsLength);

  const modifiedRequest = screeningRequests.some(req => req.requestType === 'Modify');
  expect(modifiedRequest).to.not.be.null;
};

describe('when a party has a completed application and screening with one party member', () => {
  describe('and one quote', () => {
    const numberOfQuotes = 1;
    const numberOfLeaseTerms = 1;
    const quoteSettings = { numberOfQuotes, numberOfLeaseTerms };

    const numberOfResidents = 1;
    const numberOfGuarantors = 0;

    describe('when applicant changes information', () => {
      it('should obsolete existing requests', async () => {
        await executeApplicantUpdateTest({ numberOfQuotes, numberOfLeaseTerms, numberOfResidents, numberOfGuarantors });
      });
    });

    describe('when applicant changes role from Guarantor to Resident', () => {
      const memberSettings = { numberOfResidents: 1, numberOfGuarantors: 1 };

      it('should obsolete existing requests and create a NEW screening request', async () => {
        await executeTestForRoleChange(memberSettings, quoteSettings);
      });
    });

    describe('when applicant changes role from Resident to Guarantor', () => {
      const memberSettings = { numberOfResidents: 2, numberOfGuarantors: 0 };
      it('should obsolete existing requests and create a NEW screening request', async () => {
        await executeTestForRoleChange(memberSettings, quoteSettings, false);
      });
    });
  });

  describe('and more than one quote', () => {
    const numberOfQuotes = 2;
    const numberOfLeaseTerms = 2;

    const numberOfResidents = 1;
    const numberOfGuarantors = 0;

    describe('when applicant changes information', () => {
      it('should obsolete existing requests', async () => {
        await executeApplicantUpdateTest({ numberOfQuotes, numberOfLeaseTerms, numberOfResidents, numberOfGuarantors });
      });
    });
  });
});
