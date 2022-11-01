/*
 * Copyright (c) 2022 Reva Technology Inc., all rights reserved.
 * Unauthorized copying of this file, via any medium is strictly prohibited
 * Licensed under the Elastic License 2.0; you may not use this file except
 * in compliance with the Elastic License 2.0.
 */

import { getRecipientQuery } from '../../dal/personRepo';
import { getDisplayName as getPersonDisplayName } from '../../../common/helpers/person-helper';
import { VIEW_MODEL_TYPES } from './enums';
import { getSignatureUrl, getDownloadLeaseUrl } from '../leases/urls';
import { createApplicationToken } from '../../helpers/auth';
import { resolveSubdomainURL } from '../../../common/helpers/resolve-url';
import { sendUrltoShortener } from '../urlShortener';
import { getTenant } from '../tenantService';
import { getRegistrationToken } from '../../../auth/server/services/common-user';
import { createTokenForGenericResetPasswordMail } from '../mails';
import config from '../../config';
import { DALTypes as AuthDALTypes } from '../../../auth/common/enums/dal-types';

export const viewModelType = VIEW_MODEL_TYPES.OBJECT;

export const getContextQuery = (ctx, { personId, partyId, quoteId, commonUserId }) =>
  getRecipientQuery(ctx, { personId, partyId, quoteId, commonUserId }).toString();

const resolveHost = ({ hostname, tenantDomain }) => hostname || tenantDomain;

export const tokensMapping = {
  name: ({ fullName }, { person }) => fullName || getPersonDisplayName(person, { usePreferred: true, ignoreContactInfo: true }),
  contractViewUrl: async ({ partyMemberId }, { ctx, leaseId }) => {
    if (!leaseId) return '';

    const { shortenedUrl } = await getSignatureUrl(ctx, leaseId, partyMemberId);
    return shortenedUrl;
  },
  contractDownloadUrl: async ({ partyMemberId }, { ctx, leaseId }) => {
    if (!leaseId) return '';

    return await getDownloadLeaseUrl(ctx, leaseId, partyMemberId);
  },
  applicationUrl: async ({ quotePropertyId }, { ctx, partyId, propertyId, person, createdFromCommId }) => {
    const hostname = resolveHost(ctx);
    const applicationToken = await createApplicationToken(
      { ...ctx, hostname },
      { partyId, person, propertyId: quotePropertyId || propertyId, createdFromCommId },
    );
    const rentAppUrl = resolveSubdomainURL(`https://${hostname}${config.rentapp.welcomeUrl}/${applicationToken}`, config.rentapp.hostname);
    const [shortenedUrl] = await sendUrltoShortener(ctx, [rentAppUrl]);

    return shortenedUrl;
  },
  completeRegistrationUrl: async ({ quotePropertyId, commonUser, personApplicationId }, { ctx, partyId, person, propertyId, quoteId }) => {
    if (!commonUser || !personApplicationId) return '';
    const host = resolveHost(ctx);
    const tenant = await getTenant(ctx);

    const token = await getRegistrationToken(ctx, commonUser, {
      partyId,
      quoteId,
      personApplicationId,
      propertyId: quotePropertyId || propertyId,
      personId: person.id,
      tenantDomain: resolveSubdomainURL(host, tenant.name, false),
    });
    const url = resolveSubdomainURL(`https://${host}/${config.mail.registration.registrationPath}?token=${token}`, config.mail.registration.tenantName);

    const [shortenedUrl] = await sendUrltoShortener(ctx, [url]);
    return shortenedUrl;
  },
  resetPasswordUrl: async ({ commonUser }, { ctx }) => {
    if (!commonUser) return '';

    const tenant = await getTenant(ctx);

    const token = createTokenForGenericResetPasswordMail({ appId: AuthDALTypes.ApplicationAppId, ...ctx }, { isRentappReset: true, commonUser, tenant });
    const url = resolveSubdomainURL(`https://${resolveHost(ctx)}${config.rentapp.confirmResetPasswordUrl}/${token}`, config.rentapp.hostname);

    const [shortenedUrl] = await sendUrltoShortener(ctx, [url]);
    return shortenedUrl;
  },
  username: 'commonUser.email',
};
