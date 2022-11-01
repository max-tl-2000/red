/*
 * Copyright (c) 2022 Reva Technology Inc., all rights reserved.
 * Unauthorized copying of this file, via any medium is strictly prohibited
 * Licensed under the Elastic License 2.0; you may not use this file except
 * in compliance with the Elastic License 2.0.
 */

import LeaseForm from '../test-pages/leaseForm';

module.exports = function leaseFormStepDefs() {
  const leaseForm = new LeaseForm();

  this.When(/^User publishes the lease$/, async () => {
    await leaseForm.clickPublishLeaseButton();
    await leaseForm.clickConfirmPublishButton();
  });
};
