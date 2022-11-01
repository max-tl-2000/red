/*
 * Copyright (c) 2022 Reva Technology Inc., all rights reserved.
 * Unauthorized copying of this file, via any medium is strictly prohibited
 * Licensed under the Elastic License 2.0; you may not use this file except
 * in compliance with the Elastic License 2.0.
 */

import { DALTypes } from '../../../../common/enums/DALTypes';
import logger from '../../../../common/helpers/logger';
import * as appSettings from '../../../services/appSettings';

export const processPaymentEmail = async (ctx, party) => {
  logger.trace({ ctx, partyId: party.id }, 'process received payment event');

  const paymentEvent = party.events.find(ev => [DALTypes.PartyEventType.PAYMENT_RECEIVED].includes(ev.event));
  if (!paymentEvent) return {};

  const sendRegistrationEmailEnabled = await appSettings.getAppSettingValue(ctx, 'SendRegistrationEmail');
  if (sendRegistrationEmailEnabled !== 'true') {
    logger.trace({ ctx }, 'sendRegistrationEmail disabled from AppSettings');
    return {};
  }

  const { tenantName, invoiceId, host, commonUserHasPassword } = paymentEvent.metadata;
  if (commonUserHasPassword) {
    logger.trace({ ctx, invoiceId }, 'sendRegistrationEmail not required, account is registered');
    return {};
  }

  const templateName = await appSettings.getAppSettingValue(ctx, 'ApplicationCompleteRegistrationEmailTemplate');

  return {
    emailInfo: {
      partyId: party.id,
      type: paymentEvent.event,
      tenantName,
      host,
      invoiceId,
      templateName,
    },
  };
};
