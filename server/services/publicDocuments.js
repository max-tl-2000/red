/*
 * Copyright (c) 2022 Reva Technology Inc., all rights reserved.
 * Unauthorized copying of this file, via any medium is strictly prohibited
 * Licensed under the Elastic License 2.0; you may not use this file except
 * in compliance with the Elastic License 2.0.
 */

import getUUID from 'uuid/v4';
import omit from 'lodash/omit';
import { APP_EXCHANGE, UPLOAD_MESSAGE_TYPE } from '../helpers/message-constants';
import { stat } from '../../common/helpers/xfs';
import { sendMessage } from './pubsub';
import loggerModule from '../../common/helpers/logger';
const logger = loggerModule.child({ subType: 'fileUpload' });

const USER_KEYS_METADATA_TO_OMIT = ['associatedProperties', 'avatarUrl', 'teams', 'zendeskPrivateContentToken', 'zendeskCookieValue', 'sisenseCookieValue'];

export const uploadPublicDocuments = async (ctx, body) => {
  const files = ctx.files.map(file => ({
    id: getUUID(),
    ...file,
  }));

  const uploadingUser = omit(ctx.authUser || {}, USER_KEYS_METADATA_TO_OMIT);

  const stats = await Promise.all(
    files.map(async file => ({
      path: file.path,
      stats: await stat(file.path),
    })),
  );

  logger.trace({ ctx, uploadDocumentStats: stats }, 'uploadPublicDocuments service');

  const payload = {
    tenantId: ctx.tenantId,
    files,
    // TODO: pick only the fields which make sense to preserve
    metadata: {
      uploadingUser,
      body,
    },
    context: body.context,
  };

  await sendMessage({
    exchange: APP_EXCHANGE,
    key: UPLOAD_MESSAGE_TYPE.UPLOAD_PUBLIC_DOCUMENTS,
    message: payload,
    ctx,
  });
  return files;
};
