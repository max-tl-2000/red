/*
 * Copyright (c) 2022 Reva Technology Inc., all rights reserved.
 * Unauthorized copying of this file, via any medium is strictly prohibited
 * Licensed under the Elastic License 2.0; you may not use this file except
 * in compliance with the Elastic License 2.0.
 */

import { expect } from 'chai';
import newId from 'uuid/v4';
import { tenant, chan } from '../../../../server/testUtils/setupTestGlobalContext';
import { waitForQueueIdle } from '../../../../server/testUtils/queueHelper';
import { getAllScreeningResultsForParty } from '../screening';
import { processUnparsedPayment } from '../payment';
import { setupConsumers } from '../../../../server/workers/consumer';
import { createScreeningTestData } from '../../test-utils/screening-test-helper';
import { THERE_IS_NOT_A_SCREENING_RESULT, THERE_IS_A_SCREENING_RESULT } from '../../test-utils/constants';

const guarantors = [{ id: newId(), text: 'integration-test-fake-guarantor@reva.tech' }];
const otherApplicants = [{ id: newId(), text: 'integration-test-fake-resident@reva.tech' }];

const payAndValidateScreening = async (expectedResult, _otherApplicants = [], _guarantors = []) => {
  const { party, invoices, personApplications, property } = await createScreeningTestData({
    memberSettings: {
      numberOfResidents: 1,
      numberOfGuarantors: 0,
    },
    applicantSettings: {
      otherApplicants: _otherApplicants,
      guarantors: _guarantors,
    },
  });
  const paymentNotification = {
    invoiceId: invoices[0].id,
    tenantId: tenant.tenantId,
    personApplicationId: personApplications[0].id,
    propertyId: property.id,
  };
  await processUnparsedPayment(paymentNotification);
  await waitForQueueIdle();
  const result = await getAllScreeningResultsForParty(tenant, party.id);
  expect(result.screeningResults.length).equal(expectedResult);
};

describe('When the applicant already pay', () => {
  beforeEach(async () => {
    await setupConsumers(chan(), null /* matcher */, ['screening']);
  });

  describe('there are not invitations', () => {
    it('should return ONE screening request', async () => {
      await payAndValidateScreening(THERE_IS_A_SCREENING_RESULT);
    });
  });
  describe('there are invitations', () => {
    it('should return ZERO screening requests, there is a member invitation in the application', async () => {
      await payAndValidateScreening(THERE_IS_NOT_A_SCREENING_RESULT, otherApplicants);
    });

    it('should return ZERO screening requests, there is a guarantor invitation in the application', async () => {
      await payAndValidateScreening(THERE_IS_NOT_A_SCREENING_RESULT, [], guarantors);
    });

    it('should return ZERO screening requests, there are a member and guarantor invitation in the application', async () => {
      await payAndValidateScreening(THERE_IS_NOT_A_SCREENING_RESULT, otherApplicants, guarantors);
    });
  });
});
