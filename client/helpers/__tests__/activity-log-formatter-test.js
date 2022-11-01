/*
 * Copyright (c) 2022 Reva Technology Inc., all rights reserved.
 * Unauthorized copying of this file, via any medium is strictly prohibited
 * Licensed under the Elastic License 2.0; you may not use this file except
 * in compliance with the Elastic License 2.0.
 */

import { expect } from 'chai';
import { formatActivityLogs } from '../activityLogs/activityLogFormatter';
import data_driven from 'data-driven'; // eslint-disable-line
import { NEW_QUOTE_ACTIVITY_LOGS, ACTIVITY_LOG_FORMATTED_DETAILS } from '../../__tests__/fixtures/activity-logs-data';

describe('Activity Log Formatter helper', () => {
  describe('Formats the activity log when the component type is QUOTE', () => {
    data_driven(NEW_QUOTE_ACTIVITY_LOGS, () => {
      it('should return the activity logs with the formatted details ', ctx => {
        const logs = formatActivityLogs(ctx);
        expect(logs).to.not.be.null;
        expect(logs.length).to.equal(1);
        expect(logs[0]).to.include.keys(ACTIVITY_LOG_FORMATTED_DETAILS);
      });
    });
  });
});
