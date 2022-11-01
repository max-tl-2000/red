/*
 * Copyright (c) 2022 Reva Technology Inc., all rights reserved.
 * Unauthorized copying of this file, via any medium is strictly prohibited
 * Licensed under the Elastic License 2.0; you may not use this file except
 * in compliance with the Elastic License 2.0.
 */

import ApiClient from 'helpers/ApiClient';
import { uploadState } from './sendEmailUploadState';

export const client = new ApiClient();

client.on('request:start', (e, args) => {
  uploadState.notifyStart(args);
});

client.on('request:progress', (e, args) => {
  uploadState.notifyProgress(args);
});

client.on('request:end', (e, args) => {
  uploadState.notifyEnd(args);
});
