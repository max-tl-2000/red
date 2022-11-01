/*
 * Copyright (c) 2022 Reva Technology Inc., all rights reserved.
 * Unauthorized copying of this file, via any medium is strictly prohibited
 * Licensed under the Elastic License 2.0; you may not use this file except
 * in compliance with the Elastic License 2.0.
 */

import { mount } from 'enzyme';
import React from 'react';
import * as overrider from 'test-helpers/overrider';
import * as globals from '../../../../common/helpers/globals';
import DemoElement from '../DemoElement';

describe('<DemoElement />', () => {
  afterEach(() => overrider.restore());

  it('should render the provided children if the tenant name starts with demo', () => {
    overrider.override(globals, {
      window: {
        location: {
          host: 'demo1.demo.env.reva.tech',
        },
      },
    });

    const wrapper = mount(
      <DemoElement>
        <div>Rendered element because is demo</div>
      </DemoElement>,
    );
    expect(wrapper.find('div').text()).toEqual('Rendered element because is demo');
  });

  it('should not render the provided children if the tenant name does not start with demo', () => {
    overrider.override(globals, {
      window: {
        location: {
          host: 'tenant.prod.reva.tech',
        },
      },
    });

    const wrapper = mount(
      <DemoElement>
        <div>Won't be rendered because not demo</div>
      </DemoElement>,
    );
    expect(wrapper.find('div').length).toEqual(0);
  });
});
