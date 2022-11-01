/*
 * Copyright (c) 2022 Reva Technology Inc., all rights reserved.
 * Unauthorized copying of this file, via any medium is strictly prohibited
 * Licensed under the Elastic License 2.0; you may not use this file except
 * in compliance with the Elastic License 2.0.
 */

import multer from 'multer';
import path from 'path';

export const getUploadMiddleware = ({ config, fileFilter, maxSizeInMegabytes = 100, logger, filesAreRequired = false } = {}) => (req, res, next) => {
  const maxSizeInBytes = maxSizeInMegabytes * 1000 * 1000;
  const { EntityTooLargeError, BadRequestError } = require('./errors');
  const dest = path.resolve(config.aws.efsRootFolder, req.tenantId, 'uploads');
  const uploader = multer({
    dest,
    limits: { fileSize: maxSizeInBytes },
    fileFilter,
  });
  return uploader.array('files')(req, res, err => {
    const { files } = req;
    logger.info({ ctx: req, files, dest }, 'Uploading file(s) to efs');

    if (filesAreRequired && (!files || files.length === 0)) {
      next(new BadRequestError('NO_FILES_UPLOADED'));
      return;
    }
    if (files && files.some(f => f.size === 0)) {
      next(new BadRequestError('INVALID_FILE_SIZE_0KB'));
      return;
    }
    if (err) {
      logger.error({ err, ctx: req, dest }, 'Problem uploading file!');
      next(new EntityTooLargeError(`Max file size of ${maxSizeInMegabytes}MB exceeded`));
    } else {
      next();
    }
  });
};
