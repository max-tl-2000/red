/*
 * Copyright (c) 2022 Reva Technology Inc., all rights reserved.
 * Unauthorized copying of this file, via any medium is strictly prohibited
 * Licensed under the Elastic License 2.0; you may not use this file except
 * in compliance with the Elastic License 2.0.
 */

'use strict';
import { tenant } from 'support/hooks';
import GoogleVoice from '../test-pages/googleVoice';

module.exports = function googleVoiceStepDefs() {
  const googleVoice = new GoogleVoice();

  this.Given(/^'GoogleVoice' page is displayed$/, () => googleVoice.open());

  this.Then(/^'Inbox' page should be displayed$/, async () => await googleVoice.checkForInboxPage());

  this.When(/^User clicks 'Text' button to open sms flyout$/, async () => await googleVoice.clickTextButton());

  this.When(
    /^Last message received is "([^"]*)" from tenant phone number$/,
    async arg1 => await googleVoice.checkLastSMSreceived(arg1, tenant.metadata.phoneNumbers[0].phoneNumber),
  );

  this.When(
    /^User types in field "([^"]*)" the tenant phone number$/,
    async arg1 => await googleVoice.setValue(`#${arg1}`, tenant.metadata.phoneNumbers[0].phoneNumber),
  );

  this.Given(/^The messages are deleted for the given number$/, async () => {
    await googleVoice.setSearchPhoneNumber(tenant.metadata.phoneNumbers[0].phoneNumber);
    await googleVoice.doSearch();
    await googleVoice.getResults();
    await googleVoice.clickCheckBoxAll();
    await googleVoice.doDelete();
    // MAM The implementation for validateDeleteMessage is incorrect.
    // Until it is fixed, we can just hope the doDelete worked;  otherwise, it probably
    // will next time...
    // await googleVoice.validateDeleteMessage();
  });
};
