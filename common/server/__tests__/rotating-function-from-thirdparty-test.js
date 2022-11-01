/*
 * Copyright (c) 2022 Reva Technology Inc., all rights reserved.
 * Unauthorized copying of this file, via any medium is strictly prohibited
 * Licensed under the Elastic License 2.0; you may not use this file except
 * in compliance with the Elastic License 2.0.
 */

import { createGenerator } from 'rotating-file-stream';
import { toMoment } from '../../helpers/moment-utils';

describe('createGenerator returns a function', () => {
  it('should return the same filename in case of no date', () => {
    const fn = createGenerator('./logs/bes-api.log');

    const name = fn(undefined, 0);

    expect(name).toEqual('logs/bes-api.log');
  });

  it('should return the name interpolated with the index and time', () => {
    const fn = createGenerator('./logs/bes-api.log');

    const name = fn(toMoment('2020-09-25T14:10:40.531Z').toDate(), 1);

    expect(name).toEqual('logs/20200925-1410-01-bes-api.log');
  });

  it('should return the name interpolated with the index and time when index is greater than one', () => {
    const fn = createGenerator('./logs/bes-api.log');

    const name = fn(toMoment('2020-09-25T14:10:40.531Z').toDate(), 12);

    expect(name).toEqual('logs/20200925-1410-12-bes-api.log');
  });
});
