/*
 * Copyright (c) 2022 Reva Technology Inc., all rights reserved.
 * Unauthorized copying of this file, via any medium is strictly prohibited
 * Licensed under the Elastic License 2.0; you may not use this file except
 * in compliance with the Elastic License 2.0.
 */

import { now } from '../../../../common/helpers/moment-utils';

export default class CreateTask {
  partyId;

  category;

  dueDate;

  name;

  state;

  userIds;

  metadata;

  get setters() {
    return ['setPartyId', 'setCategory', 'setDueDate', 'setName', 'setState', 'setUserIds', 'setMetadata'];
  }

  setPartyId(task) {
    const { partyId } = task;
    this.partyId = partyId;
  }

  setCategory(task) {
    const { category = [] } = task;
    this.category = category[0];
  }

  setDueDate(task) {
    const { dueDate = [] } = task;
    this.dueDate = dueDate[0] || now().toJSON();
  }

  setName(task) {
    const { name = [] } = task;
    this.name = name[0];
  }

  setState(task) {
    const { state = [] } = task;
    this.state = state[0];
  }

  setUserIds(task) {
    const { taskOwnerUUID = [] } = task;
    this.userIds = [taskOwnerUUID[0]];
  }

  isUniqueTask(task) {
    const { unique = [] } = task;
    return unique[0] ? unique[0] === 'true' : undefined;
  }

  isTaskWithMetadata(task) {
    const { personUUID = [], createdByUUID = [], createdByType = [] } = task;
    return personUUID[0] || createdByUUID[0] || createdByType[0] || this.isUniqueTask(task);
  }

  setMetadata(task) {
    if (this.isTaskWithMetadata(task)) {
      const { personUUID = [], createdByUUID = [], createdByType = [] } = task;
      this.metadata = {
        unique: this.isUniqueTask(task),
        createdBy: createdByUUID[0],
        personId: personUUID[0],
        createdByType: createdByType[0],
      };
    }
  }

  toActionPayload() {
    const { partyId, category, dueDate, name, state, userIds, metadata } = this;

    return {
      partyId,
      category,
      dueDate,
      name,
      state,
      userIds,
      metadata,
    };
  }
}
