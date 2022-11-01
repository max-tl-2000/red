/*
 * Copyright (c) 2022 Reva Technology Inc., all rights reserved.
 * Unauthorized copying of this file, via any medium is strictly prohibited
 * Licensed under the Elastic License 2.0; you may not use this file except
 * in compliance with the Elastic License 2.0.
 */

import { now } from '../../../../common/helpers/moment-utils';

export default class UpdateTask {
  id;

  state;

  metadata;

  completionDate;

  get setters() {
    return ['setId', 'setState', 'setMetadata', 'setCompletionDate'];
  }

  setId(task) {
    const { UUID = [] } = task;
    this.id = UUID[0];
  }

  setState(task) {
    const { state = [] } = task;
    this.state = state[0];
  }

  setMetadata(task) {
    const { completedByUUID = [] } = task;
    if (completedByUUID[0]) {
      this.metadata = {
        completedBy: completedByUUID[0],
      };
    }
  }

  setCompletionDate(task) {
    const { completionDate = [] } = task;
    this.completionDate = completionDate[0] || now().toJSON();
  }

  toActionPayload() {
    const { id, state, metadata } = this;

    return {
      id,
      state,
      metadata,
    };
  }
}
