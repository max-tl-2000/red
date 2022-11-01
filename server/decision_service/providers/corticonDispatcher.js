/*
 * Copyright (c) 2022 Reva Technology Inc., all rights reserved.
 * Unauthorized copying of this file, via any medium is strictly prohibited
 * Licensed under the Elastic License 2.0; you may not use this file except
 * in compliance with the Elastic License 2.0.
 */

import LRU from 'lru';
import request from 'superagent';
import getUUID from 'uuid/v4';
import get from 'lodash/get';
import uniqBy from 'lodash/uniqBy';
import path from 'path';
import Dispatcher from './dispatcher';
import config from '../config';
import { fillHandlebarsTemplate } from '../../../common/helpers/handlebars-utils';
import { DALTypes } from '../../../common/enums/DALTypes';
import { read } from '../../../common/helpers/xfs';
import { customEvents } from '../../../common/server/subscriptions';
import { postXMLWithRetries } from '../../../common/helpers/postXML';
import nullish from '../../../common/helpers/nullish';

export default class CorticonDispatcher extends Dispatcher {
  constructor(logger) {
    super(DALTypes.DecisionServiceDispatcherMode.CORTICON);
    this.logger = logger;

    // eslint-disable-next-line new-cap
    this.tenantCache = LRU({
      limit: 100,
      maxAge: 900000, // 15 minutes
    });
  }

  get listOfDecisionServicesUrl() {
    return `${config.corticonServerUrl}/corticon/decisionService/list`;
  }

  get serviceUrl() {
    return `${config.corticonServerUrl}/services/Corticon`;
  }

  get revaDispatcherRuleName() {
    return 'R_RoutingRules';
  }

  getTenantDispatcherRuleName(ctx) {
    return `${ctx?.tenantName}_RoutingRules`;
  }

  get defaultRequestTemplateName() {
    return 'request-template.xml';
  }

  async getDispatcherRuleNamesToCall(ctx) {
    const { revaDispatcherRuleName, getTenantDispatcherRuleName, listOfDecisionServicesUrl, tenantCache, log } = this;

    const cache = tenantCache.get(ctx.tenantId);
    const dispatcherRuleNamesToCall = [revaDispatcherRuleName];
    const tenantDispatcherRuleName = getTenantDispatcherRuleName(ctx);

    if (cache) {
      log('trace', { ctx }, 'using dispatcher cache');
      cache.hasTenantDispatcher && dispatcherRuleNamesToCall.push(tenantDispatcherRuleName);
      return dispatcherRuleNamesToCall;
    }

    let hasTenantDispatcher;

    try {
      const res = await request.get(listOfDecisionServicesUrl).set('Accept', 'application/json');
      const { decisionServices = [] } = res.body;
      hasTenantDispatcher = decisionServices.some(ds => ds.name === tenantDispatcherRuleName);
      tenantCache.set(ctx.tenantId, { hasTenantDispatcher });
    } catch (error) {
      log('error', { ctx, error }, 'an error occurred getting the list of decision service rules');
    }

    hasTenantDispatcher && dispatcherRuleNamesToCall.push(tenantDispatcherRuleName);

    log('trace', { ctx, hasTenantDispatcher, dispatcherRuleNamesToCall }, 'corticon dispatcher');
    return dispatcherRuleNamesToCall;
  }

  log = (...args) => {
    if (!this.logger) return;
    const [method, ...loggerArgs] = args;
    this.logger[method](...loggerArgs);
  };

  buildDispatcherRequestPayload = async (ctx, ruleName, input) => {
    const { log } = this;
    let body;
    try {
      const requestTemplate = await read(path.join(__dirname, 'templates', 'dispatcher-request-template.xml'), 'utf8');
      body = await fillHandlebarsTemplate(requestTemplate, { dispatcherRuleName: ruleName, ...input }, { increment: val => val + 1 });
    } catch (error) {
      log('error', { ctx, dispatcherRuleName: ruleName, error }, 'an error occurred building the dispatcher payload');
      throw error;
    }
    return body;
  };

  mapDispatcherResults = dispatcherResult => {
    const { defaultRequestTemplateName } = this;
    const name = dispatcherResult?.ruleName[0] || '';
    const sessionId = dispatcherResult?.sessionId || getUUID();

    // TODO: this is temporary while we work on a way for the dispatcher to return this
    const requestTemplate = !name.includes('PartyMembers') ? defaultRequestTemplateName : `party-members-${defaultRequestTemplateName}`;

    return { name, inputBuilder: this.defaultDSInputBuilder, requestTemplate, sessionId };
  };

  buildDecisionServicesToCall = dispatcherResults => {
    const { mapDispatcherResults } = this;
    const dispatcherResponsePath = 'soap:Envelope.soap:Body[0].urn:CorticonResponse[0].WorkDocuments[0].CorticonRule';
    const rules = get(dispatcherResults, dispatcherResponsePath, []).map(mapDispatcherResults);
    return uniqBy(rules, 'name');
  };

  logResults = (decisionServices = []) => ({
    numOfResults: decisionServices.length,
    decisionServicesToCall: decisionServices.map(({ name }) => name).join(', '),
  });

  getTenantName = ctx => {
    const { callBackUrl } = ctx?.body || {};
    const url = new URL(callBackUrl);
    const hostName = url.hostname;
    return hostName?.split('.')[0];
  };

  filterDecisionServiceList = (ctx, decisionServices = []) => {
    const { log } = this;
    const { tenantName } = ctx || {};

    const filteredDecisionServices = decisionServices.reduce(
      (acc, ds) => {
        if (ds.name?.toLowerCase().startsWith('r_') || ds.name?.toLowerCase().startsWith(`${tenantName}_`)) {
          acc.decisionServicesToCall.push(ds);
        } else {
          acc.decisionServicesToIgnore.push(ds);
        }

        return acc;
      },
      { decisionServicesToCall: [], decisionServicesToIgnore: [] },
    );

    const { decisionServicesToCall, decisionServicesToIgnore } = filteredDecisionServices;

    if (decisionServicesToIgnore.length) {
      log('trace', { ctx, decisionServicesToIgnore: decisionServicesToIgnore.map(({ name }) => name).join(', ') }, 'Ignoring decision services');
    }

    return decisionServicesToCall;
  };

  callDispatcherDecisionService = async (ctx, dispatcherRuleName, dispatcherPayload, logCtx) => {
    const { serviceUrl, log, buildDispatcherRequestPayload, buildDecisionServicesToCall } = this;

    let dispatcherResults;
    try {
      log('trace', logCtx({ dispatcherRuleName }), 'calling corticon dispatcher');
      const payload = await buildDispatcherRequestPayload(ctx, dispatcherRuleName, dispatcherPayload);
      dispatcherResults = await postXMLWithRetries(serviceUrl, payload, { timeout: 60000 });
    } catch (error) {
      log('error', logCtx({ error, dispatcherRuleName }), 'an error occurred getting rules from dispatcher');
    }

    const decisionServicesToCall = buildDecisionServicesToCall(dispatcherResults);

    return this.filterDecisionServiceList(ctx, decisionServicesToCall);
  };

  async getDecisionServicesToCall(event) {
    if (nullish(event)) return [];

    const { serviceUrl, log, mapDispatcherResults, logResults, getTenantName } = this;

    const { ctx, events, documentVersion } = event;
    const { id: partyEventId, partyId } = events[0] || {};

    ctx.tenantName = getTenantName(ctx);

    const dispatcherRuleNamesToCall = await this.getDispatcherRuleNamesToCall(ctx);

    const logCtx = (addedFields = {}) => ({
      ctx,
      partyId,
      partyEventId,
      documentVersion,
      partyDocumentEvents: events.map(e => e.event).join(', '),
      serviceUrl,
      dispatcherRuleNames: dispatcherRuleNamesToCall.join(', '),
      tenantName: ctx.tenantName,
      ...addedFields,
    });

    const customEvent = events.find(({ event: eventName }) => customEvents.includes(eventName));

    if (customEvent) {
      log('trace', logCtx(), 'handling custom event');
      const customEventRuleName = customEvent.metadata?.ruleName;
      const customEventSessionId = customEvent.metadata?.sessionId;
      const customEventRule = { ruleName: [customEventRuleName], sessionId: customEventSessionId };
      const decisionServicesToCall = customEventRuleName ? [mapDispatcherResults(customEventRule)] : [];
      const customEventDecisionServiceToCall = this.filterDecisionServiceList(ctx, decisionServicesToCall);
      log('trace', logCtx(logResults(customEventDecisionServiceToCall)), 'done getting decision services');
      return customEventDecisionServiceToCall;
    }

    const revaDispatcherRuleName = dispatcherRuleNamesToCall[0];
    const tenantDispatcherRuleName = dispatcherRuleNamesToCall[1];
    const dispatcherPayload = { events: events.map(evt => ({ ...evt, tenantName: ctx.tenantName })) };

    let decisionServicesToCall = await this.callDispatcherDecisionService(ctx, revaDispatcherRuleName, dispatcherPayload, logCtx);

    if (tenantDispatcherRuleName) {
      dispatcherPayload.corticonRules = decisionServicesToCall;
      decisionServicesToCall = await this.callDispatcherDecisionService(ctx, tenantDispatcherRuleName, dispatcherPayload, logCtx);
    }

    log('trace', logCtx(logResults(decisionServicesToCall)), 'done getting decision services from dispatcher');

    return decisionServicesToCall;
  }
}
