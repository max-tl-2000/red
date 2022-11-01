/*
 * Copyright (c) 2022 Reva Technology Inc., all rights reserved.
 * Unauthorized copying of this file, via any medium is strictly prohibited
 * Licensed under the Elastic License 2.0; you may not use this file except
 * in compliance with the Elastic License 2.0.
 */

import io from 'socket.io-client';
import { createJWTToken } from '../server/jwt-helpers';
import logger from './logger';
import { deferred } from './deferred';

let socket;

export function connect(tenantId, socketServerHost, authToken) {
  logger.info(`Connecting to tenant ${tenantId} - ${socketServerHost}`);
  socket = io.connect(socketServerHost, { transports: ['websocket'] });

  const token = !authToken ? createJWTToken({ tenantId }) : authToken;
  const deferredPromise = deferred({ timeout: 10000 }); // give it enough time so it can be fulfilled

  socket.on('error', deferredPromise.reject);
  socket.on('connect', () => {
    logger.trace({ token }, 'emitting authenticate event');
    socket.emit('authenticate', { token });
    deferredPromise.resolve();
  });

  return deferredPromise;
}

export function disconnect() {
  logger.info('disconnecting');
  if (!socket) {
    logger.warn('disconnect called but no socket active');
    return;
  }
  const deferredPromise = deferred({ timeout: 10000 });

  try {
    socket.on('disconnect', deferredPromise.resolve);
    socket.on('error', deferredPromise.reject);
    socket.disconnect();
  } catch (err) {
    logger.error({ err }, 'Could not disconnect socket');
  }

  return deferredPromise; // eslint-disable-line consistent-return
}

export function subscribe(event, callback, options = { once: false }) {
  if (!event) {
    // This is a failsafe in-case someone typos an event name
    // TODO: consider validating against /common/enums/eventTypes'
    throw new Error('Attempt to subscribe to undefined event');
  }
  const listen = options?.once ? 'once' : 'on';
  logger.info(`Subscribing to event ${event}`);
  socket[listen](event, callback);
}
