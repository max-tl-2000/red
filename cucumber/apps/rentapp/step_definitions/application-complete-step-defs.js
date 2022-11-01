/*
 * Copyright (c) 2022 Reva Technology Inc., all rights reserved.
 * Unauthorized copying of this file, via any medium is strictly prohibited
 * Licensed under the Elastic License 2.0; you may not use this file except
 * in compliance with the Elastic License 2.0.
 */

'use strict';
import ApplicationComplete from '../test-pages/application-complete';

// doing a default export because cucumber
module.exports = function applicationCompleteStepDefs() {
  const applicationComplete = new ApplicationComplete();

  this.Then(/^The 'Application Complete' page should be displayed$/, async () => {
    await applicationComplete.checkForApplicationComplete();
  });

  this.Then(/^It should contain a notification message: "([^"]*)"$/, async infoMessages => {
    await applicationComplete.checkForApplicationComplete(infoMessages);
  });
};
