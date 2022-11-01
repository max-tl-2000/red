/*
 * Copyright (c) 2022 Reva Technology Inc., all rights reserved.
 * Unauthorized copying of this file, via any medium is strictly prohibited
 * Licensed under the Elastic License 2.0; you may not use this file except
 * in compliance with the Elastic License 2.0.
 */

import { expect } from 'chai';
import request from 'supertest';
import app from '../../../../server/api/api';
import { getAuthHeader } from '../../../../server/testUtils/apiHelper';
import { tenant } from '../../../../server/testUtils/setupTestGlobalContext';
import { createAPersonApplication } from '../../test-utils/repo-helper.js';
import { createTestBaseInfo } from '../../test-utils/screening-test-helper';
import { createAFee } from '../../../../server/testUtils/repoHelper';

describe('API/payment', () => {
  context('POST/payment/initiate', () => {
    let personApplication;
    let paymentData;
    let applicantToken;
    beforeEach(async () => {
      const memberSettings = { numberOfResidents: 1, numberOfGuarantors: 0 };
      const { party, property, userId, residents } = await createTestBaseInfo({ memberSettings });
      personApplication = await createAPersonApplication(
        { firstName: 'Anakin', email: residents[0].contactInfo.defaultEmail, haveInternationalAddress: true, addressLine: '742 Evergreen Terrace' },
        residents[0].personId,
        party.id,
      );
      const holdDepositFee = await createAFee({
        feeType: 'holdDeposit',
        feeName: 'holdDeposit',
        absolutePrice: 42,
        propertyId: property.id,
      });
      const applicationFee = await createAFee({
        feeType: 'application',
        feeName: 'singleAppFee',
        absolutePrice: 43,
        propertyId: property.id,
      });

      paymentData = {
        firstName: personApplication.applicationData.firstName,
        email: personApplication.applicationData.email,
        invoice: {
          propertyId: property.id,
          applicationFeeId: applicationFee.id,
          applicationFeeAmount: 50,
          personApplicationId: personApplication.id,
          holdDepositFeeId: holdDepositFee.id,
          holdDepositFeeIdAmount: 50,
        },
        reportCopyRequested: false,
        otherApplicants: [],
        guarantors: [],
      };

      applicantToken = getAuthHeader(tenant.id, userId, null, false, {
        partyId: personApplication.partyId,
        personId: personApplication.personId,
        propertyId: property.id,
      });
    });

    describe('When request to initiate payment is received', () => {
      it('Should respond with status code 200 and an object with two properties', async () => {
        await request(app)
          .post('/payment/initiate')
          .set(applicantToken)
          .send(paymentData)
          .expect(200)
          .expect(res => {
            expect(res.body).to.have.all.keys(['invoiceId', 'formUrl', 'isFeeWaived']);
            expect(res.body.formUrl).to.include(`personApplicationId=${personApplication.id}`);
          });
      });
    });
  });
});
