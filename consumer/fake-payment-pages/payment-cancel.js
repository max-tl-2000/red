/*
 * Copyright (c) 2022 Reva Technology Inc., all rights reserved.
 * Unauthorized copying of this file, via any medium is strictly prohibited
 * Licensed under the Elastic License 2.0; you may not use this file except
 * in compliance with the Elastic License 2.0.
 */

/* eslint-disable */
function isLoadedInsideAnIframe() {
  try {
    return window.self !== window.top;
  } catch (e) {
    return true;
  }
}

(function paymentCancel() {
  if (isLoadedInsideAnIframe()) {
    var container = document.getElementById('container');
    container.style.display = 'none';
    try {
      window.parent.postMessage(
        {
          message: JSON.stringify({
            action: 'transactionCanceled',
          }),
        },
        '*',
      );
    } catch (err) {
      console.error('Unable to notify parent!', err);
      throw err;
    }
  }
})();
