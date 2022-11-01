/*
 * Copyright (c) 2022 Reva Technology Inc., all rights reserved.
 * Unauthorized copying of this file, via any medium is strictly prohibited
 * Licensed under the Elastic License 2.0; you may not use this file except
 * in compliance with the Elastic License 2.0.
 */

/* eslint-disable global-require */
import { observable, action } from 'mobx';
import $ from 'jquery';
import { sleep } from '../../../../common/test-helpers/index';

const { mockModules } = require('../../../../common/test-helpers/mocker').default(jest);

class AuthMock {
  @observable
  impersonatorUserId;

  @action
  addImpersonationInfo(impersonatorUserId) {
    this.impersonatorUserId = impersonatorUserId;
  }
}

class ApplicationMock {
  @observable
  applicantEmail;

  @observable
  personId;

  @action
  updateData(personId, applicantEmail) {
    this.personId = personId;
    this.applicantEmail = applicantEmail;
  }
}

describe('walk-me-globals', () => {
  let globalMock;
  let registerWalkMeGlobals;
  const mock = {};

  beforeEach(() => {
    globalMock = {
      window: {
        set __reva_personEmail(value) {
          mock.email = value;
        },
        get __reva_personEmail() {
          return mock.email;
        },
        set __reva_personId(value) {
          mock.personId = value;
        },
        get __reva_personId() {
          return mock.personId;
        },

        set __reva_userId(value) {
          mock.userId = value;
        },
        get __reva_userId() {
          return mock.userId;
        },
        set __reva_walkMeEmail(value) {
          mock.__reva_walkMeEmail = value;
        },
        get __reva_walkMeEmail() {
          return mock.__reva_walkMeEmail;
        },
      },
      document,
    };
    mockModules({
      '../../../../common/helpers/globals': globalMock,
    });
    registerWalkMeGlobals = require('../walk-me-globals').registerWalkMeGlobals;
  });

  describe('when applicationEmail or personId is nullish', () => {
    it('should register __reva_personId and __reva_personEmail in the global object as undefined', () => {
      const application = new ApplicationMock();
      const auth = new AuthMock();
      registerWalkMeGlobals(application, auth, 'dummyWalkMeUrl');

      expect(globalMock.window.__reva_personEmail).toEqual(undefined);
      expect(globalMock.window.__reva_personId).toEqual(undefined);
      expect(globalMock.window.__reva_walkMeEmail).toEqual(undefined);
    });

    describe('and later it changes to a non nullish value', () => {
      it('should register __reva_personId and __reva_personEmail in the global object with the values set in the application Object', () => {
        const application = new ApplicationMock();
        const auth = new AuthMock();
        const testScriptSrc = 'https://www.test.com';
        registerWalkMeGlobals(application, auth, testScriptSrc);

        application.updateData('someId', 'snoopy@reva.tech');

        expect(globalMock.window.__reva_personEmail).toEqual('snoopy@reva.tech');
        expect(globalMock.window.__reva_personId).toEqual('someId');
        expect(globalMock.window.__reva_walkMeEmail).toEqual('snoopy@reva.tech');
        expect($('script').attr('src')).toEqual(testScriptSrc);
      });
    });

    describe('and later it changes to a non nullish value and contains impersonatorUserId', () => {
      it('should register __reva_personId and __reva_personEmail and __reva_userId in the global object with the values set in the application Object', () => {
        const application = new ApplicationMock();
        const auth = new AuthMock();
        registerWalkMeGlobals(application, auth, 'dummyWalkMeUrl');

        application.updateData('someId', 'snoopy@reva.tech');
        auth.addImpersonationInfo('someImpersonatorId');

        expect(globalMock.window.__reva_personEmail).toEqual('snoopy@reva.tech');
        expect(globalMock.window.__reva_personId).toEqual('someId');
        expect(globalMock.window.__reva_userId).toEqual('someImpersonatorId');
        expect(globalMock.window.__reva_walkMeEmail).toEqual('snoopy@reva.tech');
      });
    });

    describe('and later it changes to a nullish value', () => {
      it('should register __reva_personId and __reva_personEmail in the global object as undefined', async () => {
        const application = new ApplicationMock();
        const auth = new AuthMock();
        registerWalkMeGlobals(application, auth, 'dummyWalkMeUrl');

        application.updateData('someId', 'snoopy@reva.tech');

        await sleep(50);

        application.updateData('', '');

        expect(globalMock.window.__reva_personEmail).toEqual(null);
        expect(globalMock.window.__reva_personId).toEqual(null);
        expect(globalMock.window.__reva_walkMeEmail).toEqual(null);
      });
    });
  });
});
