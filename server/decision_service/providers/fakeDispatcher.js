/*
 * Copyright (c) 2022 Reva Technology Inc., all rights reserved.
 * Unauthorized copying of this file, via any medium is strictly prohibited
 * Licensed under the Elastic License 2.0; you may not use this file except
 * in compliance with the Elastic License 2.0.
 */

import Dispatcher from './dispatcher';
import { DALTypes } from '../../../common/enums/DALTypes';
import { commEvents, taskEvents, customEvents } from '../../../common/server/subscriptions';

export default class FakeDispatcher extends Dispatcher {
  constructor() {
    super(DALTypes.DecisionServiceDispatcherMode.FAKE);
  }

  get commsDS() {
    const { defaultDSInputBuilder } = this;
    return [
      { name: 'InboundComm', inputBuilder: defaultDSInputBuilder },
      { name: 'OutboundComms', inputBuilder: defaultDSInputBuilder },
    ];
  }

  get taskDS() {
    return [];
  }

  get customEventDS() {
    const { defaultDSInputBuilder } = this;
    return [{ name: 'LackOfInboundComms', inputBuilder: defaultDSInputBuilder }];
  }

  get decisionServices() {
    return [
      { subscriptions: commEvents, decisionServices: this.commsDS },
      { subscriptions: taskEvents, decisionServices: this.taskDS },
      { subscriptions: customEvents, decisionServices: this.customEventDS },
    ];
  }

  getDecisionServicesToCall({ event }) {
    return this.decisionServices.reduce((acc, { subscriptions, decisionServices }) => {
      subscriptions.includes(event) && acc.push(...decisionServices);
      return acc;
    }, []);
  }
}
