/*
 * Copyright (c) 2022 Reva Technology Inc., all rights reserved.
 * Unauthorized copying of this file, via any medium is strictly prohibited
 * Licensed under the Elastic License 2.0; you may not use this file except
 * in compliance with the Elastic License 2.0.
 */

import React, { Component } from 'react';
import { VelocityComponent } from 'helpers/velocity';
import elevationShadow from 'helpers/elevationShadow';
import { cf, g } from './Dialog.scss';
import DialogActions from './DialogActions';
import DialogHeader from './DialogHeader';

const dialogActionsType = (<DialogActions />).type;
const dialogHeaderType = (<DialogHeader />).type;
export default class DialogOverlay extends Component {
  constructor(props) {
    super(props);
    this.state = {
      showing: props.open,
    };
  }

  componentWillReceiveProps(nextProps) {
    if (nextProps.open) {
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

  getSections(children) {
    if (!Array.isArray(children)) {
      children = [children]; // eslint-disable-line
    }
    return children.reduce((seq, child) => {
      // it might be weird to pass null as a child
      // but it seems that when using JSXExpressions
      // if those expressions resolve to null or undefined
      // accessing the type will throw so in order to
      // prevent that we first ask for the type.
      //
      // Not sure if it makes sense to just pass null/undefined
      // but since we're currently receiving it as null/undefined
      // we just push that back to where it came
      if (child && child.type === dialogHeaderType) {
        seq.dialogHeader = child;
      } else if (child && child.type === dialogActionsType) {
        seq.dialogActions = child;
      } else {
        seq.others = seq.others || [];
        seq.others.push(child);
      }
      return seq;
    }, {});
  }

  render() {
    const { showing } = this.state;
    const {
      children,
      open,
      elevation = 24,
      className,
      container = true,
      type,
      title,
      compact,
      onComplete, // eslint-disable-line
      titleIconName,
      titleIconClassName,
      noMaxWidth,
      noMaxHeight,
      ...props
    } = this.props;

    const fullscreen = type === 'fullscreen';

    const elements = this.getSections(children);

    const animProps = {
      animation: {
        opacity: open ? 1 : 0,
        scale: fullscreen ? 1 : (open ? 1 : .5), // eslint-disable-line
        transformOriginX: ['50%', '50%'],
        transformOriginY: ['50%', '50%'],
        translateY: fullscreen ? 0 : (open ? 0 : 10), // eslint-disable-line
      },
      runOnMount: true,
      easing: fullscreen ? 'easeOut' : [250, 25],
      duration: fullscreen ? 400 : 550,
      complete: this.handleComplete,
    };

    const overlayStyle = {
      boxShadow: fullscreen ? 'none' : elevationShadow(elevation),
    };

    const withButtons = !!elements.dialogActions;
    const withHeader = !!elements.dialogHeader;
    const classes = cf(
      'dialog-overlay',
      {
        'with-buttons': withButtons,
        'no-header': !(withHeader || title),
        compact,
        container,
        fullscreen,
      },
      g(className),
    );

    return (
      <VelocityComponent {...animProps}>
        <div className={classes} data-compact={compact} data-with-buttons={withButtons} data-component="dialog-overlay" id="dialog-overlay" {...props}>
          <div style={overlayStyle}>
            {do {
              if (showing) {
                if (elements.dialogHeader) {
                  elements.dialogHeader;
                } else if (title) {
                  <DialogHeader title={title} titleIconName={titleIconName} titleIconClassName={titleIconClassName} />;
                }
              }
            }}
            {showing && (
              <div data-component="dialog-body" className={cf('dialog-body', { noMaxWidth, noMaxHeight })}>
                {elements.others}
              </div>
            )}
            {showing && elements.dialogActions}
          </div>
        </div>
      </VelocityComponent>
    );
  }
}
