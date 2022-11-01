/*
 * Copyright (c) 2022 Reva Technology Inc., all rights reserved.
 * Unauthorized copying of this file, via any medium is strictly prohibited
 * Licensed under the Elastic License 2.0; you may not use this file except
 * in compliance with the Elastic License 2.0.
 */

'use strict';
import SignLeasePage from '../test-pages/signLeasePage';

module.exports = function signLeasePageStepDefs() {
  const signLeasePage = new SignLeasePage();

  this.Then(/^The 'Sign Lease' page should open$/, async () => {
    signLeasePage.switchToTab(2);
    await signLeasePage.checkForSignLeasePage();
  });

  this.When(/^The user checks 'Identity confirmation' checkbox$/, async () => await signLeasePage.checkIdentityVerifiedCheckbox());

  this.Then(/^User clicks 'Start Signature' button$/, async () => await signLeasePage.clickStartSignatureButton());
};
