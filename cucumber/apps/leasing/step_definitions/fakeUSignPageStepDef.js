/*
 * Copyright (c) 2022 Reva Technology Inc., all rights reserved.
 * Unauthorized copying of this file, via any medium is strictly prohibited
 * Licensed under the Elastic License 2.0; you may not use this file except
 * in compliance with the Elastic License 2.0.
 */

'use strict';
import FakeUSignPage from '../test-pages/fakeUSignPage';

module.exports = function fakeUSignPageStepDef() {
  const fakeUSignPage = new FakeUSignPage();

  this.Then(/^The 'Fake-U-Sign' page should open on tab (\d+)$/, async tabNo => {
    await fakeUSignPage.checkForFakeUSignPage(tabNo);
  });

  this.When(/^The user clicks the 'Sign Lease' button$/, async () => {
    await fakeUSignPage.clickSignButton();
  });
};
