/*
 * Copyright (c) 2022 Reva Technology Inc., all rights reserved.
 * Unauthorized copying of this file, via any medium is strictly prohibited
 * Licensed under the Elastic License 2.0; you may not use this file except
 * in compliance with the Elastic License 2.0.
 */

import { expect } from 'chai';
import request from 'supertest';

import app from '../../../../server/api/api';
import { tenant } from '../../../../server/testUtils/setupTestGlobalContext';
import { createLeaseTestData } from '../../../../server/testUtils/leaseTestHelper';
import { setupQueueToWaitFor, getAuthHeader } from '../../../../server/testUtils/apiHelper';
import { getAllScreeningResultsForParty } from '../../services/screening';
import { updateWaivedFee } from '../../services/person-application';
import { THERE_IS_NOT_A_SCREENING_RESULT, THERE_IS_A_SCREENING_RESULT } from '../../test-utils/constants';

const FEE_IS_WAIVED = true;
const FEE_IS_NOT_WAIVED = false;

const initiatePayment = async (userId, partyId, personId, paymentData) =>
  await request(app)
    .post('/payment/initiate')
    .set(
      getAuthHeader(tenant.id, userId, null, false, {
        partyId,
        personId,
      }),
    )
    .send(paymentData)
    .expect(200);

const initiatePaymentAndValidateScreening = async (expectedResult, isFeeWaived, waitForPayment = true) => {
  const { userId, party, residents, personsApplications, applicationFee, holdDepositFee } = await createLeaseTestData({
    appSettings: { shouldInsertQuotePromotion: false, shouldAddGuarantorToParty: false, includeHoldDepositeFee: false },
    applicantSettings: { hasInternationalAddress: false },
  });
  let application = personsApplications[0];
  const resident = residents[0];
  application = await updateWaivedFee(
    { tenantId: tenant.id },
    { isFeeWaived, partyId: party.id, partyMemberId: resident.id, personApplicationId: application.id },
  );
  const invoice = {
    applicationFeeId: applicationFee.id,
    applicationFeeAmount: applicationFee.absolutePrice,
    personApplicationId: application.id,
    holdDepositFeeId: holdDepositFee.id,
    holdDepositFeeIdAmount: holdDepositFee.absolutePrice,
    propertyId: applicationFee.propertyId,
    applicationFeeWaiverAmount: isFeeWaived ? -applicationFee.absolutePrice : null,
  };

  const paymentData = {
    firstName: resident.fullName,
    email: 'luke@reva.tech',
    invoice,
    reportCopyRequested: false,
    otherApplicants: [],
    guarantors: [],
  };

  const paymentProcessed = (publishMsg, processed, msg) => {
    const matched = publishMsg.partyId === party.id && processed && msg.fields.routingKey === 'payment_processed';
    return matched;
  };

  const { task } = await setupQueueToWaitFor([paymentProcessed], ['screening'], false);
  await initiatePayment(userId, party.id, resident.personId, paymentData);
  waitForPayment && (await task);

  const result = await getAllScreeningResultsForParty(tenant, party.id);
  expect(result.screeningResults.length).equal(expectedResult);
};

describe('When the applicant fills the application and press Continue/Pay Continue', () => {
  it('should return ONE screening request, the application have waive application fee', async () => {
    await initiatePaymentAndValidateScreening(THERE_IS_A_SCREENING_RESULT, FEE_IS_WAIVED);
  });

  it('should return ZERO screening requests, the application have not waive application fee', async () => {
    await initiatePaymentAndValidateScreening(THERE_IS_NOT_A_SCREENING_RESULT, FEE_IS_NOT_WAIVED, false);
  });
});
