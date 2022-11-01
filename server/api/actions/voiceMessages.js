/*
 * Copyright (c) 2022 Reva Technology Inc., all rights reserved.
 * Unauthorized copying of this file, via any medium is strictly prohibited
 * Licensed under the Elastic License 2.0; you may not use this file except
 * in compliance with the Elastic License 2.0.
 */

import { ServiceError } from '../../common/errors';
import { uploadVoiceMessages as uploadVoiceMessagesService } from '../../services/telephony/voiceMessages';

export const uploadVoiceMessages = async req => {
  if (!req.files) {
    throw new ServiceError({
      token: 'NO_FILES',
      status: 400,
    });
  }
  const { tenantId, authUser } = req;
  return await uploadVoiceMessagesService({ tenantId, authUser }, req.files);
};
