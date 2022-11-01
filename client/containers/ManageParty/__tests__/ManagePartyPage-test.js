/*
 * Copyright (c) 2022 Reva Technology Inc., all rights reserved.
 * Unauthorized copying of this file, via any medium is strictly prohibited
 * Licensed under the Elastic License 2.0; you may not use this file except
 * in compliance with the Elastic License 2.0.
 */

import React from 'react';
import { mount } from 'enzyme';
import getUUID from 'uuid/v4';
import Immutable from 'immutable';

const { mockModules } = require('test-helpers/mocker').default(jest);

const userId = getUUID();
const baseProps = {
  partyMembers: new Immutable.Map(),
  party: {
    qualificationQuestions: {},
  },
  prospectId: getUUID(),
  loggedInUser: { id: userId, features: {} },
  users: new Map([[userId, {}]]),
};

class MockAPIClass {
  get() {}

  post() {}

  patch() {}

  on() {}

  fire() {}
}

describe('ManagePartyPage', () => {
  let ManagePartyPageComponent;
  beforeEach(() => {
    mockModules({
      '../../../helpers/ApiClient': MockAPIClass,
    });
    ManagePartyPageComponent = require('../ManagePartyPage').ManagePartyPageComponent; // eslint-disable-line global-require
  });

  afterEach(() => jest.resetModules());
  it('should render the component without throwing', () => {
    const renderComponent = () => mount(<ManagePartyPageComponent {...baseProps} />);
    expect(renderComponent).not.toThrow();
  });
});
