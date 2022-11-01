/*
 * Copyright (c) 2022 Reva Technology Inc., all rights reserved.
 * Unauthorized copying of this file, via any medium is strictly prohibited
 * Licensed under the Elastic License 2.0; you may not use this file except
 * in compliance with the Elastic License 2.0.
 */

import { expect } from 'chai';
import { removeToken, convertToBoolean } from '../strings';

describe('strings helper', () => {
  describe('execute removeToken function', () => {
    [
      {
        url: 'https://localhost/applicantDetails',
        expectedUrl: 'https://localhost/applicantDetails',
      },
      {
        url:
          'https://localhost/welcome/eyJ0eXAiOiJKV1QiLCJhbGciOiJIUzI1NiJ9.eyJib2R5IjoiREVkUlY3ekZmdDdjVTA5ZGRnQmhIKzlvTnNsQ1Q2cEJwQi83RTJzPSIsImlhdCI6MTQ5ODUxNzkwNiwiZXhwIjoxNDk4NjkwNzA2fQ.NebmPyA2FDXdTUKk7_yCM-xjMJvUOgRet9uCxeGLE04',
        expectedUrl: 'https://localhost/welcome/',
      },
      {
        url:
          'https://localhost/partyApplications/6e34e923-0369-46ef-b481-86597e764009/review/eyJ0eXAiOiJKV1QiLCJhbGciOiJIUzI1NiJ9.eyJib2R5IjoiREVkUlY3ekZmdDdjVTA5ZGRnQmhIKzlvTnNsQ1Q2cEJwQi83RTJzPSIsImlhdCI6MTQ5ODUxNzkwNiwiZXhwIjoxNDk4NjkwNzA2fQ.NebmPyA2FDXdTUKk7_yCM-xjMJvUOgRet9uCxeGLE04',
        expectedUrl: 'https://localhost/partyApplications/6e34e923-0369-46ef-b481-86597e764009/review/',
      },
      {
        url:
          'https://localhost/INeedAToken?id=1&token=eyJ0eXAiOiJKV1QiLCJhbGciOiJIUzI1NiJ9.eyJib2R5IjoiREVkUlY3ekZmdDdjVTA5ZGRnQmhIKzlvTnNsQ1Q2cEJwQi83RTJzPSIsImlhdCI6MTQ5ODUxNzkwNiwiZXhwIjoxNDk4NjkwNzA2fQ.NebmPyA2FDXdTUKk7_yCM-xjMJvUOgRet9uCxeGLE04',
        expectedUrl: 'https://localhost/INeedAToken?id=1&',
      },
      {
        url:
          'https://localhost/INeedAToken?token=eyJ0eXAiOiJKV1QiLCJhbGciOiJIUzI1NiJ9.eyJib2R5IjoiREVkUlY3ekZmdDdjVTA5ZGRnQmhIKzlvTnNsQ1Q2cEJwQi83RTJzPSIsImlhdCI6MTQ5ODUxNzkwNiwiZXhwIjoxNDk4NjkwNzA2fQ.NebmPyA2FDXdTUKk7_yCM-xjMJvUOgRet9uCxeGLE04',
        expectedUrl: 'https://localhost/INeedAToken?',
      },
    ].forEach(({ url, expectedUrl }) => {
      it(`should remove the token information as query string or path name from the url - ${url}`, () => {
        expect(removeToken(url)).to.equal(expectedUrl);
      });
    });
  });

  describe('When a string or a boolean is passed', () => {
    [
      { input: 'TRUE', output: true },
      { input: 'true', output: true },
      { input: 'false', output: false },
      { input: true, output: true },
      { input: false, output: false },
      { input: 1, output: true },
      { input: '1', output: true },
      { input: null, output: false },
    ].forEach(({ input, output }) => {
      it(`should return the boolean value '${output}'' when the input is '${input}'`, () => {
        expect(convertToBoolean(input)).to.equal(output);
      });
    });
  });
});
