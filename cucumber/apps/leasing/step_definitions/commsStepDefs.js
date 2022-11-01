/*
 * Copyright (c) 2022 Reva Technology Inc., all rights reserved.
 * Unauthorized copying of this file, via any medium is strictly prohibited
 * Licensed under the Elastic License 2.0; you may not use this file except
 * in compliance with the Elastic License 2.0.
 */

'use strict';
import Communication from '../test-pages/communication';

module.exports = function commsStepDefs() {
  const communication = new Communication();

  this.Then(/^The Communication section should contain a thread with message "([^"]*)"$/, arg1 => communication.checkSmsMsg(arg1));

  this.When(/^User clicks on communication thread$/, () => communication.clickOnSmsThread());

  this.Then(/^The email flyout should open$/, () => communication.checkEmailFlyoutOpen());

  this.Then(/^The SMS flyout should open$/, () => communication.checkSmsFlyoutOpen());

  this.Then(/^The SMS flyout should contain "([^"]*)"$/, arg1 => communication.checkMsgInSmsFlyout(arg1));

  this.Then(/^The SMS flyout title should display "([^"]*)"$/, arg1 => communication.checkTitleInSmsFlyout(arg1));

  this.Then(/^The communication section should contain "([^"]*)" email threads$/, async arg1 => await communication.checkEmailThreadNo(arg1));

  this.Then(/^The communication section should contain an email with the subject "([^"]*)"$/, async subject => await communication.checkEmailMsg(subject));

  this.Then(/^User close the SMS flyout$/, () => communication.closeSMSFlyOut());

  this.When(/^User clicks new email button$/, async () => await communication.clickNewEmailButton());

  this.Then(/^The Communication section should display only "([^"]*)" Sms thread$/, arg1 => communication.checkSmsThreadNo(arg1));
};
