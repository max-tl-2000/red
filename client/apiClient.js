/*
 * Copyright (c) 2022 Reva Technology Inc., all rights reserved.
 * Unauthorized copying of this file, via any medium is strictly prohibited
 * Licensed under the Elastic License 2.0; you may not use this file except
 * in compliance with the Elastic License 2.0.
 */

import mediator from 'helpers/mediator';
import ApiClient from './helpers/ApiClient';
import { savingState } from './components/SavingAffordance/SavingAffordance';

export const client = new ApiClient();

if (process.env.NODE_ENV === 'development') {
  window.__apiClient = client;
}

client.on('request:start', (e, args) => {
  // we don't care about get methods,
  // we only care about post/put/patch/delete
  if (args.method === 'get' || (args.method === 'post' && args.path === '/log')) return;
  savingState.notifyStart(args);
});

client.on('request:end', (e, args) => {
  // we don't care about get methods,
  // we only care about post/put/patch/delete
  if (args.method === 'get' || (args.method === 'post' && args.path === '/log')) return;
  savingState.notifyEnd(args);
});

client.on('service:error', (e, args) => mediator.fire('service:error', args));

export const initAPIClient = store => {
  mediator.on('user:login', () => {
    const { auth } = store.getState();
    const { token, tokenExpirationTime } = auth;
    client.setExtraHeaders({ Authorization: `Bearer ${token}` });
    client.tokenExpirationTime = tokenExpirationTime;
  });

  mediator.on('user:logout', () => {
    client.clearHeaders();
  });
};
