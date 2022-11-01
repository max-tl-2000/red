/*
 * Copyright (c) 2022 Reva Technology Inc., all rights reserved.
 * Unauthorized copying of this file, via any medium is strictly prohibited
 * Licensed under the Elastic License 2.0; you may not use this file except
 * in compliance with the Elastic License 2.0.
 */

export const X_REQUEST_ID = 'X-Request-Id';
export const X_SOCKET_ID = 'X-Socket-Id';
export const X_ORIGINAL_REQUEST_IDS = 'X-Original-Request-Ids';
export const X_DOCUMENT_VERSION = 'X-Document-Version';
export const X_ROBOTS_TAG = 'X-Robots-Tag';

export const formatArrayHeaderValues = values => values.join();
export const parseHeaderValuesFromArray = header => header.split(',').filter(value => value);
