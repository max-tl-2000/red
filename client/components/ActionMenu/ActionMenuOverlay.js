/*
 * Copyright (c) 2022 Reva Technology Inc., all rights reserved.
 * Unauthorized copying of this file, via any medium is strictly prohibited
 * Licensed under the Elastic License 2.0; you may not use this file except
 * in compliance with the Elastic License 2.0.
 */

import React, { Component, Children, cloneElement } from 'react';
import generateId from 'helpers/generateId';
import { VelocityComponent } from 'helpers/velocity';

export default class ActionMenuOverlay extends Component {
  constructor(props, context) {
    super(props, context);
    this.id = generateId(this);
  }

  render() {
    const { isOpen, onAnimationDone, rightAligned } = this.props;

    let counter = 0;
    const theChildren = this.props.children;
    const childrenCount = Children.count(theChildren);
    let completeCount = 0;

    const children = Children.map(theChildren, child => {
      const animProps = {
        animation: {
          opacity: isOpen ? 1 : 0,
          // scale: isOpen ? 1 : 0,
          translateY: isOpen ? 0 : 56 * (childrenCount - counter),
          transformOriginX: ['100%', '100%'],
        },
        delay: (childrenCount - counter) * 50,
        easing: [250, 20],
        duration: 950,
        complete: () => {
          completeCount++;
          if (completeCount === childrenCount) {
            onAnimationDone && onAnimationDone();
          }
        },
      };

      counter++;

      return <VelocityComponent {...animProps}>{cloneElement(child, { ...child.props, rightAligned })}</VelocityComponent>;
    });

    return <div data-component="action-menu-overlay">{children}</div>;
  }
}
