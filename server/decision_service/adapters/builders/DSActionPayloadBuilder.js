/*
 * Copyright (c) 2022 Reva Technology Inc., all rights reserved.
 * Unauthorized copying of this file, via any medium is strictly prohibited
 * Licensed under the Elastic License 2.0; you may not use this file except
 * in compliance with the Elastic License 2.0.
 */

import { CORTICON_ACTIONS } from '../actions/corticon';

export class DSActionPayloadBuilder {
  constructor(logger) {
    this.logger = logger;
  }

  log = (...args) => {
    if (!this.logger) return;
    const [method, ...loggerArgs] = args;
    this.logger[method](...loggerArgs);
  };

  mapPayloadData(ctx, { partyId, actionAndData }, party) {
    const { log } = this;
    const { action } = actionAndData;

    const corticonActionDescriptor = CORTICON_ACTIONS[action] || {};

    // if we have a mapper function let's use it
    const mapPayloadFn = corticonActionDescriptor.mapPayloadFn;

    if (mapPayloadFn) {
      try {
        // in this case we just expect the function to receive the data
        // and it is the job of the function to know how to do the mapping
        // in the end we just expect to have an object that can be serialized
        const payload = mapPayloadFn({ partyId, ...actionAndData }, party);
        return payload;
      } catch {
        return undefined;
      }
    }

    const PayloadType = corticonActionDescriptor.actionPayloadType;

    if (!PayloadType) {
      log('warn', { ctx, action, partyId }, 'no payload type could be matched to the action');
      return PayloadType;
    }

    const payload = new PayloadType();

    return payload.setters.reduce((acc, key) => {
      acc[key]({ ...actionAndData, partyId });
      return acc;
    }, payload);
  }

  build(ctx, actionAndData, party) {
    if (!actionAndData) return undefined;

    const { action } = actionAndData;
    const partyId = party?.id || ctx?.body?.id;

    const { log } = this;
    log('trace', { ctx, action, partyId }, 'building ds action payload');

    const data = this.mapPayloadData(ctx, { partyId, actionAndData }, party);

    log('trace', { ctx, action, partyId }, 'done building ds action payload');

    // This is to support the case where we have a class as Mapper.
    // In that case we expect the class to provide a method called
    // toActionPayload to return the actual payload
    if (data && data.toActionPayload) {
      return data.toActionPayload() || {};
    }

    return data || {};
  }
}
