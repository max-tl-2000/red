/*
 * Copyright (c) 2022 Reva Technology Inc., all rights reserved.
 * Unauthorized copying of this file, via any medium is strictly prohibited
 * Licensed under the Elastic License 2.0; you may not use this file except
 * in compliance with the Elastic License 2.0.
 */

import { sendRegistrationEmail as send } from '../../services/mails';

export default function sendRegistrationEmail(req) {
  const email = req.body.email;

  return send(req, email);
}
