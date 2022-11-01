/*
 * Copyright (c) 2022 Reva Technology Inc., all rights reserved.
 * Unauthorized copying of this file, via any medium is strictly prohibited
 * Licensed under the Elastic License 2.0; you may not use this file except
 * in compliance with the Elastic License 2.0.
 */

import io from 'socket.io-client';
import dispatcher from 'dispatchy';
import eventTypes from 'enums/eventTypes';
import { logger } from 'client/logger';
import { removeTokenFromObject } from '../../../common/helpers/logger-utils';

const events = ['authenticated', 'unauthorized', eventTypes.PAYMENT_RECEIVED, eventTypes.WAIVE_APPLICATION_FEE, eventTypes.BROADCAST_WEB_UPDATED];

export const socketClient = dispatcher.create();

let socket;
let disconnectCalled = false;

export const subscribe = event => {
  console.log({ event }, 'subscribing to event');
  socket.on(event, data => {
    logger.debug({ event, data: removeTokenFromObject(data) }, 'Handling WS event');
    socketClient.fire(event, data);
  });
};

export const unsubscribe = (event, callback) => socket.removeListener(event, callback);

export const initSocketClient = ({ wsUrl, token }) => {
  if (socket && !socket.disconnected) {
    console.info('Web socket client already connected.');
    return socket;
  }

  socket = io.connect(wsUrl, { transports: ['websocket'], reconnection: true });

  if (!socket) {
    // TODO: what should we do here?
    console.error(`unable to connect to socket server at ${wsUrl}`);
    return null;
  }

  events.forEach(event => subscribe(event, data => socketClient.fire(event, data)));

  socket.on('connect', () => {
    // somehow we keep getting this error: TypeError: null is not an object (evaluating 'd.emit')
    // so adding a check on emit before calling the emit function
    socket && socket.emit && socket.emit('authenticate', { token });
  });

  socket.on('reconnecting', attempts => console.log('reconnecting:', attempts));

  socket.on('disconnect', () => {
    if (!disconnectCalled) {
      return;
    }
    // free resources
    socket = null;
  });

  socket.on('unauthorized', msg => console.log('WS client unauthorized', msg));
  // socket.on('process task event', msg => console.log('WS message', msg));
  socketClient.socket = socket;
  return socket;
};

export const disconnect = () => {
  if (disconnectCalled && !socket) {
    // socket already disconnected
    return;
  }

  disconnectCalled = true;
  socket && socket.disconnect();
};
