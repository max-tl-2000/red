/*
 * Copyright (c) 2022 Reva Technology Inc., all rights reserved.
 * Unauthorized copying of this file, via any medium is strictly prohibited
 * Licensed under the Elastic License 2.0; you may not use this file except
 * in compliance with the Elastic License 2.0.
 */

import React, { Component } from 'react';
import { VelocityComponent } from 'helpers/velocity';
import { cf, g } from './ExpandableCard.scss';

export default class ContentCard extends Component {
  handleComplete = () => {
    const { onHidden } = this.props;
    onHidden && onHidden();
  };

  render() {
    const { children, className, expanded, onHidden, ...rest } = this.props;

    const animProps = {
      animation: {
        opacity: expanded ? 1 : 0,
        scaleY: expanded ? 1 : 0,
        transformOriginX: ['50%', '50%'],
        transformOriginY: [0, 0],
        translateY: expanded ? 0 : 10,
      },
      complete: expanded ? null : this.handleComplete,
      easing: expanded ? [250, 25] : 'easeOut',
      duration: expanded ? 550 : 300,
    };

    return (
      <VelocityComponent {...animProps}>
        <div className={cf('content-card', g(className))} {...rest}>
          {children}
        </div>
      </VelocityComponent>
    );
  }
}
