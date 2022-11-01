/*
 * Copyright (c) 2022 Reva Technology Inc., all rights reserved.
 * Unauthorized copying of this file, via any medium is strictly prohibited
 * Licensed under the Elastic License 2.0; you may not use this file except
 * in compliance with the Elastic License 2.0.
 */

import { tenant } from 'support/hooks';
import {
  sendGuestSMS,
  // verifyGuestReceivedMessageFromNumber,
  deleteMessagesFromNumber,
  getProgramByEmailIdentifier,
} from 'lib/utils/apiHelper';
import logger from 'helpers/logger';

const getProgramPhone = async () => {
  const { directPhoneIdentifier } = await getProgramByEmailIdentifier({ tenantId: tenant.id, directEmailIdentifier: 'resident-referral.parkmerced' });
  return directPhoneIdentifier;
};

module.exports = function incomingSMS() {
  this.When(/^The future prospect sends the following SMS message: "([^"]*)"$/, async smsMsg => {
    tenant.metadata.plivoGuestPhoneNumber = await sendGuestSMS({ msg: smsMsg, to: await getProgramPhone(), tenantId: tenant.id });
  });

  this.When(/^The guest received the following message "([^"]*)" from tenant phone number$/, async msgText => {
    logger.info({ msgText }, 'skipping sms verification for now of msgText');
    // TODO: restore this to verify that outbound fake sms was sent
    // await verifyGuestReceivedMessageFromNumber({ receivedMessage: msgText, from: tenant.metadata.phoneNumbers[0].phoneNumber })
  });

  this.When(/^Last message received is "([^"]*)" from tenant phone number$/, async msgText => {
    logger.info({ msgText }, 'skipping sms verification for now of msgText');
    // TODO: restore this to verify that outbound fake sms was sent
    // await verifyGuestReceivedMessageFromNumber({ receivedMessage: msgText, from: tenant.metadata.phoneNumbers[0].phoneNumber })
  });

  this.When(/^The guest replies with: "([^"]*)"$/, async smsMsg => {
    tenant.metadata.plivoGuestPhoneNumber = await sendGuestSMS({ msg: smsMsg, to: await getProgramPhone(), tenantId: tenant.id });
  });

  this.Given(/^The guest messages are deleted for the given number$/, async () => await deleteMessagesFromNumber({ from: await getProgramPhone() }));
};
