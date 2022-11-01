/*
 * Copyright (c) 2022 Reva Technology Inc., all rights reserved.
 * Unauthorized copying of this file, via any medium is strictly prohibited
 * Licensed under the Elastic License 2.0; you may not use this file except
 * in compliance with the Elastic License 2.0.
 */

import { expect } from 'test-helpers';
import { getPercentageOfDayElapsed } from '../../../common/helpers/date-utils';

describe('date helper', () => {
  describe('execute getPercentageOfDayElapsed function', () => {
    it('is 50% for noon as Date', () => {
      const noonDate = new Date(2000, 1, 1, 12, 0, 0);
      const percentageElapsed = getPercentageOfDayElapsed(noonDate);

      expect(percentageElapsed).to.equal(50);
    });

    it('is 50% for noon as String', () => {
      const noonString = new Date(2000, 1, 1, 12, 0, 0).toISOString();
      const percentageElapsed = getPercentageOfDayElapsed(noonString);

      expect(percentageElapsed).to.equal(50);
    });

    it('is 25% for 6:00 AM', () => {
      const sixAmDate = new Date(2000, 1, 1, 6, 0, 0);
      const percentageElapsed = getPercentageOfDayElapsed(sixAmDate);

      expect(percentageElapsed).to.equal(25);
    });

    it('is 75% for 6:00 PM', () => {
      const sixPmDate = new Date(2000, 1, 1, 18, 0, 0);
      const percentageElapsed = getPercentageOfDayElapsed(sixPmDate);

      expect(percentageElapsed).to.equal(75);
    });
  });
});
