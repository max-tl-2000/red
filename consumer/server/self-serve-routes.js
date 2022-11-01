/*
 * Copyright (c) 2022 Reva Technology Inc., all rights reserved.
 * Unauthorized copying of this file, via any medium is strictly prohibited
 * Licensed under the Elastic License 2.0; you may not use this file except
 * in compliance with the Elastic License 2.0.
 */

import { tryDecodeJWTToken } from '../../common/server/jwt-helpers';
import { createSelfServeTokenByTenantId } from '../../common/server/token-helper';
import { consumerSupportedBrowsers as supportedBrowsers } from '../../common/server/browser-detector.ts';
import { renderReactTpl } from '../../common/render-react-tpl';
import { SelfServeView } from './views/self-serve-view';
import config from '../config';

const tokensPerTenantId = new Map();

const getSelfServeToken = async (tenantId, host) => {
  if (tokensPerTenantId.has(tenantId)) {
    return tokensPerTenantId.get(tenantId);
  }

  const token = await createSelfServeTokenByTenantId(tenantId, host);

  tokensPerTenantId.set(tenantId, token);

  return token;
};

const processAppointmentAction = async (req, res) => {
  const { appointmentToken, action } = req.params;

  if (!appointmentToken) throw new Error('MISSING_APPOINTMENT_TOKEN');
  if (!action.match(/^edit$|^cancel$/)) throw new Error(`INVALID_ACTION: ${action}`);

  const {
    result: { tenantId, tenantName, programEmailIdentifier },
  } = tryDecodeJWTToken(appointmentToken);

  const websiteToken = await getSelfServeToken(tenantId, req.hostname);

  const { translator } = req.i18n || {};

  const envParts = req.hostname.split('.');
  envParts.shift();
  const envPart = envParts.join('.');

  const hostname = `${tenantName}.${envPart}`;
  const staticHostname = `static.${envPart}`;

  const props = {
    token: websiteToken,
    appointmentToken,
    hostname,
    staticHostname,
    programEmailIdentifier,
    action,
    title: translator ? translator.translate('SELF_SERVE_TITLE') : '',
    cloudEnv: config.cloudEnv,
  };

  const indexContent = renderReactTpl(SelfServeView, {
    props,
    req,
    supportedBrowsers,
  });

  res.send(indexContent);
};

export const handleAppointmentAction = async (req, res, next) => {
  try {
    await processAppointmentAction(req, res);
  } catch (error) {
    next(error);
  }
};
