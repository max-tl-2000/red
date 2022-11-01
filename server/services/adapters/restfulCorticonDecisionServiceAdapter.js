/*
 * Copyright (c) 2022 Reva Technology Inc., all rights reserved.
 * Unauthorized copying of this file, via any medium is strictly prohibited
 * Licensed under the Elastic License 2.0; you may not use this file except
 * in compliance with the Elastic License 2.0.
 */

import request from 'superagent';
import config from '../../config';
import { RestfulCorticonInputBuilder } from './builders/restfulCorticonInputBuilder';

export default class RestfulCorticonDecisionServiceAdapter {
  constructor(logger) {
    this.logger = logger;
  }

  get serviceUrl() {
    return `${config.corticonServerUrl}/corticon/execute`;
  }

  get inputBuilder() {
    if (!this._inputBuilder) {
      this._inputBuilder = new RestfulCorticonInputBuilder();
    }

    return this._inputBuilder;
  }

  log = (...args) => {
    if (!this.logger) return;
    const [method, ...loggerArgs] = args;
    this.logger[method](...loggerArgs);
  };

  removeAllMatchingKeysFromObject = (obj, keys) => {
    if (!obj || !keys.length) return obj;
    Object.keys(obj).forEach(k => {
      if (keys.includes(k)) {
        delete obj[k];
      } else if (typeof obj[k] === 'object') {
        this.removeAllMatchingKeysFromObject(obj[k], keys);
      }
    });
    return obj;
  };

  buildDSResponse = response => this.removeAllMatchingKeysFromObject(response, ['__metadataRoot', '__metadata']);

  buildDSRequestPayload = (ctx, body, dsName) => ({
    name: dsName,
    Objects: [
      {
        ...body,
        __metadata: {
          '#type': 'Workflow',
          '#id': 'Workflow_id_1',
        },
      },
    ],
    __metadataRoot: { '#locale': '' },
  });

  stringify = obj => JSON.stringify(obj || {}, null, 2);

  async getActions(ctx) {
    const { buildDSRequestPayload, buildDSResponse, inputBuilder, serviceUrl, stringify, log } = this;
    const body = ctx?.body || {};
    const rule = body.rule || '';

    const logCtx = addedFields => ({
      ctx,
      serviceUrl,
      ...addedFields,
    });

    let decisionServiceResponse;
    try {
      log('info', logCtx({ dsName: rule }), 'calling corticon decision service');

      const payload = await buildDSRequestPayload(ctx, inputBuilder.build(body), rule);
      log('debug', logCtx({ decisionServiceRequestPayload: stringify(payload) }), 'corticon decision service request payload');

      const response = await request.post(serviceUrl).set('Accept', 'application/json').set('Content-Type', 'application/json').send(payload);
      log('debug', logCtx({ decisionServiceResponse: stringify(response?.res?.body) }), 'done getting the corticon decision service response');

      decisionServiceResponse = buildDSResponse(response?.res?.body);
    } catch (error) {
      log('error', logCtx({ error }), 'an error occured getting the corticon decision service response');
      throw error;
    }

    return decisionServiceResponse;
  }
}
