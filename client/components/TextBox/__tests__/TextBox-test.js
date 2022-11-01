/*
 * Copyright (c) 2022 Reva Technology Inc., all rights reserved.
 * Unauthorized copying of this file, via any medium is strictly prohibited
 * Licensed under the Elastic License 2.0; you may not use this file except
 * in compliance with the Elastic License 2.0.
 */

import React from 'react';
import { shallow } from 'enzyme';
import { shallowToJson } from 'enzyme-to-json';
import TextBox from '../TextBox';

describe('textbox', () => {
  it('should render a simple textbox', () => {
    const tree = shallow(<TextBox />);

    expect(shallowToJson(tree)).toMatchSnapshot();
  });

  it('should render a textbox with a clear affordance', () => {
    const tree = shallow(<TextBox showClear />);

    expect(shallowToJson(tree)).toMatchSnapshot();
  });

  it('should render a password field with an eye affordance', () => {
    const tree = shallow(<TextBox type="password" />);

    expect(shallowToJson(tree)).toMatchSnapshot();
  });
});
