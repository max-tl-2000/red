/*
 * Copyright (c) 2022 Reva Technology Inc., all rights reserved.
 * Unauthorized copying of this file, via any medium is strictly prohibited
 * Licensed under the Elastic License 2.0; you may not use this file except
 * in compliance with the Elastic License 2.0.
 */

import request from 'supertest';
import app from '../../../server/api/api';
import { tenant } from '../../../server/testUtils/setupTestGlobalContext';
import { getAuthHeader } from '../../../server/testUtils/apiHelper';
import { createJWTToken } from '../../../common/server/jwt-helpers';

export const createOrUpdatePersonApplication = personApplicationData =>
  request(app).post('/personApplications/current/screeningData').set(getAuthHeader()).send(personApplicationData);

export const resetCreditRequest = (userId, partyId) =>
  request(app).post(`/parties/${partyId}/rescreen`).set(getAuthHeader(undefined, userId)).send({ requestType: 'ResetCredit' });

export const getPersonApplication = personApplicationId => request(app).get(`/personApplications/${personApplicationId}`).set(getAuthHeader());

export const updatePersonApplication = personApplicationData =>
  request(app).patch(`/personApplications/${personApplicationData.id}`).set(getAuthHeader()).send(personApplicationData);

export const getDocumentsForPersonApplication = (personApplicationId, userId) =>
  request(app).get(`/personApplications/${personApplicationId}/documents`).set(getAuthHeader(undefined, userId, undefined, true, { personApplicationId }));

export const sendPaymentNotification = (invoiceId, personApplicationId, propertyId) => {
  const tenantId = tenant.id;
  const token = createJWTToken({ tenantId: tenant.id });
  return request(app)
    .post(`/webhooks/paymentNotification?tenantId=${tenantId}&token=${token}`)
    .send({ invoiceId, personApplicationId, propertyId })
    .expect(200);
};

export const getScreeningSummary = (partyId, quoteId, leaseTermId) => {
  const queryString = quoteId && leaseTermId ? `?quoteId=${quoteId}&leaseTermId=${leaseTermId}` : '';
  return request(app).get(`/screeningSummary/${partyId}${queryString}`).set(getAuthHeader());
};

export const updatePartyMember = async (member, partyId, userId) =>
  request(app).patch(`/parties/${partyId}/members/${member.id}`).set(getAuthHeader(tenant.id, userId)).send(member);

export const linkPartyMember = async (memberId, partyId, linkedPartyMemberIds, userId) =>
  request(app).post(`/parties/${partyId}/members/${memberId}/linkMember`).set(getAuthHeader(tenant.id, userId)).send(linkedPartyMemberIds);
