/*
 * Copyright (c) 2022 Reva Technology Inc., all rights reserved.
 * Unauthorized copying of this file, via any medium is strictly prohibited
 * Licensed under the Elastic License 2.0; you may not use this file except
 * in compliance with the Elastic License 2.0.
 */

import React from 'react';
import { render } from 'react-dom';
import { expect, getSandBoxDiv } from 'test-helpers';
import $ from 'jquery';
import FlyOutAmountEditor from '../FlyOutAmountEditor';

const getNumber = () => {
  const integer = $('[data-part="integer"]').text();
  const decimals = $('[data-component="text"]').text();
  return `${integer}${decimals}`;
};

const renderComponent = props => {
  const sandBoxDiv = getSandBoxDiv();
  render(<FlyOutAmountEditor {...props} />, sandBoxDiv);
};

describe('FlyOutAmountEditor', () => {
  it('Should display $0.00 when the value is zero', () => {
    const props = {
      value: 0,
    };
    renderComponent(props);
    expect(getNumber()).to.equal('$0.00');
  });

  it('Should display $<integer>.00 when the value is an integer greather than zero', () => {
    const props = {
      value: 9,
    };
    renderComponent(props);
    expect(getNumber()).to.equal('$9.00');
  });

  it('Should display $<integer>.<decimals> when the value is an decimal number greather than zero', () => {
    const props = {
      value: 8.22,
    };
    renderComponent(props);
    expect(getNumber()).to.equal('$8.22');
  });
});
