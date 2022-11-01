/*
 * Copyright (c) 2022 Reva Technology Inc., all rights reserved.
 * Unauthorized copying of this file, via any medium is strictly prohibited
 * Licensed under the Elastic License 2.0; you may not use this file except
 * in compliance with the Elastic License 2.0.
 */

import ApiClient from 'helpers/ApiClient';
import { uploadState } from './importUploadState';

const restClientMap = new Map();

export const restClient = (componentName, { notifyUploadProgress, userToken }) => {
  const instance = {
    get client() {
      if (restClientMap.has(componentName)) return restClientMap.get(componentName);

      const client = new ApiClient();
      client.setExtraHeaders({
        Authorization: `Bearer ${userToken}`,
      });

      client.on('request:start', (_, args) => {
        if (componentName !== args.id) return;
        uploadState.notifyStart(args);
      });

      client.on('request:progress', (_, args) => {
        if (componentName !== args.id) return;
        uploadState.notifyProgress(args);
        notifyUploadProgress(componentName, uploadState.getPercentLoaded(args.id).toFixed(2));
      });

      client.on('request:end', (_, args) => {
        if (componentName !== args.id) return;
        uploadState.notifyEnd(args);

        if (!uploadState.isServerError(args.id)) return;
        notifyUploadProgress(componentName, uploadState.getPercentLoaded(args.id).toFixed(2), args.error);
      });
      restClientMap.set(componentName, client);
      return client;
    },
  };
  return instance;
};
