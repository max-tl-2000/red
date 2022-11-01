/*
 * Copyright (c) 2022 Reva Technology Inc., all rights reserved.
 * Unauthorized copying of this file, via any medium is strictly prohibited
 * Licensed under the Elastic License 2.0; you may not use this file except
 * in compliance with the Elastic License 2.0.
 */

import { sendResetPasswordMail as sendResetMail } from '../../services/mails';
import config from '../../config';

export default function sendResetPasswordMail(req) {
  const email = req.body.email;
  return sendResetMail(req, email, config.mail.resetMailSubject, config.mail.resetMailPath);
}
