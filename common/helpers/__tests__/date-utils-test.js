/*
 * Copyright (c) 2022 Reva Technology Inc., all rights reserved.
 * Unauthorized copying of this file, via any medium is strictly prohibited
 * Licensed under the Elastic License 2.0; you may not use this file except
 * in compliance with the Elastic License 2.0.
 */

// this will be removed after timezone branch is merged

import { expect } from '../../test-helpers';
import { dateInBetween, getClosestThirtyMinutesDelta, roundDateToThirtyMinutes, getPastFormattedDateFromDelta } from '../date-utils';
import { toMoment, momentNow } from '../moment-utils';

describe('execute dateInBetween function', () => {
  const checkInBetweenFn = (startDate, endDate, currentDate, timezone, expectedResult) => {
    timezone = !timezone ? undefined : timezone;
    currentDate = toMoment(currentDate, { timezone });
    const res = dateInBetween(startDate, endDate, currentDate, true, timezone);
    expect(res).to.equal(expectedResult);
  };

  describe('current time with negative timezone time', () => {
    const timezone = 'America/Los_Angeles'; // -07:00 or -420min
    const startDate = '2017-08-20T00:00:00.000Z';
    const endDate = '2017-08-31T00:00:00.000Z';

    describe('start and end dates are not set ', () => {
      // it can be any time
      it('should be true, the concession is not expired', () => {
        checkInBetweenFn(null, null, momentNow(), timezone, true);
      });
    });

    describe('start and end dates are set ', () => {
      describe('validations for start date ', () => {
        const currentTime = 1503212399000; // 2017-08-20T06:59:59+00:00

        describe('last moment before start the concession', () => {
          it('should be false, the concession does not start yet', () => {
            const cTime = toMoment('2017-08-19T23:59:59+00:00');
            checkInBetweenFn(startDate, endDate, cTime, timezone, false);
          });
        });

        describe('the concession started', () => {
          it('should be true, the concession started', () => {
            // 2017-08-20T00:00:00-07:00;
            checkInBetweenFn(startDate, endDate, currentTime + 1000, timezone, true);
          });
        });
      });

      describe('validations for end date ', () => {
        const currentTime = 1504249199000; // 2017-09-01T06:59:59+00:00

        describe('last moment to end the concession', () => {
          it('should be true, the concession is not expired', () => {
            const cTime = toMoment('2017-08-30T23:59:59+00:00');
            checkInBetweenFn(startDate, endDate, cTime, timezone, true);
          });
        });

        describe('the concession ended', () => {
          it('should be false, the concession is expired', () => {
            // 2017-09-01T00:00:00-07:00;
            checkInBetweenFn(startDate, endDate, currentTime + 1000, timezone, false);
          });
        });
      });
    });

    describe('start is not set ', () => {
      const currentTime = 1504249199000; // 2017-09-01T06:59:59+00:00

      describe('last moment to end the concession', () => {
        it('should be true, the concession is not expired', () => {
          const cTime = '2017-08-30T23:59:59-00:00';
          checkInBetweenFn(null, endDate, cTime, timezone, true);
        });
      });

      describe('the concession ended', () => {
        it('should be false, the concession is expired', () => {
          // 2017-09-01T00:00:00-07:00;
          checkInBetweenFn(null, endDate, currentTime + 1000, timezone, false);
        });
      });
    });

    describe('end is not set ', () => {
      const currentTime = 1503212399000; // 2017-08-20T06:59:59+00:00

      describe('last moment before start the concession', () => {
        it('should be false, the concession does not start yet', () => {
          const cTime = '2017-08-19T23:59:59+00:00';
          checkInBetweenFn(startDate, null, cTime, timezone, false);
        });
      });

      describe('the concession started', () => {
        it('should be true, the concession started', () => {
          // 2017-08-20T00:00:00-07:00;
          checkInBetweenFn(startDate, null, currentTime + 1000, timezone, true);
        });
      });
    });
  });

  describe('current time with positive timezone time', () => {
    const timezone = 'Europe/Bucharest'; // +03:00 or +180min
    const startDate = '2017-08-20T00:00:00.000Z';
    const endDate = '2017-08-31T00:00:00.000Z';

    describe('start and end dates are not set ', () => {
      // it can be any time
      it('should be true, the concession is not expired', () => {
        checkInBetweenFn(null, null, momentNow(), timezone, true);
      });
    });

    describe('start and end dates are set ', () => {
      describe('validations for start date ', () => {
        const currentTime = 1503176399000; // 2017-08-19T20:59:59+03:00

        describe('last moment before start the concession', () => {
          it('should be false, the concession does not start yet', () => {
            // 2017-08-19T23:59:59+03:00;
            checkInBetweenFn(startDate, endDate, currentTime, timezone, false);
          });
        });

        describe('the concession started', () => {
          it('should be true, the concession started', () => {
            const cTime = '2017-08-20T03:00:00+00:00';
            checkInBetweenFn(startDate, endDate, cTime, timezone, true);
          });
        });
      });

      describe('validations for end date ', () => {
        const currentTime = 1504213199000; // 2017-08-31T20:59:59+03:00

        describe('last moment to end the concession', () => {
          it('should be true, the concession is not expired', () => {
            const cTime = '2017-08-30T23:59:59+00:00';
            checkInBetweenFn(startDate, endDate, cTime, timezone, true);
          });
        });

        describe('the concession ended', () => {
          it('should be false, the concession is expired', () => {
            // 2017-09-01T00:00:00+03:00;
            checkInBetweenFn(startDate, endDate, currentTime + 1000, timezone, false);
          });
        });
      });
    });

    describe('start is not set ', () => {
      const currentTime = 1504213199000; // 2017-08-31T20:59:59+03:00

      describe('last moment to end the concession', () => {
        it('should be true, the concession is not expired', () => {
          const cTime = '2017-08-30T23:59:59+00:00';
          checkInBetweenFn(null, endDate, cTime, timezone, true);
        });
      });

      describe('the concession ended', () => {
        it('should be false, the concession is expired', () => {
          // 2017-09-01T00:00:00+03:00;
          checkInBetweenFn(null, endDate, currentTime + 1000, timezone, false);
        });
      });
    });

    describe('end is not set ', () => {
      const currentTime = 1503176399000; // 2017-08-19T20:59:59+03:00

      describe('last moment before start the concession', () => {
        it('should be false, the concession does not start yet', () => {
          // 2017-08-19T23:59:59+03:00;
          checkInBetweenFn(startDate, null, currentTime, timezone, false);
        });
      });

      describe('the concession started', () => {
        it('should be true, the concession started', () => {
          const cTime = '2017-08-20T03:00:00+00:00';
          checkInBetweenFn(startDate, null, cTime, timezone, true);
        });
      });
    });
  });

  describe('current time using UTC time', () => {
    const startDate = '2017-08-20T00:00:00.000Z';
    const endDate = '2017-08-31T00:00:00.000Z';

    describe('start and end dates are not set ', () => {
      // it can be any time
      it('should be true, the concession is not expired', () => {
        checkInBetweenFn(null, null, momentNow(), null, true);
      });
    });

    describe('start and end dates are set ', () => {
      describe('validations for start date ', () => {
        const currentTime = 1503187199000; // 2017-08-19T23:59:59+00:00

        describe('last moment before start the concession', () => {
          it('should be false, the concession does not start yet', () => {
            // 2017-08-19T23:59:59+00:00
            checkInBetweenFn(startDate, endDate, currentTime, null, false);
          });
        });

        describe('the concession started', () => {
          it('should be true, the concession started', () => {
            // 2017-08-20T00:00:00+00:00;
            checkInBetweenFn(startDate, endDate, currentTime + 1000, null, true);
          });
        });
      });

      describe('validations for end date ', () => {
        const currentTime = 1504223999000; // 2017-08-31T23:59:59+00:00;

        describe('last moment to end the concession', () => {
          it('should be true, the concession is not expired', () => {
            const cTime = toMoment('2017-08-30T23:59:59+00:00');
            checkInBetweenFn(startDate, endDate, cTime, null, true);
          });
        });

        describe('the concession ended', () => {
          it('should be false, the concession is expired', () => {
            // 2017-09-01T00:00:00+00:00;
            checkInBetweenFn(startDate, endDate, currentTime + 1000, null, false);
          });
        });
      });
    });

    describe('start is not set ', () => {
      const currentTime = 1504223999000; // 2017-08-31T23:59:59+00:00;

      describe('last moment to end the concession', () => {
        it('should be true, the concession is not expired', () => {
          // 2017-08-31T23:59:59+00:00;
          checkInBetweenFn(null, toMoment(endDate).endOf('day'), currentTime, null, true);
        });
      });

      describe('the concession ended', () => {
        it('should be false, the concession is expired', () => {
          // 2017-09-01T00:00:00+00:00;
          checkInBetweenFn(null, endDate, currentTime + 1000, null, false);
        });
      });
    });

    describe('end is not set ', () => {
      const currentTime = 1503187199000; // 2017-08-19T23:59:59+00:00

      describe('last moment before start the concession', () => {
        it('should be false, the concession does not start yet', () => {
          // 2017-08-19T23:59:59+00:00
          checkInBetweenFn(startDate, null, currentTime, null, false);
        });
      });

      describe('the concession started', () => {
        it('should be true, the concession started', () => {
          // 2017-08-20T00:00:00+00:00;
          checkInBetweenFn(startDate, null, currentTime + 1000, null, true);
        });
      });
    });
  });
});

const DATE_TIME_WITH_ZERO_MINUTES = toMoment('2016-01-14T06:00:00.000Z');
const DATE_TIME_WITH_TEN_MINUTES = toMoment('2016-01-14T06:10:00.000Z');
const DATE_TIME_WITH_FIFTEEN_MINUTES = toMoment('2016-01-14T06:15:00.000Z');
const DATE_TIME_WITH_SEVENTEEN_MINUTES = toMoment('2016-01-14T06:17:00.000Z');
const DATE_TIME_WITH_THIRTY_MINUTES = toMoment('2016-01-14T06:30:00.000Z');
const DATE_TIME_WITH_THIRTY_TWO_MINUTES = toMoment('2016-01-14T06:32:00.000Z');
const DATE_TIME_WITH_FORTY_FIVE_MINUTES = toMoment('2016-01-14T06:45:00.000Z');
const DATE_TIME_WITH_FORTY_SEVEN_MINUTES = toMoment('2016-01-14T06:47:00.000Z');
const DATE_TIME_WITH_FIFTY_NINE_MINUTES_AND_FIFTY_NINE_SECONDS = toMoment('2016-01-14T06:59:59.000Z');
const DATE_TIME_WITH_TWENTY_NINE_MINUTES_AND_TWENTY_NINE_SECONDS = toMoment('2016-01-14T06:29:29.000Z');

describe('execute getClosestThirtyMinutesDelta function', () => {
  describe('given a datetime with zero minutes', () => {
    it('should return 0 delta minutes', () => {
      const result = getClosestThirtyMinutesDelta(DATE_TIME_WITH_ZERO_MINUTES);
      expect(result).to.equal(0);
    });
  });

  describe('given a datetime with ten minutes', () => {
    it('should return -10 delta minutes', () => {
      const result = getClosestThirtyMinutesDelta(DATE_TIME_WITH_TEN_MINUTES);
      expect(result).to.equal(-10);
    });
  });

  describe('given a datetime with fifteen minutes', () => {
    it('should return 15 delta minutes', () => {
      const result = getClosestThirtyMinutesDelta(DATE_TIME_WITH_FIFTEEN_MINUTES);
      expect(result).to.equal(15);
    });
  });

  describe('given a datetime with seventeen minutes', () => {
    it('should return 13 delta minutes', () => {
      const result = getClosestThirtyMinutesDelta(DATE_TIME_WITH_SEVENTEEN_MINUTES);
      expect(result).to.equal(13);
    });
  });

  describe('given a datetime with thirty minutes', () => {
    it('should return 0 delta minutes', () => {
      const result = getClosestThirtyMinutesDelta(DATE_TIME_WITH_THIRTY_MINUTES);
      expect(result).to.equal(0);
    });
  });

  describe('given a datetime with thirty two minutes', () => {
    it('should return -2 delta minutes', () => {
      const result = getClosestThirtyMinutesDelta(DATE_TIME_WITH_THIRTY_TWO_MINUTES);
      expect(result).to.equal(-2);
    });
  });

  describe('given a datetime with forty five minutes', () => {
    it('should return 15 delta minutes', () => {
      const result = getClosestThirtyMinutesDelta(DATE_TIME_WITH_FORTY_FIVE_MINUTES);
      expect(result).to.equal(15);
    });
  });

  describe('given a datetime with forty seven minutes', () => {
    it('should return 13 delta minutes', () => {
      const result = getClosestThirtyMinutesDelta(DATE_TIME_WITH_FORTY_SEVEN_MINUTES);
      expect(result).to.equal(13);
    });
  });
});

describe('execute roundDateToThirtyMinutes function', () => {
  describe('given a datetime with fifteen minutes', () => {
    it('should return the date rounded to the beggining of the hour', () => {
      const result = roundDateToThirtyMinutes(DATE_TIME_WITH_FIFTEEN_MINUTES);
      expect(result.isSame(DATE_TIME_WITH_ZERO_MINUTES)).to.equal(true);
    });
  });

  describe('given a datetime with twenty nine minutes and twenty nine seconds', () => {
    it('should return the date rounded to the to the beggining of the hour', () => {
      const result = roundDateToThirtyMinutes(DATE_TIME_WITH_TWENTY_NINE_MINUTES_AND_TWENTY_NINE_SECONDS);
      expect(result.isSame(DATE_TIME_WITH_ZERO_MINUTES)).to.equal(true);
    });
  });

  describe('given a datetime with thirty minutes', () => {
    it('should return the same date', () => {
      const result = roundDateToThirtyMinutes(DATE_TIME_WITH_THIRTY_MINUTES);
      expect(result.isSame(DATE_TIME_WITH_THIRTY_MINUTES)).to.equal(true);
    });
  });

  describe('given a datetime with forty five minutes', () => {
    it('should return the date rounded to the half hour from the beginning of the hour', () => {
      const result = roundDateToThirtyMinutes(DATE_TIME_WITH_FORTY_FIVE_MINUTES);
      expect(result.isSame(DATE_TIME_WITH_THIRTY_MINUTES)).to.equal(true);
    });
  });

  describe('given a datetime with fifty nine minutes and fifty nine seconds', () => {
    it('should return the date rounded to the half hour from the beginning of the hour', () => {
      const result = roundDateToThirtyMinutes(DATE_TIME_WITH_FIFTY_NINE_MINUTES_AND_FIFTY_NINE_SECONDS);
      expect(result.isSame(DATE_TIME_WITH_THIRTY_MINUTES)).to.equal(true);
    });
  });
});

describe('execute getPastFormattedDateFromDelta function', () => {
  describe('given an initial date with a time frame and delta', () => {
    it('should return a formatted date according to the delta and time frame', () => {
      const INITIAL_DATE = '2018-04-17T16:30:00+00:00';
      const TWELVE_HOURS_IN_THE_PAST = '2018-04-17T04:30:00+00:00';
      const FORTY_EIGHT_HOURS_IN_THE_PAST = '2018-04-15T16:30:00+00:00';

      let formattedDate = getPastFormattedDateFromDelta(0, 'hours', new Date(INITIAL_DATE));
      expect(formattedDate).to.equal(INITIAL_DATE);

      formattedDate = getPastFormattedDateFromDelta(12, 'hours', new Date(INITIAL_DATE));
      expect(formattedDate).to.equal(TWELVE_HOURS_IN_THE_PAST);

      formattedDate = getPastFormattedDateFromDelta(48, 'hours', new Date(INITIAL_DATE));
      expect(formattedDate).to.equal(FORTY_EIGHT_HOURS_IN_THE_PAST);

      formattedDate = getPastFormattedDateFromDelta(2, 'days', new Date(INITIAL_DATE));
      expect(formattedDate).to.equal(FORTY_EIGHT_HOURS_IN_THE_PAST);

      formattedDate = getPastFormattedDateFromDelta(-12, 'hours', new Date(INITIAL_DATE));
      expect(formattedDate).to.equal(TWELVE_HOURS_IN_THE_PAST);

      formattedDate = getPastFormattedDateFromDelta(-48, 'hours', new Date(INITIAL_DATE));
      expect(formattedDate).to.equal(FORTY_EIGHT_HOURS_IN_THE_PAST);

      formattedDate = getPastFormattedDateFromDelta(-2, 'days', new Date(INITIAL_DATE));
      expect(formattedDate).to.equal(FORTY_EIGHT_HOURS_IN_THE_PAST);
    });
  });
});
