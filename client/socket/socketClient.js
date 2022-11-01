/*
 * Copyright (c) 2022 Reva Technology Inc., all rights reserved.
 * Unauthorized copying of this file, via any medium is strictly prohibited
 * Licensed under the Elastic License 2.0; you may not use this file except
 * in compliance with the Elastic License 2.0.
 */

import io from 'socket.io-client';
import cfg from 'helpers/cfg';
import thenify from 'helpers/thenify';
import { initThrottlerer } from 'helpers/eventThrottling';
import { delayedLogout } from 'helpers/auth-helper';
import { isAdmin } from '../../common/helpers/auth';

let socket;
let eventThrottler;

const socketSubscriptions = [];

export const unsubscribe = (event, callback) => {
  socket.removeListener(event, callback);
};

const doSubscribe = (event, callback) => {
  socketSubscriptions.push({ event, callback });
  socket.on(event, callback);
};

const removeAllSubscriptions = () => {
  if (!socket) return;
  socketSubscriptions.forEach(({ event, callback }) => unsubscribe(event, callback));
};

const connectWithCallback = (token, subscriptions, authUser, dispatch, continuation) => {
  if (socket && !socket.disconnected) {
    console.info('[WS]: Web socket client already connected.');
    continuation(null, socket);
    return;
  }

  const wsUrl = cfg('socketConfig.url');
  socket = io.connect(wsUrl, { transports: ['websocket'] });

  eventThrottler = initThrottlerer();

  subscriptions.forEach(({ event, callback, excludeAdmin }) => {
    if (isAdmin(authUser) && !!excludeAdmin) return;

    const fn = data =>
      eventThrottler.onNext({
        data: { event, data },
        handler: args => {
          console.log(`[WS]: Handling event "${args.event}" with payload`, { data: args.data, date: new Date() });
          callback(args.data);
        },
      });

    doSubscribe(event, fn);
  });

  socket.on('authenticated', () => {
    console.log(`[WS]:'${socket.id}' authenticated`);
    continuation(null, socket);
  });

  socket.on('connect', () => {
    console.info(`[WS]:'${socket.id}' connected`);
    socket.emit('authenticate', { token });
  });

  socket.on('reconnecting', attempts => console.info(`reconnecting: attempt #${attempts}`));
  socket.on('unauthorized', msg => {
    const errorMessage = `[WS]: unauthorized: ${JSON.stringify(msg.data)}`;
    console.log(errorMessage);
    continuation(new Error(errorMessage));

    // TODO: delayed logout should be called from event listener
    delayedLogout(50);
  });

  socket.on('disconnect', reason => {
    eventThrottler && eventThrottler.dispose();
    const { id = 'Unknown' } = socket || {};
    console.info(`[WS]: '${id}' disconnected from socket server due to ${reason}`);
  });
};

export const connect = thenify(connectWithCallback);

export const disconnect = () => {
  const { id = 'unknown' } = socket;

  if (!socket) {
    console.log('[WS]: Web Socket. socket is not defined');
    return;
  }

  removeAllSubscriptions();

  if (socket.disconnected) {
    console.warn(`[WS]: Web Socket '${id}' socket is already disconnected!`);
    return;
  }

  socket.disconnect();
  console.warn(`[WS]: Web Socket '${id}' disconnected`);
};
