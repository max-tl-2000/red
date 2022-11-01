/*
 * Copyright (c) 2022 Reva Technology Inc., all rights reserved.
 * Unauthorized copying of this file, via any medium is strictly prohibited
 * Licensed under the Elastic License 2.0; you may not use this file except
 * in compliance with the Elastic License 2.0.
 */

import { mount } from 'enzyme';
import React from 'react';
import * as T from '../Typography';
import { restore, override } from '../../../../common/test-helpers/overrider';

describe('Typography', () => {
  let consoleMock;

  beforeEach(() => {
    consoleMock = { error: jest.fn() };

    override(console, consoleMock);
  });

  afterEach(() => restore());

  it('should not throw when an object is provided as children', () => {
    const testFn = () => {
      mount(<T.Text>{{ hello: 'world' }}</T.Text>);
    };
    expect(testFn).not.toThrow();
    expect(consoleMock.error).toHaveBeenCalledTimes(2);
    expect(consoleMock.error).toHaveBeenLastCalledWith('Invalid children found', 'text', {
      hello: 'world',
    });
  });

  it('should render simple Text elements', () => {
    const component = mount(<T.Text>Some simple text element</T.Text>);
    expect(component).toMatchSnapshot();
  });
});
