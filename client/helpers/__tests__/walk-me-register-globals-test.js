/*
 * Copyright (c) 2022 Reva Technology Inc., all rights reserved.
 * Unauthorized copying of this file, via any medium is strictly prohibited
 * Licensed under the Elastic License 2.0; you may not use this file except
 * in compliance with the Elastic License 2.0.
 */

/* eslint-disable global-require */
const { mockModules } = require('../../../common/test-helpers/mocker').default(jest);
import $ from 'jquery';

describe('walk-me-globals', () => {
  let globalMock;
  let mockMediator;
  let registerWalkMeGlobals;
  const mockWindow = {};
  let fns;

  beforeEach(() => {
    fns = [];

    mockMediator = {
      on: (e, fn) => {
        fns.push(fn);
      },
    };

    globalMock = {
      window: {
        set __reva_userEmail(value) {
          mockWindow.email = value;
        },
        get __reva_userEmail() {
          return mockWindow.email;
        },
        set __reva_userId(value) {
          mockWindow.userId = value;
        },
        get __reva_userId() {
          return mockWindow.userId;
        },

        set __reva_walkMeEmail(value) {
          mockWindow.__reva_walkMeEmail = value;
        },
        get __reva_walkMeEmail() {
          return mockWindow.__reva_walkMeEmail;
        },
      },
      document,
    };
    mockModules({
      '../mediator': mockMediator,
      '../../../common/helpers/globals': globalMock,
    });
    registerWalkMeGlobals = require('../walk-me-register-globals').registerWalkMeGlobals;
  });

  describe('when user is not logged in', () => {
    it('should register __reva_userId and __reva_userEmail in the global object as undefined', () => {
      registerWalkMeGlobals('dummyUrl');

      expect(globalMock.window.__reva_userEmail).toEqual(undefined);
      expect(globalMock.window.__reva_userId).toEqual(undefined);
      expect(globalMock.window.__reva_walkMeEmail).toEqual(undefined);
      expect($('script').attr('src')).toEqual(undefined);
    });

    describe('and later the user logs in', () => {
      it('should register __reva_userId and __reva_userEmail in the global object with the values set in the application Object', async () => {
        const testScriptSrc = 'https://www.test.com';
        registerWalkMeGlobals(testScriptSrc);

        // fns[0] is the user:login fn
        fns[0]({}, { user: { id: 'someId', email: 'snoopy@reva.tech' } });

        expect(globalMock.window.__reva_userEmail).toEqual('snoopy@reva.tech');
        expect(globalMock.window.__reva_userId).toEqual('someId');
        expect(globalMock.window.__reva_walkMeEmail).toEqual('snoopy@reva.tech');
        expect($('script').attr('src')).toEqual(testScriptSrc);
      });
    });

    describe('and later it changes to a nullish value', () => {
      it('should register __reva_userId and __reva_userEmail in the global object as undefined', () => {
        registerWalkMeGlobals('https://www.test.com');

        // fns[0] is the user:login fn
        fns[0]({}, { user: { id: 'someId', email: 'snoopy@reva.tech' } });

        // fns[0] is the user:logout fn
        fns[1]();

        expect(globalMock.window.__reva_userEmail).toEqual(null);
        expect(globalMock.window.__reva_userId).toEqual(null);
        expect(globalMock.window.__reva_walkMeEmail).toEqual(null);
      });
    });
  });
});
