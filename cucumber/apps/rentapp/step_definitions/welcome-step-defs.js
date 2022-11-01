/*
 * Copyright (c) 2022 Reva Technology Inc., all rights reserved.
 * Unauthorized copying of this file, via any medium is strictly prohibited
 * Licensed under the Elastic License 2.0; you may not use this file except
 * in compliance with the Elastic License 2.0.
 */

'use strict';

import Welcome from '../test-pages/welcome';

// doing a default export because cucumber
module.exports = function welcomeStepDefs() {
  const welcome = new Welcome();

  this.When(/^User opens the 'Welcome' page$/, async () => {
    await welcome.open();
  });

  this.Then(/^The 'Welcome' page should be displayed$/, async () => {
    await welcome.checkForWelcome();
  });

  this.When(/^Customer read and accept the terms of service : "([^"]*)"$/, async termsOfService => {
    await welcome.checkTermsOfService(termsOfService);
    await welcome.elementContinueButton();
  });
};
