/*
 * Copyright (c) 2022 Reva Technology Inc., all rights reserved.
 * Unauthorized copying of this file, via any medium is strictly prohibited
 * Licensed under the Elastic License 2.0; you may not use this file except
 * in compliance with the Elastic License 2.0.
 */

import { APP_EXCHANGE, IMPORT_MESSAGE_TYPE } from '../../helpers/message-constants';
import { sendMessage } from '../../services/pubsub';

const uploadWorkbook = async (req, inventoryFile) => {
  const payload = {
    tenantId: req.tenantId,
    authUser: req.authUser,
    inputWorkbookPath: inventoryFile.path,
    removeInputFile: true,
    notifyDataChanged: true,
    metadata: {
      files: [inventoryFile],
    },
  };

  await sendMessage({
    exchange: APP_EXCHANGE,
    key: IMPORT_MESSAGE_TYPE.PROCESS_WORKBOOK,
    message: payload,
    ctx: req,
  });
};

const uploadAssets = async (req, assetsFile) => {
  const payload = {
    tenantId: req.tenantId,
    authUser: req.authUser,
    filePath: assetsFile.path,
    metadata: {
      files: [assetsFile],
    },
  };

  await sendMessage({
    exchange: APP_EXCHANGE,
    key: IMPORT_MESSAGE_TYPE.UPLOAD_ASSETS,
    message: payload,
    ctx: req,
  });
};

export const uploadDataImportFiles = async req => {
  const inventoryFile = req.files.find(file => !!file.originalName.match(/\.xlsx$/i));
  const assetsFile = req.files.find(file => !!file.originalName.match(/\.zip$/i));

  if (inventoryFile) {
    await uploadWorkbook(req, inventoryFile);
  }

  if (assetsFile) {
    await uploadAssets(req, assetsFile);
  }
};
