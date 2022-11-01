/*
 * Copyright (c) 2022 Reva Technology Inc., all rights reserved.
 * Unauthorized copying of this file, via any medium is strictly prohibited
 * Licensed under the Elastic License 2.0; you may not use this file except
 * in compliance with the Elastic License 2.0.
 */

export default class ScheduleCustomEvent {
  ruleName;

  customPayload;

  delay;

  partyID;

  get setters() {
    return ['setRuleName', 'setCustomPayload', 'setDelay', 'setPartyId'];
  }

  setRuleName(customEvent) {
    const { ruleName = [] } = customEvent;
    this.ruleName = ruleName[0];
  }

  setCustomPayload(customEvent) {
    const { customPayload = [] } = customEvent;
    this.customPayload = customPayload[0];
  }

  setDelay(customEvent) {
    const { numberOfSecondsDelay = [] } = customEvent;
    this.delay = numberOfSecondsDelay[0] * 1000 || 0;
  }

  setPartyId(customEvent) {
    const { partyID = [] } = customEvent;
    this.partyID = partyID[0];
  }

  toActionPayload() {
    const { ruleName, customPayload, delay, partyID } = this;

    return {
      customPayload,
      delay,
      partyID,
      ruleName,
    };
  }
}
