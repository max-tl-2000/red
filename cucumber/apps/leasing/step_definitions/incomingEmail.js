/*
 * Copyright (c) 2022 Reva Technology Inc., all rights reserved.
 * Unauthorized copying of this file, via any medium is strictly prohibited
 * Licensed under the Elastic License 2.0; you may not use this file except
 * in compliance with the Elastic License 2.0.
 */

import { tenant } from 'support/hooks';
import { verifyEmailIsDelivered, replyToEmailWith, sendGuestEmail } from 'lib/utils/apiHelper';
import logger from 'helpers/logger';

module.exports = function incomingEmail() {
  this.Then(/^The email with subject "([^"]*)" is delivered to the guest$/, async subject => {
    logger.info({ subject }, 'verifying that email is delivered');
    await verifyEmailIsDelivered({ subject, tenantId: tenant.id });
  });

  this.When(/^The guest replies to the email with "([^"]*)"$/, async replyText => {
    logger.info({ replyText }, 'reply to email with text');
    await replyToEmailWith({ replyText, tenantId: tenant.id });
  });

  this.When(/^The guest sends an email with subject "([^"]*)" and body "([^"]*)"$/, async (subject, body) => {
    logger.info({ subject, body }, 'reply to email with text');
    await sendGuestEmail({ subject, body, tenantId: tenant.id });
  });
};
