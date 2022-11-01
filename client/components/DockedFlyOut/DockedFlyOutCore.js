/*
 * Copyright (c) 2022 Reva Technology Inc., all rights reserved.
 * Unauthorized copying of this file, via any medium is strictly prohibited
 * Licensed under the Elastic License 2.0; you may not use this file except
 * in compliance with the Elastic License 2.0.
 */

import PropTypes from 'prop-types';
import React, { Component } from 'react';
import { observer } from 'mobx-react';
import generateId from 'helpers/generateId';
import clsc from 'helpers/coalescy';
import $ from 'jquery';
import {
  unstable_renderSubtreeIntoContainer, // eslint-disable-line
  unmountComponentAtNode,
} from 'react-dom';
import { cf } from './DockedFlyOut.scss';

import DockedWindow from './DockedWindow';

let $dockedContainer;
let instancesOpen = 0;

// !DEPRECATED: Do not use this component directly, instead use DockedFlyOut!
@observer
export default class DockedFlyOutCore extends Component {
  constructor(props, context) {
    super(props, context);
    this.id = generateId(this);
    this.state = {
      open: props.open,
    };
  }

  static propTypes = {
    id: PropTypes.string,
    title: PropTypes.any,
    windowIconName: PropTypes.string,
    open: PropTypes.bool,
    onCloseRequest: PropTypes.func,
  };

  static defaultProps = {
    windowIconName: 'window-maximize',
  };

  open() {
    if (this.state.open) {
      return;
    }
    instancesOpen++;
    this.safeSetState({
      open: true,
    });
  }

  get isOpen() {
    return this.state.open;
  }

  close() {
    if (!this.state.open) {
      return;
    }
    this.safeSetState({
      open: false,
    });

    instancesOpen--;
  }

  toggle() {
    const openNext = !this.state.open;
    if (openNext) {
      this.open();
    } else {
      this.close();
    }
  }

  safeSetState(...args) {
    if (!this._mounted) {
      return;
    }
    this.setState(...args);
  }

  get $dockedContainer() {
    if (!$dockedContainer) {
      $dockedContainer = $(`<div class="${cf('docked-flyout-container')}" />`).appendTo('body');
    }

    return $dockedContainer;
  }

  get $mountPoint() {
    if (!this._mountPoint) {
      this._mountPoint = $(`<div class="${cf('docked-flyout-wrapper')}" />`).appendTo(this.$dockedContainer);
    }
    return this._mountPoint;
  }

  componentDidMount() {
    this._mounted = true;
    this._renderOverlay();
  }

  componentWillUnmount() {
    this._mounted = false;
    this.close();
    this.destroy();
  }

  componentDidUpdate() {
    this._renderOverlay();
  }

  componentWillReceiveProps(nextProps) {
    if ('open' in nextProps && nextProps.open !== this.props.open) {
      if (nextProps.open) {
        this.open();
      } else {
        this.close();
      }
    }
  }

  handleClose = () => {
    const { onCloseRequest } = this.props;

    if (onCloseRequest) {
      // if onClose request is defined let the parent state control whether this is open or not
      onCloseRequest({});
      return;
    }

    this.close();
  };

  destroy() {
    if (!this._mountPoint) return;
    const THRESHOLD_TO_UNMOUNT = 100;

    // first hide the panel
    this.$mountPoint.css({ display: 'none' });

    // a few seconds later unmount it.
    // this is require to prevent an error
    // with React 15 attempting to call componentDidUpdate
    // on an already unmounted and nullified component
    setTimeout(() => {
      unmountComponentAtNode(this.$mountPoint[0]);
      this.$mountPoint.remove();
      this._mountPoint = null;
    }, THRESHOLD_TO_UNMOUNT);
  }

  _renderOverlay() {
    let { open } = this.state;
    const { id, children, title, windowIconName, style, displayHeader } = this.props;
    const theId = clsc(id, this.id);

    open = !!open;
    this.$dockedContainer.toggleClass(cf('on'), instancesOpen > 0);

    const dockedStyle = {
      ...style,
    };

    if (open) {
      unstable_renderSubtreeIntoContainer(
        this,
        <DockedWindow style={dockedStyle} id={theId} title={title} windowIconName={windowIconName} onClose={this.handleClose} displayHeader={displayHeader}>
          {children}
        </DockedWindow>,
        this.$mountPoint[0],
      );
    } else {
      this.destroy();
    }
  }

  render() {
    return <noscript />;
  }
}
