/*
 * Copyright (c) 2022 Reva Technology Inc., all rights reserved.
 * Unauthorized copying of this file, via any medium is strictly prohibited
 * Licensed under the Elastic License 2.0; you may not use this file except
 * in compliance with the Elastic License 2.0.
 */

import { t } from 'i18next';
import { FileQueueModel } from '../components/MultiFileUploader/FileQueueModel';
import { uploadState } from '../components/MultiFileUploader/uploadState';

export const createSimpleUploaderModel = ({ client, files = [], validations = {}, uploadPath, fileSize, context }) =>
  new FileQueueModel({
    uploadState,
    validations,
    files,
    apiClient: client,
    uploadPath,
    serverErrorMessages: {
      size: t('LIMIT_FILE_SIZE', { fileSize }),
      generic: t('SERVER_ERROR'),
    },
    context,
  });
