/*
 * Copyright (c) 2022 Reva Technology Inc., all rights reserved.
 * Unauthorized copying of this file, via any medium is strictly prohibited
 * Licensed under the Elastic License 2.0; you may not use this file except
 * in compliance with the Elastic License 2.0.
 */

import CreateTask from './fixtures/CreateTask.json';
import UpdateTask from './fixtures/UpdateTask.json';
import ScheduleCustomEvent from './fixtures/ScheduleCustomEvent.json';
import CreateTaskPayload from './snapshots/CreateTask.json';
import UpdateTaskPayload from './snapshots/UpdateTask.json';
import ScheduleCustomEventPayload from './snapshots/ScheduleCustomEvent.json';
import { DSActionPayloadBuilder } from '../DSActionPayloadBuilder';

const payloadBuilder = new DSActionPayloadBuilder();
const ctx = {
  body: {
    id: '76e2a2e8-f431-11e9-ae2b-6f90233d2346',
  },
};

describe('DSActionPayloadBuilder.build()', () => {
  describe('when building a payload for an unknown action', () => {
    it('should return an empty object', () => {
      const payload = payloadBuilder.build(ctx, { action: 'unknown' });
      expect(payload).toEqual({});
    });
  });
  describe('when building a payload and no action and data is passed', () => {
    it('should return an empty object', () => {
      const payload = payloadBuilder.build();
      expect(payload).toBeUndefined();
    });
  });
  describe('when building a payload for creating a task', () => {
    it('should return the create task action payload data', () => {
      const payload = payloadBuilder.build(ctx, CreateTask);
      expect(payload).toEqual(CreateTaskPayload);
    });
  });
  describe('when building a payload for updating a task', () => {
    it('should return the task update action payload data', () => {
      const payload = payloadBuilder.build(ctx, UpdateTask);
      expect(payload).toEqual(UpdateTaskPayload);
    });
  });
  describe('when building a payload for a delayed custom event', () => {
    it('should return the delayed custom message action payload data', () => {
      const payload = payloadBuilder.build(ctx, ScheduleCustomEvent);
      expect(payload).toEqual(ScheduleCustomEventPayload);
    });
  });
});
