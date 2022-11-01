/*
 * Copyright (c) 2022 Reva Technology Inc., all rights reserved.
 * Unauthorized copying of this file, via any medium is strictly prohibited
 * Licensed under the Elastic License 2.0; you may not use this file except
 * in compliance with the Elastic License 2.0.
 */

import request from 'supertest';
import { mapSeries } from 'bluebird';
import sinon from 'sinon';
import newId from 'uuid/v4';
import { expect } from 'chai';

import '../../../../server/testUtils/setupTestGlobalContext';
import app from '../../../../consumer/server/server';
import { getAuthHeader } from '../../../../server/testUtils/apiHelper';
import { createAProperty, createAPerson, createACommonUser, testCtx } from '../../../../server/testUtils/repoHelper';
import { createAUserPaymentMethod } from './repoHelper';
import { COMMON } from '../../../../server/common/schemaConstants';
import { getPaymentMethodById } from '../../dal/payment-method-repo';
import { LA_TIMEZONE } from '../../../../common/date-constants';
import { ResidentPropertyState } from '../../../../common/enums/residentPropertyStates';
import { setRetrieveCommonUserPropertiesFunction, resetRetrieveCommonUserPropertiesFunction } from '../common-middlewares';
import { setGetLeaseInfoForPersonFunction, resetGetLeaseInfoForPersonFunction } from '../../services/payment';
import { DALTypes } from '../../../../common/enums/DALTypes';

describe('payments - canned data', () => {
  describe('api structure validation', () => {
    const commonTenantId = COMMON;
    let commonUserId;
    let propertyId;

    let paymentMethod;
    let token;
    let personId;
    let property;
    const inventoryId = newId();

    const getPropertyRes = (withProperties = true) => {
      if (withProperties) {
        return [
          {
            propertyName: property.name,
            propertyId,
            tenantName: testCtx.name,
            tenantLegal: '',
            residentState: ResidentPropertyState.CURRENT,
            features: { paymentModule: true, maintenanceModule: true },
            personId,
            propertyTimezone: LA_TIMEZONE,
          },
        ];
      }
      return [];
    };

    const leaseInfoList = [
      {
        inventoryId: newId(),
        unitFullyQualifiedName: 'sampleUnitName',
        unitDisplayName: 'sample unit display name',
        buildingDisplayName: 'sample building display name',
        partyId: newId(),
        leaseId: newId(),
        activeLeaseId: newId(),
        personExternalId: 'ext123',
        propertyId,
        partyWorkflowState: DALTypes.WorkflowState.ACTIVE,
        partyState: DALTypes.PartyStateType.RESIDENT,
      },
    ];

    beforeEach(async () => {
      const person = await createAPerson('Jackie Brown', 'Jackie');
      personId = person.id;
      const { commonUser } = await createACommonUser({
        tenantId: testCtx.tenantId,
        fullName: 'Jackie Brown',
        preferredName: 'Jackie',
        email: 'jackie@bro.wn',
        personId,
      });

      commonUserId = commonUser.id;
      property = await createAProperty();
      propertyId = property.id;
      paymentMethod = await createAUserPaymentMethod({ userId: commonUserId, tenantId: testCtx.tenantId });

      token = getAuthHeader(testCtx.tenantId, commonUserId, null, true, { email: commonUser.email, personId });
      const getCommonUserProperties = sinon.spy(() => getPropertyRes());
      setRetrieveCommonUserPropertiesFunction(getCommonUserProperties);
      const getLeaseInfoForPerson = sinon.spy(() => leaseInfoList);
      setGetLeaseInfoForPersonFunction(getLeaseInfoForPerson);
    });

    afterEach(() => {
      resetRetrieveCommonUserPropertiesFunction();
      resetGetLeaseInfoForPersonFunction();
    });

    describe('PATCH resident/api/paymentMethods/changeDefault/:paymentMethodId', () => {
      describe('given a request to make a payment method a default one', () => {
        describe('when paymentMethodId is missing', () => {
          it('responds with status code 400 and RESIDENT_API_NOT_FOUND token', async () => {
            try {
              await request(app).patch('/resident/api/paymentMethods/').set(token);
            } catch (e) {
              expect(e.status).to.equal(404);
              expect(e.body.token).to.equal('RESIDENT_API_NOT_FOUND');
            }
          });
        });
      });

      describe('when paymentMethodId is present and the update is valid', () => {
        it('responds with status code 200 mark the selected payment method as the default one', async () => {
          const defaultMethod = await createAUserPaymentMethod({
            userId: commonUserId,
            tenantId: testCtx.tenantId,
            channelType: 'CREDIT',
            lastFour: '5678',
            expirationMonth: '10/2028',
            externalId: '65432',
            isDefault: true,
          });

          const res = await request(app).patch(`/resident/api/paymentMethods/changeDefault/${paymentMethod.id}`).set(token);

          const oldDefaultOne = await getPaymentMethodById(testCtx, defaultMethod.id);
          const newDefaultOne = await getPaymentMethodById(testCtx, paymentMethod.id);

          expect(res.status).to.equal(200);

          expect(oldDefaultOne.isDefault).to.be.false;
          expect(newDefaultOne.isDefault).to.be.true;
        });
      });
    });

    describe('DELETE resident/api/paymentMethods/:paymentMethodId', () => {
      describe('given a request to remove a payment method', () => {
        describe('when paymentMethodId is missing', () => {
          it('responds with status code 400 and RESIDENT_API_NOT_FOUND token', async () => {
            try {
              await request(app).delete('/resident/api/paymentMethods/').set(token);
            } catch (e) {
              expect(e.status).to.equal(404);
              expect(e.body.token).to.equal('RESIDENT_API_NOT_FOUND');
            }
          });
        });
      });

      describe('when paymentMethodId is present', () => {
        it('responds with status 200 and removes the payment method', async () => {
          const body = { externalPaymentMethodId: newId(), propertyId };
          const res = await request(app).delete(`/resident/api/paymentMethods/${paymentMethod.id}`).set({ tenant: testCtx.name }).set(token).send(body);
          expect(res.status).to.equal(200);
          const dbPaymentMethod = await getPaymentMethodById({ tenantId: commonTenantId }, paymentMethod.id);
          expect(dbPaymentMethod).to.be.undefined;
        });
      });
    });

    describe('POST resident/api/paymentMethods/initiate', () => {
      describe('given a request to initiate a payment', () => {
        describe('when parameters are missing', () => {
          it('responds with status code 400 and MISSING_REQUIRED_PARAMETER token', async () => {
            const requiredParameters = {
              inventoryId,
              successUrl: 'success.com',
              cancelUrl: 'cancel.com',
              tenantName: testCtx.name,
              propertyId,
            };

            await mapSeries(Object.keys(requiredParameters), async key => {
              const { [key]: missingParameter, ...parameters } = requiredParameters;
              const res = await request(app).post('/resident/api/paymentMethods/initiate').set({ tenant: testCtx.name }).set(token).send(parameters);
              expect(res.status).to.equal(400);
              expect(res.body.token).to.equal(`MISSING_REQUIRED_PARAMETER: ${key}`);
            });
          });
        });
      });

      describe('when all params are present and request is valid', () => {
        it('responds with status code 200 and initiates the payment', async () => {
          const updatedValues = {
            successUrl: 'success.com',
            cancelUrl: 'cancel.com',
            propertyId,
            inventoryId,
            tenantName: testCtx.name,
          };

          const res = await request(app).post('/resident/api/paymentMethods/initiate').set({ tenant: testCtx.name }).set(token).send(updatedValues);
          expect(res.status).to.equal(200);
        });
      });
    });

    describe('GET resident/api/properties/:propertyId/paymentInfo', () => {
      describe('given a request to retrieve payment information for property', () => {
        describe('when common user does not exist', () => {
          it('responds with status code 500 and MISSING_COMMON_USER_ID token', async () => {
            const getCommonUserProperties = sinon.spy(() => getPropertyRes(false));
            setRetrieveCommonUserPropertiesFunction(getCommonUserProperties);

            const newToken = getAuthHeader(testCtx.tenantId, newId(), null);
            const res = await request(app).get(`/resident/api/properties/${propertyId}/paymentInfo`).set({ tenant: testCtx.name }).set(newToken);
            expect(res.status).to.equal(500);
            expect(res.body.token).to.equal('MISSING_COMMON_USER_ID');
          });
        });

        describe('when property is not associated to user', () => {
          it('responds with status code 403 and PROPERTY_NOT_ASSOCIATED_TO_USER token', async () => {
            const getCommonUserProperties = sinon.spy(() => getPropertyRes(false));
            setRetrieveCommonUserPropertiesFunction(getCommonUserProperties);

            const newToken = getAuthHeader(testCtx.tenantId, commonUserId, null, true);
            const res = await request(app).get(`/resident/api/properties/${propertyId}/paymentInfo`).set({ tenant: testCtx.name }).set(newToken);
            expect(res.status).to.equal(403);
            expect(res.body.token).to.equal('PROPERTY_NOT_ASSOCIATED_TO_USER');
          });
        });

        describe('when request is ok', () => {
          it('responds with status code 200 and the payment information', async () => {
            const res = await request(app).get(`/resident/api/properties/${propertyId}/paymentInfo`).set({ tenant: testCtx.name }).set(token);
            expect(res.status).to.equal(200);

            const paymentInfoKeys = ['unitUserInfo', 'currentCharges', 'transactions', 'paymentMethods', 'scheduledPayments'];
            const unitUserInfoKeys = [
              'inventoryId',
              'buildingDisplayName',
              'unitDisplayName',
              'fullyQualifiedName',
              'balanceDueAmount',
              'balanceDueDate',
              'paymentStatus',
              'isPastResident',
            ];
            const transactionsKeys = ['payments', 'declines', 'voids', 'refunds', 'reversals'];
            const currentChargesKeys = ['type', 'description', 'dueDate', 'balanceAmount'];

            const paymentMethodKeysForCannedData = [
              'id',
              'brand',
              'channelType',
              'lastFour',
              'expirationDate',
              'isExpired',
              'isDefault',
              'absoluteServiceFeePrice',
              'userId',
              'createdAt',
              'externalId',
            ];

            const scheduledPaymentsKeys = [
              'dayOfMonth',
              'endMonth',
              'frequency',
              'paymentAccountName',
              'paymentAmount',
              'paymentMethodProviderId',
              'providerId',
              'startMonth',
            ];

            const paymentKeys = ['method', 'date', 'amount', 'fee', 'providerTransactionId', 'reason', 'totalAmount', 'inventoryId'];

            const [response] = res.body;
            expect(res.body.length).to.equal(1);
            expect(response).to.have.all.keys(paymentInfoKeys);

            const { unitUserInfo, currentCharges, transactions, scheduledPayments, paymentMethods } = response;
            expect(unitUserInfo).to.have.all.keys(unitUserInfoKeys);

            expect(currentCharges.length).to.equal(2);
            expect(currentCharges[0]).to.have.all.keys(currentChargesKeys);

            expect(transactions).to.have.all.keys(transactionsKeys);
            expect(transactions.payments.length).to.equal(2);
            expect(transactions.payments[0]).to.have.all.keys(paymentKeys);

            expect(scheduledPayments.length).to.equal(3);
            expect(scheduledPayments[0]).to.have.all.keys(scheduledPaymentsKeys);

            expect(paymentMethods.length).to.equal(3);
            expect(paymentMethods[0]).to.have.all.keys(paymentMethodKeysForCannedData);
          });
        });
      });
    });

    describe('POST resident/api/properties/:propertyId/payment', () => {
      describe('given a request to create a payment', () => {
        describe('when parameters are missing', () => {
          it('responds with status code 400 and MISSING_REQUIRED_PARAMETER token', async () => {
            const requiredParameters = {
              paymentAmount: 500,
              paymentMethodId: paymentMethod.id,
              inventoryId,
            };

            await mapSeries(Object.keys(requiredParameters), async key => {
              const { [key]: missingParameter, ...parameters } = requiredParameters;
              const res = await request(app).post(`/resident/api/properties/${propertyId}/payment`).set({ tenant: testCtx.name }).set(token).send(parameters);
              expect(res.status).to.equal(400);
              expect(res.body.token).to.equal(`MISSING_REQUIRED_PARAMETER: ${key}`);
            });
          });
        });

        describe('when all params are present and the post is valid', () => {
          it('responds with status code 200 and the added payment', async () => {
            const updatedValues = {
              paymentAmount: 500,
              paymentMethodId: paymentMethod.id,
              inventoryId,
            };

            const res = await request(app).post(`/resident/api/properties/${propertyId}/payment`).set({ tenant: testCtx.name }).set(token).send(updatedValues);
            expect(res.status).to.equal(200);
            expect(res.body.success).to.be.true;
          });
        });
      });
    });
  });
});
