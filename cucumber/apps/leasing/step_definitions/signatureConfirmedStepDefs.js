/*
 * Copyright (c) 2022 Reva Technology Inc., all rights reserved.
 * Unauthorized copying of this file, via any medium is strictly prohibited
 * Licensed under the Elastic License 2.0; you may not use this file except
 * in compliance with the Elastic License 2.0.
 */

'use strict';
import SignatureConfirmedPage from '../test-pages/signatureConfirmedPage';

module.exports = function SignatureConfirmedPageStepDefs() {
  const signatureConfirmedPage = new SignatureConfirmedPage();

  this.Then(/^The signature is confirmed page should appear$/, async () => await signatureConfirmedPage.checkSignatureConfirmedPage());
};
