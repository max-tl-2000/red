/*
 * Copyright (c) 2022 Reva Technology Inc., all rights reserved.
 * Unauthorized copying of this file, via any medium is strictly prohibited
 * Licensed under the Elastic License 2.0; you may not use this file except
 * in compliance with the Elastic License 2.0.
 */

import { APP_EXCHANGE, EXPORT_MESSAGE_TYPE } from '../../helpers/message-constants';
import { sendMessage } from '../../services/pubsub';

export const exportDatabaseToSpreadsheet = async req => {
  const { properties, workbookSheets, exportDateTime } = req.body;
  const payload = {
    tenantId: req.tenantId,
    authUser: req.authUser,
    properties,
    workbookSheets,
    exportDateTime,
  };

  await sendMessage({
    exchange: APP_EXCHANGE,
    key: EXPORT_MESSAGE_TYPE.EXPORT_FROM_DB,
    message: payload,
    ctx: req,
  });
};
