/*
 * Copyright (c) 2022 Reva Technology Inc., all rights reserved.
 * Unauthorized copying of this file, via any medium is strictly prohibited
 * Licensed under the Elastic License 2.0; you may not use this file except
 * in compliance with the Elastic License 2.0.
 */

import PropTypes from 'prop-types';
import React, { Component } from 'react';
import generateId from 'helpers/generateId';
import clsc from 'helpers/coalescy';
import { icons } from 'components/Icon/Icon';
import { observer } from 'mobx-react';
import { Dropdown } from 'components';
import IconModel from './IconModel';
import IconAnimation from './IconAnimation';
import { cf, g } from './IconSelector.scss';

@observer
export default class IconSelector extends Component {
  constructor(props, context) {
    super(props, context);
    this.id = generateId(this);

    const model = new IconModel(icons);
    this.state = {
      model,
    };
  }

  static propTypes = {
    id: PropTypes.string,
  };

  setItemA = args => {
    const { id } = args || {};
    this.state.model.selectedA = id;
  };

  setItemB = args => {
    const { id } = args || {};
    this.state.model.selectedB = id;
  };

  render() {
    const { className, id, ...rest } = this.props;
    const theId = clsc(id, this.id);

    const { model } = this.state;

    return (
      <div id={theId} className={cf('icon-selector', g(className))} {...rest}>
        <div>
          <IconAnimation key={model.selectedIcons.join('_')} selectedIcons={model.selectedIcons} />
        </div>
        <div className={cf('options')}>
          <Dropdown
            className={cf('select')}
            filterable
            placeholder="Select an Icon"
            items={model.icons}
            selectedValue={model.selectedA}
            onChange={this.setItemA}
          />
          <Dropdown
            className={cf('select')}
            filterable
            placeholder="Select an Icon"
            items={model.icons}
            selectedValue={model.selectedB}
            onChange={this.setItemB}
          />
        </div>
      </div>
    );
  }
}
