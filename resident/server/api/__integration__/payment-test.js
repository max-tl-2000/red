/*
 * Copyright (c) 2022 Reva Technology Inc., all rights reserved.
 * Unauthorized copying of this file, via any medium is strictly prohibited
 * Licensed under the Elastic License 2.0; you may not use this file except
 * in compliance with the Elastic License 2.0.
 */

import request from 'supertest';
import { mapSeries } from 'bluebird';
import newId from 'uuid/v4';
import { expect } from 'chai';

import '../../../../server/testUtils/setupTestGlobalContext';
import app from '../../../../consumer/server/server';
import { getAuthHeader } from '../../../../server/testUtils/apiHelper';
import { createACommonUser, testCtx, createASource } from '../../../../server/testUtils/repoHelper';
import { createAUserPaymentMethod } from './repoHelper';
import { COMMON } from '../../../../server/common/schemaConstants';
import { getPaymentMethodById } from '../../dal/payment-method-repo';
import { DALTypes } from '../../../../common/enums/DALTypes';
import { now } from '../../../../common/helpers/moment-utils';
import { loadParties, getPartyMembersByPartyIds } from '../../../../server/dal/partyRepo';
import { partyWfStatesSubset } from '../../../../common/enums/partyTypes';
import { addEPMIForResident } from '../../dal/external-party-member-repo';
import { insertScheduledTransactionsInfo, getSeenTransactions } from '../../dal/scheduled-transactions-info-repo';
import { createNewLeaseParty, callProcessWorkflowsJob, setupMsgQueueAndWaitFor } from '../../../../server/testUtils/partyWorkflowTestHelper';

describe('payments', () => {
  describe('real setup validation', () => {
    let newLeaseParty;
    let activeLeaseParty;
    let propertyId;
    let token;
    let commonUserId;
    let personId;
    let paymentMethod;
    const commonTenantId = COMMON;

    const setupParties = async () => {
      const newLeaseStartDate = now().add(-1, 'days').toISOString();
      const leaseEndDate = now().add(250, 'days').toISOString();

      const { party, leaseId } = await createNewLeaseParty({
        leaseStartDate: newLeaseStartDate,
        leaseEndDate,
        shouldSignLease: true,
        shouldCounterSignLease: true,
      });

      newLeaseParty = party;
      expect(newLeaseParty).to.be.ok;
      await callProcessWorkflowsJob();
      const partiesUntilThisPoint = await loadParties(testCtx, partyWfStatesSubset.all);
      expect(partiesUntilThisPoint.length).to.equal(2);
      activeLeaseParty = partiesUntilThisPoint.find(p => p.id !== newLeaseParty.id);
      propertyId = newLeaseParty.assignedPropertyId;

      const partyMembers = await getPartyMembersByPartyIds(testCtx, [activeLeaseParty.id]);
      const resident = partyMembers.find(pm => pm.memberType === DALTypes.MemberType.RESIDENT);

      await addEPMIForResident(testCtx, {
        partyId: activeLeaseParty.id,
        partyMemberId: resident.id,
        leaseId,
        externalId: 'res123',
        metadata: { aptexxData: { integrationId: '76408', accountPersonId: '954545' } },
        propertyId,
      });

      personId = resident.personId;
      const { commonUser } = await createACommonUser({
        tenantId: testCtx.tenantId,
        fullName: resident.fullName,
        preferredName: resident.preferredName,
        email: resident.contactInfo.defaultEmail,
        personId,
      });

      commonUserId = commonUser.id;
      paymentMethod = await createAUserPaymentMethod({ userId: commonUserId, tenantId: testCtx.tenantId, integrationId: '76408' });
      token = getAuthHeader(testCtx.tenantId, commonUserId, null, true, { email: commonUser.email, personId, commonUserId });
    };

    beforeEach(async () => {
      await setupMsgQueueAndWaitFor([], ['lease']);
      await createASource('transfer-agent', 'transfer-agent', '', 'Agent');
      await setupParties();
    });

    describe('GET resident/api/properties/:propertyId/paymentInfo', () => {
      describe('given a request to retrieve payment information for property', () => {
        describe('when common user does not exist', () => {
          it('responds with status code 500 and MISSING_COMMON_USER_ID token', async () => {
            const newToken = getAuthHeader(testCtx.tenantId, newId(), null);
            const res = await request(app).get(`/resident/api/properties/${propertyId}/paymentInfo`).set({ tenant: testCtx.name }).set(newToken);
            expect(res.status).to.equal(500);
            expect(res.body.token).to.equal('MISSING_COMMON_USER_ID');
          });
        });

        describe('when property is not associated to user', () => {
          it('responds with status code 403 and PROPERTY_NOT_ASSOCIATED_TO_USER token', async () => {
            const res = await request(app).get(`/resident/api/properties/${newId()}/paymentInfo`).set({ tenant: testCtx.name }).set(token);
            expect(res.status).to.equal(403);
            expect(res.body.token).to.equal('PROPERTY_NOT_ASSOCIATED_TO_USER');
          });
        });

        describe('when request is ok', () => {
          it('responds with status code 200 and the payment information', async () => {
            const res = await request(app).get(`/resident/api/properties/${propertyId}/paymentInfo`).set({ tenant: testCtx.name }).set(token);
            expect(res.status).to.equal(200);
            expect(res.body.length).to.equal(1);
            const [response] = res.body;

            const paymentInfoKeys = ['unitUserInfo', 'currentCharges', 'transactions', 'paymentMethods', 'scheduledPayments'];
            expect(response).to.have.all.keys(paymentInfoKeys);

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
            const { unitUserInfo, currentCharges, transactions, scheduledPayments, paymentMethods } = response;
            expect(unitUserInfo).to.have.all.keys(unitUserInfoKeys);
            expect(currentCharges.length).to.equal(0);
            expect(transactions.length).to.equal(0);
            expect(scheduledPayments.length).to.equal(0);
            expect(paymentMethods.length).to.equal(1);

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
            const pm = response.paymentMethods[0];
            expect(pm).to.have.all.keys(paymentMethodKeysForCannedData);
            const { brand, channelType, id, lastFour } = pm;
            expect(brand).to.equal(paymentMethod.brand);
            expect(channelType).to.equal(paymentMethod.channelType);
            expect(id).to.equal(paymentMethod.id);
            expect(lastFour).to.equal(paymentMethod.lastFour);
          });
        });
      });
    });

    describe('DELETE resident/api/paymentMethods/:paymentMethodId', () => {
      describe('given a request to remove a payment method', () => {
        describe('when parameters are missing', () => {
          it('responds with status code 400 and MISSING_REQUIRED_PARAMETER token', async () => {
            const requiredParameters = {
              propertyId,
              externalPaymentMethodId: newId(),
            };

            await mapSeries(Object.keys(requiredParameters), async key => {
              const { [key]: missingParameter, ...parameters } = requiredParameters;
              const res = await request(app)
                .delete(`/resident/api/paymentMethods/${paymentMethod.id}`)
                .set({ tenant: testCtx.name })
                .set(token)
                .send(parameters);
              expect(res.status).to.equal(400);
              expect(res.body.token).to.equal(`MISSING_REQUIRED_PARAMETER: ${key}`);
            });
          });
        });
      });

      describe('when paymentMethodId and parameters are present', () => {
        it('responds with status 200 and removes the payment method', async () => {
          const body = { externalPaymentMethodId: newId(), propertyId };
          const res = await request(app).delete(`/resident/api/paymentMethods/${paymentMethod.id}`).set({ tenant: testCtx.name }).set(token).send(body);
          expect(res.status).to.equal(200);
          const dbPaymentMethod = await getPaymentMethodById({ tenantId: commonTenantId }, paymentMethod.id);
          expect(dbPaymentMethod).to.be.undefined;
        });
      });
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
            integrationId: paymentMethod.integrationId,
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

    describe('POST resident/api/paymentMethods/initiate', () => {
      describe('given a request to initiate a payment', () => {
        describe('when parameters are missing', () => {
          it('responds with status code 400 and MISSING_REQUIRED_PARAMETER token', async () => {
            const requiredParameters = {
              inventoryId: newId(),
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
          const res2 = await request(app).get(`/resident/api/properties/${propertyId}/paymentInfo`).set({ tenant: testCtx.name }).set(token);
          expect(res2.status).to.equal(200);
          const body = res2.body;
          expect(body.length).to.equal(1);
          const unitUserInfo = body[0].unitUserInfo;
          const updatedValues = {
            successUrl: 'success.com',
            cancelUrl: 'cancel.com',
            propertyId,
            inventoryId: unitUserInfo.inventoryId,
            tenantName: testCtx.name,
          };

          const res = await request(app).post('/resident/api/paymentMethods/initiate').set({ tenant: testCtx.name }).set(token).send(updatedValues);
          expect(res.status).to.equal(200);
        });
      });
    });

    describe('GET resident/api/properties/:propertyId/scheduledTransactions', () => {
      describe('given a request to retrieve scheduled transactions for property', () => {
        describe('when common user does not exist', () => {
          it('responds with status code 500 and MISSING_COMMON_USER_ID token', async () => {
            const newToken = getAuthHeader(testCtx.tenantId, newId(), null);
            const res = await request(app).get(`/resident/api/properties/${propertyId}/scheduledTransactions`).set({ tenant: testCtx.name }).set(newToken);
            expect(res.status).to.equal(500);
            expect(res.body.token).to.equal('MISSING_COMMON_USER_ID');
          });
        });

        describe('when property is not associated to user', () => {
          it('responds with status code 403 and PROPERTY_NOT_ASSOCIATED_TO_USER token', async () => {
            const res = await request(app).get(`/resident/api/properties/${newId()}/scheduledTransactions`).set({ tenant: testCtx.name }).set(token);
            expect(res.status).to.equal(403);
            expect(res.body.token).to.equal('PROPERTY_NOT_ASSOCIATED_TO_USER');
          });
        });

        describe('when request is ok', () => {
          it('responds with status code 200 and the scheduled transactions', async () => {
            const res = await request(app).get(`/resident/api/properties/${propertyId}/scheduledTransactions`).set({ tenant: testCtx.name }).set(token);
            expect(res.status).to.equal(200);
            const body = res.body;
            const transactionsKeys = ['payments', 'declines', 'voids', 'refunds', 'reversals'];
            expect(body).to.have.all.keys(transactionsKeys);
          });
        });
      });
    });

    describe('POST resident/api/properties/:propertyId/scheduledTransactions/:transactionId/seen', () => {
      describe('given a request to mark a scheduled transaction as seen', () => {
        describe('when common user does not exist', () => {
          it('responds with status code 500 and MISSING_COMMON_USER_ID token', async () => {
            const newToken = getAuthHeader(testCtx.tenantId, newId(), null);

            const res = await request(app)
              .post(`/resident/api/properties/${propertyId}/scheduledTransactions/${newId()}/seen`)
              .set({ tenant: testCtx.name })
              .set(newToken);

            expect(res.status).to.equal(500);
            expect(res.body.token).to.equal('MISSING_COMMON_USER_ID');
          });
        });

        describe('when property is not associated to user', () => {
          it('responds with status code 403 and PROPERTY_NOT_ASSOCIATED_TO_USER token', async () => {
            const res = await request(app)
              .post(`/resident/api/properties/${newId()}/scheduledTransactions/${newId()}/seen`)
              .set({ tenant: testCtx.name })
              .set(token);

            expect(res.status).to.equal(403);
            expect(res.body.token).to.equal('PROPERTY_NOT_ASSOCIATED_TO_USER');
          });
        });

        describe('when the scheduled transaction is present', () => {
          it('responds with status code 200 and marks the scheduled transaction as seen', async () => {
            const scheduledTransactionInfo = await insertScheduledTransactionsInfo(testCtx, { transactionId: newId(), wasSeen: false });
            const scheduledInfoUnseen = await insertScheduledTransactionsInfo(testCtx, { transactionId: newId(), wasSeen: false });
            const res = await request(app)
              .post(`/resident/api/properties/${propertyId}/scheduledTransactions/${scheduledTransactionInfo.transactionId}/seen`)
              .set({ tenant: testCtx.name })
              .set(token);

            expect(res.status).to.equal(200);
            const seenTransactions = await getSeenTransactions(testCtx, [scheduledTransactionInfo.transactionId, scheduledInfoUnseen.transactionId]);
            expect(seenTransactions.length).to.equal(1);
            expect(seenTransactions[0].transactionId).to.equal(scheduledTransactionInfo.transactionId);
          });
        });
      });
    });

    describe('POST resident/api/properties/:propertyId/initiateScheduledPayment', () => {
      describe('given a request to initiate a scheduled payment', () => {
        describe('when common user does not exist', () => {
          it('responds with status code 500 and MISSING_COMMON_USER_ID token', async () => {
            const newToken = getAuthHeader(testCtx.tenantId, newId(), null);
            const res = await request(app).post(`/resident/api/properties/${propertyId}/initiateScheduledPayment`).set({ tenant: testCtx.name }).set(newToken);
            expect(res.status).to.equal(500);
            expect(res.body.token).to.equal('MISSING_COMMON_USER_ID');
          });
        });

        describe('when property is not associated to user', () => {
          it('responds with status code 403 and PROPERTY_NOT_ASSOCIATED_TO_USER token', async () => {
            const res = await request(app).post(`/resident/api/properties/${newId()}/initiateScheduledPayment`).set({ tenant: testCtx.name }).set(token);
            expect(res.status).to.equal(403);
            expect(res.body.token).to.equal('PROPERTY_NOT_ASSOCIATED_TO_USER');
          });
        });

        describe('when parameters are missing', () => {
          it('responds with status code 400 and MISSING_REQUIRED_PARAMETER token', async () => {
            const requiredParameters = {
              inventoryId: newId(),
              successUrl: 'success.com',
              cancelUrl: 'cancel.com',
            };

            await mapSeries(Object.keys(requiredParameters), async key => {
              const { [key]: missingParameter, ...parameters } = requiredParameters;
              const res = await request(app)
                .post(`/resident/api/properties/${propertyId}/initiateScheduledPayment`)
                .set({ tenant: testCtx.name })
                .set(token)
                .send(parameters);

              expect(res.status).to.equal(400);
              expect(res.body.token).to.equal(`MISSING_REQUIRED_PARAMETER: ${key}`);
            });
          });
        });

        describe('when all params are present and request is valid', () => {
          it('responds with status code 200 and initiates the payment', async () => {
            const res2 = await request(app).get(`/resident/api/properties/${propertyId}/paymentInfo`).set({ tenant: testCtx.name }).set(token);
            expect(res2.status).to.equal(200);
            const body = res2.body;
            expect(body.length).to.equal(1);
            const unitUserInfo = body[0].unitUserInfo;
            const updatedValues = {
              successUrl: 'success.com',
              cancelUrl: 'cancel.com',
              propertyId,
              inventoryId: unitUserInfo.inventoryId,
              tenantName: testCtx.name,
            };

            const res = await request(app)
              .post(`/resident/api/properties/${propertyId}/initiateScheduledPayment`)
              .set({ tenant: testCtx.name })
              .set(token)
              .send(updatedValues);

            expect(res.status).to.equal(200);
          });
        });
      });
    });

    describe('DELETE /properties/:propertyId/scheduledPayments', () => {
      describe('given a request to remove a scheduled payment', () => {
        describe('when common user does not exist', () => {
          it('responds with status code 500 and MISSING_COMMON_USER_ID token', async () => {
            const newToken = getAuthHeader(testCtx.tenantId, newId(), null);
            const res = await request(app).delete(`/resident/api/properties/${propertyId}/scheduledPayments`).set({ tenant: testCtx.name }).set(newToken);
            expect(res.status).to.equal(500);
            expect(res.body.token).to.equal('MISSING_COMMON_USER_ID');
          });
        });

        describe('when property is not associated to user', () => {
          it('responds with status code 403 and PROPERTY_NOT_ASSOCIATED_TO_USER token', async () => {
            const res = await request(app).delete(`/resident/api/properties/${newId()}/scheduledPayments`).set({ tenant: testCtx.name }).set(token);
            expect(res.status).to.equal(403);
            expect(res.body.token).to.equal('PROPERTY_NOT_ASSOCIATED_TO_USER');
          });
        });

        describe('when the external id is missing', () => {
          it('responds with status code 400 and MISSING_REQUIRED_PARAMETER token', async () => {
            const res = await request(app).delete(`/resident/api/properties/${propertyId}/scheduledPayments`).set({ tenant: testCtx.name }).set(token);
            expect(res.status).to.equal(400);
            expect(res.body.token).to.equal('MISSING_REQUIRED_PARAMETER: externalId');
          });
        });

        describe('when external id is present', () => {
          it('responds with status 200 and removes the scheduled payment', async () => {
            const res = await request(app).delete(`/resident/api/properties/${propertyId}/scheduledPayments/${newId()}`).set(token);
            expect(res.status).to.equal(200);
          });
        });
      });
    });
  });
});
