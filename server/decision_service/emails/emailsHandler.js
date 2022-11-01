/*
 * Copyright (c) 2022 Reva Technology Inc., all rights reserved.
 * Unauthorized copying of this file, via any medium is strictly prohibited
 * Licensed under the Elastic License 2.0; you may not use this file except
 * in compliance with the Elastic License 2.0.
 */

import loggerModule from '../../../common/helpers/logger';
import { partyEmailIntegrationEndpoint, postEntity } from '../utils';
import { processApplicationEmail } from './application/applicationHandler';
import { processLeaseEmail } from './leaseHandler';
import { processQuoteEmail } from './quoteHandler';
import { processAppointmentEmail } from './appointmentHandler';
import { processResidentsInviteEmail } from './residentsInviteHandler';
import { processPaymentEmail } from './application/paymentHandler';
import { processPersonApplicationInviteEmail } from './application/personApplicationInviteHandler';

const logger = loggerModule.child({ subType: 'decision_service/emailsHandler' });

const processEmail = async (ctx, party, token, checker, checkerName) => {
  const endpoint = partyEmailIntegrationEndpoint(party.callBackUrl, party.id);
  const { emailInfo } = await checker(ctx, party);

  if (emailInfo) {
    const { error } = await postEntity(ctx, { emailInfo }, endpoint, token);
    if (error) {
      logger.error({ ctx, error, emailHandler: checkerName }, 'emailHandler/processEmail');
      return { error };
    }
  } else {
    logger.trace({ ctx, emailHandler: checkerName }, 'emailHandler/processEmail - no email info');
  }

  return {};
};

export const processApplication = async (ctx, party, token) => await processEmail(ctx, party, token, processApplicationEmail, 'processApplicationEmail');
export const processLease = async (ctx, party, token) => await processEmail(ctx, party, token, processLeaseEmail, 'processLeaseEmail');
export const processQuote = async (ctx, party, token) => await processEmail(ctx, party, token, processQuoteEmail, 'processQuoteEmail');
export const processAppointment = async (ctx, party, token) => await processEmail(ctx, party, token, processAppointmentEmail, 'processAppointmentEmail');
export const processPayment = async (ctx, party, token) => await processEmail(ctx, party, token, processPaymentEmail, 'processPaymentEmail');
export const processPersonApplicationInvite = async (ctx, party, token) =>
  await processEmail(ctx, party, token, processPersonApplicationInviteEmail, 'processPersonApplicationInviteEmail');
export const processResidentsInvite = async (ctx, party, token) =>
  await processEmail(ctx, party, token, processResidentsInviteEmail, 'processResidentsInviteEmail');
