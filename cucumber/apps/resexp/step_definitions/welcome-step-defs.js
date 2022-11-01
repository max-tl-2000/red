/*
 * Copyright (c) 2022 Reva Technology Inc., all rights reserved.
 * Unauthorized copying of this file, via any medium is strictly prohibited
 * Licensed under the Elastic License 2.0; you may not use this file except
 * in compliance with the Elastic License 2.0.
 */

'use strict';

import Welcome from '../pages/welcome';

// doing a default export because cucumber
module.exports = function welcomeStepDefs() {
  const welcome = new Welcome();

  // Consider move steps that are pretty common to genericSteps
  this.When(/^User opens the 'Welcome' page in resident app$/, async () => {
    await welcome.open();
  });

  // Consider move steps that are pretty common to genericSteps
  this.Then(/^The 'Welcome' page should be displayed in resident app$/, async () => {
    await welcome.checkForWelcome();
  });
};
