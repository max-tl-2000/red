/*
 * Copyright (c) 2022 Reva Technology Inc., all rights reserved.
 * Unauthorized copying of this file, via any medium is strictly prohibited
 * Licensed under the Elastic License 2.0; you may not use this file except
 * in compliance with the Elastic License 2.0.
 */

import React, { Component } from 'react';
import { Icon, Typography } from 'components';
import { cf } from './LifestylePreference.scss';

const { Caption } = Typography;

export default class LifestylePreference extends Component {
  constructor() {
    super();
    this.state = {
      hover: false,
    };
  }

  shouldComponentUpdate(nextProps, nextState) {
    return nextProps.selected !== this.props.selected || nextProps.matching !== this.props.matching || nextState.hover !== this.state.hover;
  }

  updateHoverState = () => {
    this.setState({
      hover: !this.state.hover,
    });
  };

  render() {
    const { text, iconName, iconNameSelected, selected, matching } = this.props;
    const { hover } = this.state;
    const highlight = hover || matching;

    return (
      <div className={cf('mainContent')} onMouseEnter={this.updateHoverState} onMouseLeave={this.updateHoverState}>
        <div className={cf('icon', { selected })}>
          <Icon name={selected ? iconNameSelected : iconName} />
        </div>
        <Caption secondary={!highlight} bold={highlight} className={cf('text')}>
          {text}
        </Caption>
      </div>
    );
  }
}
