/*
 * Copyright (c) 2022 Reva Technology Inc., all rights reserved.
 * Unauthorized copying of this file, via any medium is strictly prohibited
 * Licensed under the Elastic License 2.0; you may not use this file except
 * in compliance with the Elastic License 2.0.
 */

import React, { Children, Component } from 'react';
import nullish from 'helpers/nullish';
import { observer } from 'mobx-react';
import elevationShadow from 'helpers/elevationShadow';
import { VelocityComponent } from 'helpers/velocity';

import { cf, g } from './FlyOut.scss';
import FlyOutActions from './FlyOutActions';
import FlyOutHeader from './FlyOutHeader';

const flyOutActionsType = (<FlyOutActions />).type;

const animationsByExpandTo = {
  bottom: open => ({
    translateY: open ? 0 : '-10%',
    transformOriginX: ['50%', '50%'],
    transformOriginY: ['0', '0'],
  }),
  'bottom-left': open => ({
    translateY: open ? 0 : '-10%',
    transformOriginX: ['100%', '100%'],
    transformOriginY: ['0', '0'],
  }),
  'bottom-right': open => ({
    translateY: open ? 0 : '-10%',
    transformOriginX: ['0', '0'],
    transformOriginY: ['0', '0'],
  }),
  top: open => ({
    translateY: open ? 0 : '10%',
    transformOriginX: ['50%', '50%'],
    transformOriginY: ['100%', '100%'],
  }),
  'top-left': open => ({
    translateY: open ? 0 : '10%',
    transformOriginX: ['100%', '100%'],
    transformOriginY: ['100%', '100%'],
  }),
  'top-right': open => ({
    translateY: open ? 0 : '10%',
    transformOriginX: ['0', '0'],
    transformOriginY: ['100%', '100%'],
  }),
  right: open => ({
    translateX: open ? 0 : '-10%',
    transformOriginX: ['0', '0'],
    transformOriginY: ['50%', '50%'],
  }),
  'right-bottom': open => ({
    translateX: open ? 0 : '-10%',
    transformOriginX: ['0', '0'],
    transformOriginY: ['0', '0'],
  }),
  'right-top': open => ({
    translateX: open ? 0 : '-10%',
    transformOriginX: ['0', '0'],
    transformOriginY: ['100%', '100%'],
  }),
  left: open => ({
    translateX: open ? 0 : '10%',
    transformOriginX: ['100%', '100%'],
    transformOriginY: ['50%', '50%'],
  }),
  'left-bottom': open => ({
    translateX: open ? 0 : '10%',
    transformOriginX: ['100%', '100%'],
    transformOriginY: ['0', '0'],
  }),
  'left-top': open => ({
    translateX: open ? 0 : '10%',
    transformOriginX: ['100%', '100%'],
    transformOriginY: ['100%', '100%'],
  }),
};

@observer
export default class FlyOutOverlay extends Component {
  constructor(props) {
    super(props);
    this.state = {
      showing: props.open,
    };
  }

  componentWillReceiveProps(nextProps) {
    if (nextProps.open) {
      if (this.state.showing) {
        // already shown
        return;
      }

      this.setState({
        showing: true,
      });
    }
  }

  handleComplete = () => {
    const { onComplete, open } = this.props;
    if (!open) {
      this.setState({
        showing: false,
      });
    }
    onComplete && onComplete();
  };

  render() {
    const { showing } = this.state;
    const {
      children,
      // the container prop makes the flyOut to provide
      // default padding of 1rem on each side. Which is
      // a nice default in case the element inside does
      // not provide its own padding
      container = true,
      open,
      elevation = 24,
      expandTo,
      lazy,
      className,
      contentClassName,
      animationFn,
      title,
      style,
      id,
      onComplete, // eslint-disable-line
      ...props
    } = this.props;

    const method = animationsByExpandTo[expandTo] || function def() {};

    let theChildren = children;

    if (lazy) {
      theChildren = showing ? () => children : undefined;
    }

    const [flyoutActions] = Children.toArray(children).filter(child => child.type === flyOutActionsType);

    const animProps = {
      animation: {
        opacity: open ? 1 : 0,
        scale: open ? 1 : 0,
        ...method(open),
      },
      easing: [250, 30],
      duration: 600,
    };

    if (animationFn) {
      animationFn({ open, animProps });
    }

    animProps.complete = this.handleComplete;

    const overlayStyle = {
      boxShadow: elevationShadow(elevation),
      ...style,
    };

    const titleComponent = typeof title === 'string' ? <FlyOutHeader title={title} /> : title;

    return (
      <VelocityComponent {...animProps}>
        <div data-component="flyout-overlay" className={cf('flyout-overlay', { container, 'with-actions': !nullish(flyoutActions) }, g(className))} {...props}>
          <div data-component="flyout-content" className={contentClassName} style={overlayStyle}>
            {titleComponent}
            {typeof theChildren === 'function' ? theChildren() : theChildren}
          </div>
        </div>
      </VelocityComponent>
    );
  }
}
