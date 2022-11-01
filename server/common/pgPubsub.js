/*
 * Copyright (c) 2022 Reva Technology Inc., all rights reserved.
 * Unauthorized copying of this file, via any medium is strictly prohibited
 * Licensed under the Elastic License 2.0; you may not use this file except
 * in compliance with the Elastic License 2.0.
 */

import EventEmitter from 'events';
import { knex } from '../database/factory';
import loggerInstance from '../../common/helpers/logger';

const logger = loggerInstance.child({ subType: 'PGPubsub' });

export default class PGPubsub extends EventEmitter {
  constructor() {
    super();

    this.isClosed = false;
    this.channels = new Set();

    EventEmitter.call(this);
    this.setMaxListeners(0);
  }

  _processNotification = msg => {
    const { payload, channel } = msg;
    const data = JSON.parse(payload);
    this.emit(channel, data);
  };

  _infiniteAttempt = async func => {
    // eslint-disable-next-line
    while (true) {
      try {
        await func();
        break;
      } catch (error) {
        logger.error(error);
        await new Promise(r => setTimeout(r, 10000));
      }
    }
  };

  _createNewConnection = async () => {
    this.client = await knex.client.acquireRawConnection();

    this.client.on('error', logger.error);

    this.client.on('end', async () => {
      if (this.isClosed) return;

      logger.error('The pubsub connection to the db was lost. Reconnecting...');
      await this._infiniteAttempt(async () => await this._createNewConnection());
    });

    this.client.on('notification', msg => this._processNotification(msg));

    const channels = [...this.channels];
    await Promise.all(channels.map(async channel => await this.client.query(`LISTEN "${channel}"`)));

    logger.trace('Subscribed to pubsub notifications');

    return this;
  };

  connect = async () => {
    // The connection should be created only once.
    // Return right away a promise that will be or is already resolved to the new client.
    if (this.instance) return this.instance;

    this.instance = this._createNewConnection();

    return this.instance;
  };

  listen = async (channel, callback) => {
    if (!this.client) {
      throw new Error('The client is not initialized. Please call connect() before calling listen().');
    }
    if (this.channels.has(channel)) return;

    this.channels.add(channel);
    this.on(channel, callback);

    logger.trace({ channel }, 'listening for PG notifications on channel');
    await this.client.query(`LISTEN "${channel}"`);
  };

  close = async () => {
    logger.trace('Closing PGPubsub client.');
    this.isClosed = true;

    this.removeAllListeners();
    this.channels.clear();

    this.client && this.client.removeAllListeners() && (await this.client.end());
  };
}
