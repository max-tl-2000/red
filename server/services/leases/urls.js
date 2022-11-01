/*
 * Copyright (c) 2022 Reva Technology Inc., all rights reserved.
 * Unauthorized copying of this file, via any medium is strictly prohibited
 * Licensed under the Elastic License 2.0; you may not use this file except
 * in compliance with the Elastic License 2.0.
 */

import { getLeaseSignatureStatuses } from '../../dal/leaseRepo';
import { createJWTToken } from '../../../common/server/jwt-helpers';
import { sendUrltoShortener } from '../urlShortener';

import loggerModule from '../../../common/helpers/logger';

import config from '../../config';
import { getTenantData } from '../../dal/tenantsRepo';
import envVal from '../../../common/helpers/env-val';

const logger = loggerModule.child({ subType: 'leases/urls' });

export const getHostnameFromTenantId = async (ctx, tenantId) => {
  logger.trace({ ctx, tenantId }, 'getHostnameFromTenantId');

  const { name: tenantName } = await getTenantData(ctx, tenantId);
  const isProdEnv = config.cloudEnv === 'prod';

  const hostname = isProdEnv ? `${tenantName}.reva.tech` : `${tenantName}.${envVal('DOMAIN', 'local.env.reva.tech')}`;
  logger.trace({ ctx, tenantName, isProdEnv, hostnameForURL: hostname }, 'Determined hostname for tenant'); // Bunyan won't log a field with the name `hostname`

  return hostname;
};

export const getSignatureUrl = async (ctx, leaseId, partyMemberId) => {
  logger.trace({ ctx, ctxHostname: ctx.hostname, leaseId, partyMemberId }, 'getSignatureUrl');
  const signatures = await getLeaseSignatureStatuses(ctx, leaseId);
  const signature = signatures.find(s => s.partyMemberId === partyMemberId);

  const hostname = await getHostnameFromTenantId(ctx, ctx.tenantId);

  const token = createJWTToken({ signatureId: signature.id }, { expiresIn: '1y' });
  const url = `https://${hostname}/signature-token?token=${token}`;
  logger.trace({ ctx, leaseId }, 'Sending sign lease email');
  const [shortenedUrl] = await sendUrltoShortener(ctx, [url]);

  return { shortenedUrl, signatureId: signature.id, token };
};

export const getDownloadLeaseUrl = async (ctx, leaseId) => {
  logger.trace({ ctx, ctxHostname: ctx.hostname, leaseId }, 'getDownloadLeaseUrl');

  const hostname = await getHostnameFromTenantId(ctx, ctx.tenantId);

  const token = createJWTToken({ leaseId }, { expiresIn: '1y' });
  const url = `https://${hostname}/leases/download?token=${token}`;
  const [shortenedUrl] = await sendUrltoShortener(ctx, [url]);

  return shortenedUrl;
};
