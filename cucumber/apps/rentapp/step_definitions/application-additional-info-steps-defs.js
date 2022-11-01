/*
 * Copyright (c) 2022 Reva Technology Inc., all rights reserved.
 * Unauthorized copying of this file, via any medium is strictly prohibited
 * Licensed under the Elastic License 2.0; you may not use this file except
 * in compliance with the Elastic License 2.0.
 */

'use strict';
import ApplicationAdditionalInfo from '../test-pages/application-additional-info';
import BasePage from '../../../lib/BasePage';
import sleep from '../../../../common/helpers/sleep';

// doing a default export because cucumber
module.exports = function applicationAdditionalInfoStepDefs() {
  const applicationAdditionalInfo = new ApplicationAdditionalInfo();
  const base = new BasePage();

  this.Then(/^The 'Application Additional Info' page should be displayed$/, async () => {
    await applicationAdditionalInfo.checkForApplicantAdditionalInfo();
  });

  this.When(/^Clicks "([^"]*)" step if is available$/, async step => {
    await applicationAdditionalInfo.clickOnStep(step);
  });

  this.Then(/^Selects one renter insurance option: "([^"]*)"$/, async option => {
    await applicationAdditionalInfo.selectRenterInsurance(option);
  });

  this.Then(/^An account has been created: "([^"]*)"$/, async message => {
    await applicationAdditionalInfo.checkForAccountMessage(message);
  });

  this.When(/^Aplicant member "([^"]*)" is in part 2$/, async guestName => {
    base.switchToTab(2);
    await sleep(500);
    await applicationAdditionalInfo.checkWelcomeLabel();
    await applicationAdditionalInfo.guestName(guestName);
  });

  this.When(/^Clicks 'I AM DONE' button$/, async () => {
    await applicationAdditionalInfo.iAmDoneButton();
  });
};
