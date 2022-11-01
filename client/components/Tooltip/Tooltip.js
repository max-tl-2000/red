/*
 * Copyright (c) 2022 Reva Technology Inc., all rights reserved.
 * Unauthorized copying of this file, via any medium is strictly prohibited
 * Licensed under the Elastic License 2.0; you may not use this file except
 * in compliance with the Elastic License 2.0.
 */

import PropTypes from 'prop-types';
import React, { Component } from 'react';
import FlyOut from '../FlyOut/FlyOut';
import FlyOutOverlay from '../FlyOut/FlyOutOverlay';
import { cf } from './Tooltip.scss';

export default class Tooltip extends Component {
  static propTypes = {
    text: PropTypes.any,
    hoverDelay: PropTypes.number,
    appendToBody: PropTypes.bool,
    zIndex: PropTypes.number,
  };

  static defaultProps = {
    position: 'top',
    hoverDelay: 300,
    appendToBody: true,
  };

  handleAnimation(args) {
    args.animProps.duration = 400;
  }

  render() {
    const trigger = React.Children.only(this.props.children);
    const { text, position, hoverDelay, appendToBody, zIndex } = this.props;

    return (
      <FlyOut zIndex={zIndex} expandTo={position} useHover hoverDelay={hoverDelay} appendToBody={appendToBody}>
        {trigger}
        <FlyOutOverlay container={false} data-component="tooltip-overlay" elevation={4} className={cf('flyout')} animationFn={this.handleAnimation}>
          <div className={cf('content')}>{text}</div>
        </FlyOutOverlay>
      </FlyOut>
    );
  }
}
