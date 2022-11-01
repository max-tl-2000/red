/*
 * Copyright (c) 2022 Reva Technology Inc., all rights reserved.
 * Unauthorized copying of this file, via any medium is strictly prohibited
 * Licensed under the Elastic License 2.0; you may not use this file except
 * in compliance with the Elastic License 2.0.
 */

'use strict';
import PublishedQuote from '../test-pages/publishedQuote';

module.exports = function publishedQuoteStepDefs() {
  const publishedQuote = new PublishedQuote();

  this.Then(/^User shares quote by email$/, async () => {
    // await publishedQuote.validateBaseRentAmountNonZero(unit);
    await publishedQuote.clickSendQuoteByEmail();
    await publishedQuote.clickSendEmailFromDialog();
    await publishedQuote.validateThatEmailHasBeenSent();
    await publishedQuote.closeDialog();
  });
};
