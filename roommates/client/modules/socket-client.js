/*
 * Copyright (c) 2022 Reva Technology Inc., all rights reserved.
 * Unauthorized copying of this file, via any medium is strictly prohibited
 * Licensed under the Elastic License 2.0; you may not use this file except
 * in compliance with the Elastic License 2.0.
 */

import io from 'socket.io-client';
import dispatcher from 'dispatchy';

const events = ['authenticated', 'unauthorized'];

export const socketClient = dispatcher.create();

let socket;

export const subscribe = event => {
  socket.on(event, data => {
    console.log(`Handling WS event "${event}" with payload=${JSON.stringify(data || {}, null, 2)}`);
    socketClient.fire(event, data);
  });
};

export const unsubscribe = (event, callback) => socket.removeListener(event, callback);

export const initSocketClient = ({ wsUrl, token }) => {
  if (socket && !socket.disconnected) {
    console.info('Web socket client already connected.');
    return socket;
  }
  socket = io.connect(wsUrl, { transports: ['websocket'] });
  events.forEach(event => subscribe(event, data => socketClient.fire(event, data)));
  socket.on('connect', () => socket.emit('authenticate', { token }));
  socket.on('disconnect', () => {
    socket = null;
  });
  socket.on('unauthorized', msg => console.log('WS client unauthorized', msg));
  // socket.on('process task event', msg => console.log('WS message', msg));
  socketClient.socket = socket;
  return socket;
};

export const disconnect = () => {
  if (!socket) console.warn('Web Socket client is already disconnected!');
  socket.disconnect();
};
