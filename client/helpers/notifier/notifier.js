/*
 * Copyright (c) 2022 Reva Technology Inc., all rights reserved.
 * Unauthorized copying of this file, via any medium is strictly prohibited
 * Licensed under the Elastic License 2.0; you may not use this file except
 * in compliance with the Elastic License 2.0.
 */

// notifier
import snackbar from 'helpers/snackbar/snackbar';

function showMessage(message) {
  const snackBarObj = { text: message };
  snackbar.show(snackBarObj);
}

const notifier = {
  info: showMessage,
  error: showMessage,
  success: showMessage,
};

export default notifier;
