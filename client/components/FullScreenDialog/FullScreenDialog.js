/*
 * Copyright (c) 2022 Reva Technology Inc., all rights reserved.
 * Unauthorized copying of this file, via any medium is strictly prohibited
 * Licensed under the Elastic License 2.0; you may not use this file except
 * in compliance with the Elastic License 2.0.
 */

import PropTypes from 'prop-types';
import React, { Component } from 'react';
import Dialog from '../Dialog/Dialog';
import DialogOverlay from '../Dialog/DialogOverlay';
import DialogHeader from '../Dialog/DialogHeader';
import DialogContent from '../Dialog/DialogContent';

import IconButton from '../IconButton/IconButton';

import { cf, g } from './FullScreenDialog.scss';
import Title from '../Typography/Title';

export default class FullScreenDialog extends Component {
  handleClose = e => {
    const { onCloseRequest } = this.props;

    if (onCloseRequest) {
      onCloseRequest({ source: 'closeButton', target: e.target });
      return;
    }

    this.refs.dlg.close();
  };

  static propTypes = {
    closeIcon: PropTypes.string,
    onCloseRequest: PropTypes.func,
  };

  static defaultProps = {
    closeIcon: 'close',
  };

  onOpen() {
    return this.refs.dlg.open();
  }

  close() {
    return this.refs.dlg.close();
  }

  toggle() {
    return this.refs.dlg.toggle();
  }

  render() {
    const { title, children, actions, closeIcon, disabledCloseButton, paddedScrollable, id, isCohort, ...rest } = this.props;
    const theTitle = typeof title === 'string' ? <Title>{title}</Title> : title;

    return (
      <Dialog ref="dlg" type="fullscreen" appendToBody data-component="fullscreen-dialog" id={id} closeOnTapAway={false} closeOnEscape={false} {...rest}>
        <DialogOverlay className={cf('fullscreen-overlay')} container={false}>
          <DialogContent>
            <DialogHeader fullscreen isCohort={isCohort}>
              <IconButton
                id={`${id || ''}_closeBtn`}
                disabled={disabledCloseButton}
                data-action="closeFullscreenDialog"
                iconName={closeIcon}
                iconStyle="light"
                onClick={this.handleClose}
              />
              {theTitle}
              {actions}
            </DialogHeader>
            <div data-component="fullscreen-content" className={cf(g({ 'padded-scrollable': paddedScrollable }))}>
              {children}
            </div>
          </DialogContent>
        </DialogOverlay>
      </Dialog>
    );
  }
}
