/*
 * Copyright (c) 2022 Reva Technology Inc., all rights reserved.
 * Unauthorized copying of this file, via any medium is strictly prohibited
 * Licensed under the Elastic License 2.0; you may not use this file except
 * in compliance with the Elastic License 2.0.
 */

import { createJWTToken } from '../../common/server/jwt-helpers';
import { loadPartyMemberById } from '../dal/partyRepo';
import { getPartyApplicationByPartyId } from '../../rentapp/server/services/party-application';
import { getPersonApplicationByPersonIdAndPartyApplicationId } from '../../rentapp/server/services/person-application';
import { getApplicationInvoicesByFilter } from '../../rentapp/server/services/application-invoices';
import { getCommonUserByPersonId } from '../../auth/server/services/common-user';
import { isApplicationPaid } from '../../common/helpers/applicants-utils';
import config from '../config';

// TODO: use ctx
const getApplicantTokenInformation = async (tenantId, personId, partyId) => {
  const ctx = { tenantId };
  const commonUser = await getCommonUserByPersonId(ctx, personId);
  const { id: partyApplicationId } = (await getPartyApplicationByPartyId(ctx, partyId)) || {};
  if (!commonUser || !partyApplicationId) return {};

  const personApplication = await getPersonApplicationByPersonIdAndPartyApplicationId({ tenantId }, personId, partyApplicationId);
  if (!(personApplication && isApplicationPaid(personApplication))) return {};

  const [applicationInvoice] = await getApplicationInvoicesByFilter(ctx, {
    personApplicationId: personApplication.id,
    paymentCompleted: true,
  });

  const applicantInformation = {
    commonUserId: commonUser.userId,
    personApplicationId: personApplication.id,
    partyApplicationId,
  };
  applicationInvoice &&
    applicationInvoice.quoteId &&
    Object.assign(applicantInformation, {
      quoteId: applicationInvoice.quoteId,
    });
  return applicantInformation;
};

const getPersonInformation = async (tenantId, memberId, person) => {
  if (!memberId) return person;

  const [partyMember = {}] = await loadPartyMemberById({ tenantId }, memberId);
  return {
    id: partyMember.personId,
    preferredName: partyMember.preferredName,
    fullName: partyMember.fullName,
  };
};

const parseApplicantInformation = async ({ tenantId, hostname: tenantDomain }, tokenInfo) => {
  const { memberId, person, partyId, ...rest } = tokenInfo;
  const personInfo = await getPersonInformation(tenantId, memberId, person);

  return {
    tenantId,
    tenantDomain,
    partyId,
    personId: personInfo.id,
    personName: personInfo.preferredName || personInfo.fullName,
    ...rest,
  };
};

export const createApplicationToken = async (ctx, tokenInfo, options = {}) => {
  const applicantInformation = await parseApplicantInformation(ctx, tokenInfo);
  return createJWTToken(applicantInformation, { ...options, expiresIn: config.rentapp.tokenExpiration });
};

export const createImpersonationToken = async (ctx, tokenInfo) => {
  const applicantInformation = await parseApplicantInformation(ctx, tokenInfo);
  const { personId, partyId } = applicantInformation;
  Object.assign(applicantInformation, await getApplicantTokenInformation(ctx.tenantId, personId, partyId));
  return createJWTToken(applicantInformation);
};

export const createResidentToken = async (ctx, tokenInfo, options = {}) =>
  await createJWTToken(
    { tenantId: ctx.tenantId, ...tokenInfo },
    { ...options, jwtConfigKeyName: 'resident.emailJwtSecret', encryptionConfigKeyName: 'resident.emailEncryptionKey' },
  );
