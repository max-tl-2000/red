/*
 * Copyright (c) 2022 Reva Technology Inc., all rights reserved.
 * Unauthorized copying of this file, via any medium is strictly prohibited
 * Licensed under the Elastic License 2.0; you may not use this file except
 * in compliance with the Elastic License 2.0.
 */

import v4 from 'uuid/v4';
import { X_REQUEST_ID, X_ORIGINAL_REQUEST_IDS, X_DOCUMENT_VERSION, parseHeaderValuesFromArray } from '../enums/requestHeaders';

export const setRequestMiddleware = ({ app }) =>
  app.use((req, res, next) => {
    req.reqId = req.reqId || req.get(X_REQUEST_ID) || v4();
    res.setHeader(X_REQUEST_ID, req.reqId);

    const originalRequestIds = req.get(X_ORIGINAL_REQUEST_IDS);
    if (originalRequestIds) {
      req.originalRequestIds = parseHeaderValuesFromArray(originalRequestIds);
      res.setHeader(X_ORIGINAL_REQUEST_IDS, originalRequestIds);
    }
    const documentVersion = req.get(X_DOCUMENT_VERSION);
    if (documentVersion) {
      req.documentVersion = documentVersion;
      res.setHeader(X_DOCUMENT_VERSION, documentVersion);
    }

    next();
  });
