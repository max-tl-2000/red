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
import { Icon } from 'components';
import { observer } from 'mobx-react';
import { cf, g } from './IconSelector.scss';

@observer
export default class IconAnimation extends Component {
  constructor(props, context) {
    super(props, context);
    this.id = generateId(this);
    this.state = {
      selectedIndex: 0,
    };
  }

  static propTypes = {
    id: PropTypes.string,
    selectedIcons: PropTypes.array,
  };

  componentDidMount() {
    this._mounted = true;
    this.interval = setInterval(() => {
      if (!this._mounted) {
        return;
      }
      this.setState({
        selectedIndex: (this.state.selectedIndex + 1) % 2,
      });
    }, 1500);
  }

  componentWillUnmount() {
    this._mounted = false;
    clearInterval(this.interval);
  }

  render() {
    const { className, id, selectedIcons = [], ...rest } = this.props;
    const theId = clsc(id, this.id);

    const { selectedIndex } = this.state;
    const currentIcon = selectedIcons[selectedIndex];

    return (
      <div id={theId} className={cf('icon-animation', g(className))} {...rest}>
        <Icon className={cf('icon')} name={currentIcon} />
      </div>
    );
  }
}
