/*
 * Copyright (c) 2022 Reva Technology Inc., all rights reserved.
 * Unauthorized copying of this file, via any medium is strictly prohibited
 * Licensed under the Elastic License 2.0; you may not use this file except
 * in compliance with the Elastic License 2.0.
 */

import get from 'lodash/get';
import path from 'path';
import DispatcherProvider from '../providers/dispatcherProvider';
import { DALTypes } from '../../../common/enums/DALTypes';
import { read } from '../../../common/helpers/xfs';
import { fillHandlebarsTemplate } from '../../../common/helpers/handlebars-utils';
import { postXMLWithRetries } from '../../../common/helpers/postXML';
import config from '../config';
import { CORTICON_RESPONSE_ACTION_PATHS } from './actions/corticon';
import { DSActionPayloadBuilder } from './builders/DSActionPayloadBuilder';

const getFromDSResult = get;

export default class CorticonDecisionServiceAdapter {
  constructor(logger) {
    this.logger = logger;
    this.dispatcher = new DispatcherProvider(DALTypes.DecisionServiceDispatcherMode.CORTICON, logger).getProvider();
  }

  get serviceUrl() {
    return `${config.corticonServerUrl}/services/Corticon`;
  }

  get payloadBuilder() {
    if (!this._payloadBuilder) {
      this._payloadBuilder = new DSActionPayloadBuilder(this.logger);
    }

    return this._payloadBuilder;
  }

  log = (...args) => {
    if (!this.logger) return;
    const [method, ...loggerArgs] = args;
    this.logger[method](...loggerArgs);
  };

  getDecisionServicesToCall = event => this.dispatcher.getDecisionServicesToCall(event);

  buildDSRequestPayload = async (ctx, dsName, dsInput, dsRequestTemplate = 'request-template.xml') => {
    const { log } = this;
    let body;
    try {
      const requestTemplate = await read(path.join(__dirname, 'templates', dsRequestTemplate), 'utf8');
      body = await fillHandlebarsTemplate(requestTemplate, { dsName, ...dsInput }, { increment: val => val + 1 });
    } catch (error) {
      log('error', { ctx, dsName, error }, 'an error occured building the decision service payload');
      throw error;
    }
    return body;
  };

  getActionsAndData = (dsResults = []) => {
    let actionsAndData = [];
    for (let i = 0; i < dsResults.length; i++) {
      const dsResult = dsResults[i];

      if (!dsResult) continue; // eslint-disable-line no-continue

      const actions = CORTICON_RESPONSE_ACTION_PATHS.reduce((acc, actionPath) => {
        const actionData = getFromDSResult(dsResult, actionPath);
        if (actionData) {
          const [action] = actionPath.split('.').slice(-1);
          acc.push({ action, data: actionData, sessionId: dsResult.sessionId });
        }
        return acc;
      }, []);

      actionsAndData = [...actionsAndData, ...actions];
    }

    return actionsAndData;
  };

  buildActions = (event, actionsAndData = []) => {
    const { payloadBuilder, log } = this;
    const { ctx, event: party } = event;

    return actionsAndData.map(actionAndData => {
      const { action, data } = actionAndData;
      log('trace', { ctx, action, numOfActions: data.length }, 'building ds action payloads');

      const payloads = data
        .map(d => {
          let payload;
          try {
            payload = payloadBuilder.build(ctx, { action, ...d }, party);
          } catch (error) {
            log('error', { ctx, action, data: JSON.stringify(data), error }, 'an error occured building the action payload');
          }
          return payload;
        })
        .filter(x => x);
      return { payloads, ...actionAndData };
    });
  };

  async getActions(event) {
    const { buildActions, getActionsAndData, buildDSRequestPayload, getDecisionServicesToCall, serviceUrl, log, logger } = this;
    const { ctx, event: party } = event;
    const { id: partyId, version: documentVersion, events } = party;

    const logCtx = addedFields => ({
      ctx,
      partyId,
      documentVersion,
      partyDocumentEvents: events.map(e => e.event).join(', '),
      serviceUrl,
      ...addedFields,
    });

    const dsServicesToCall = await getDecisionServicesToCall({ ctx, documentVersion, events });

    const dsResultsPromises = dsServicesToCall.map(async dsCall => {
      let action;
      try {
        const { name, inputBuilder, requestTemplate } = dsCall;
        const dsInput = inputBuilder.build(ctx, party, logger, requestTemplate);
        const payload = await buildDSRequestPayload(ctx, name, dsInput, requestTemplate);
        log('trace', logCtx({ dsName: name, requestTemplate, payload }), 'calling corticon ds');
        action = await postXMLWithRetries(serviceUrl, payload, { timeout: 60000 });
      } catch (error) {
        log('error', logCtx({ dsName: dsCall.name, requestTemplate: dsCall.requestTemplate, error }), 'an error occured getting ds actions');
      }
      return { ...action, sessionId: dsCall.sessionId };
    });

    const dsResults = await Promise.all(dsResultsPromises);

    const actionsAndDataToExecute = getActionsAndData(dsResults);

    log('trace', logCtx({ numOfResults: dsResults?.length || 0, actionsAndDataToExecute }), 'done getting corticon decision service actions');

    const actions = buildActions(event, actionsAndDataToExecute);

    return actions;
  }
}
