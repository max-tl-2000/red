/*
 * Copyright (c) 2022 Reva Technology Inc., all rights reserved.
 * Unauthorized copying of this file, via any medium is strictly prohibited
 * Licensed under the Elastic License 2.0; you may not use this file except
 * in compliance with the Elastic License 2.0.
 */

import { t } from 'i18next';

const supportedFileTypes = [
  'application/msword',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'application/pdf',
  'image/png',
  'image/gif',
  'image/jpeg',
];

export const maximumAttachmentSizeInMB = 7;

const isValidFileTypeForAttachment = fileType => supportedFileTypes.some(type => fileType === type);

const getTotalFileSizeInMB = files => files.map(file => file.size / 1000000.0).reduce((a, b) => a + b, 0);

export const getEmailAttachmentValidations = () => {
  const validations = {
    type: {
      validator: isValidFileTypeForAttachment,
      message: t('INVALID_FILE_TYPE'),
    },
  };

  return validations;
};

export const validateAttachmentsSize = (existingFiles, pendingFiles, newFiles) => {
  const filesAlreadyAttached = getTotalFileSizeInMB(existingFiles);
  const filesAlreadyPending = getTotalFileSizeInMB(pendingFiles);
  const filesBeingAttached = getTotalFileSizeInMB(newFiles);
  return filesAlreadyAttached + filesAlreadyPending + filesBeingAttached <= maximumAttachmentSizeInMB;
};
