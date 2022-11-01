/*
 * Copyright (c) 2022 Reva Technology Inc., all rights reserved.
 * Unauthorized copying of this file, via any medium is strictly prohibited
 * Licensed under the Elastic License 2.0; you may not use this file except
 * in compliance with the Elastic License 2.0.
 */

import { processUnparsedPayment } from '../../services/payment';
import loggerModule from '../../../../common/helpers/logger';
import { logCtx } from '../../../../common/helpers/logger-utils';
const logger = loggerModule.child({ subType: 'Payment Notification Handler' });
/*
 * Handle notifications sent to /paymentNotifications
 *
 * @param {Object} message
 * @return {Object} return { processed: true } when it does not require requueuing
 * msg contents are specific to the provider.  For Aptexx, the format is:
 { paymentId: 25, // Aptexx-provided ID for this payment
   createdOn: 1487911576027, // epoch time ms
   amount: 4000, // amount in cents
   integrationId: 'e0ba30a1-c55f-483b-8de2-d3698ce61a70', // invoiceId
  groupIntegrationId: 'a5a467e2-f0b6-40ca-bc46-a881c307b3f6', // tenantId
  firstName: 'Ben',
  email: 'mmigdol+ben@reva.tech',
  lastFour: '4242',
  channelType: 'CREDIT',
  brandType: 'VISA',
  entryType: 'KEYED' }
 */
// This is a short-term implementation that just updates the invoice from the message
// and then acks the message
// The actual work to update screening application and invite new applicants
// is still being done in the payment notification handler
export const handlePaymentNotificationReceived = async msg => {
  logger.debug(msg, 'handlePaymentNotificationReceived');
  try {
    await processUnparsedPayment(msg);
  } catch (error) {
    logger.error({ error, ...logCtx(msg), amqpMessage: msg }, 'Unable to process payment notification');
    if (error instanceof TypeError) throw error; // rethrow since this probably indicates a bug that can be fixed later
    // otherwise we don't really need to retry since we poll transactions anyway
    logger.warn('message will NOT be retried');
    return { processed: true };
  }

  return { processed: true };
};
