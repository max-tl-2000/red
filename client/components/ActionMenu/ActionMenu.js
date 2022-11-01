/*
 * Copyright (c) 2022 Reva Technology Inc., all rights reserved.
 * Unauthorized copying of this file, via any medium is strictly prohibited
 * Licensed under the Elastic License 2.0; you may not use this file except
 * in compliance with the Elastic License 2.0.
 */

import PropTypes from 'prop-types';
import React, { Component } from 'react';
import { render, unmountComponentAtNode, findDOMNode } from 'react-dom';
import $ from 'jquery';

import generateId from 'helpers/generateId';
import ActionMenuOverlay from './ActionMenuOverlay';
import ActionButton from '../ActionButton/ActionButton';
import Icon from '../Icon/Icon';

import { cf } from './ActionMenu.scss';
import { document } from '../../../common/helpers/globals';

export default class ActionMenu extends Component {
  constructor(props, context) {
    super(props, context);
    this.id = generateId(this);
    this.$doc = $(document);
  }

  state = {
    open: false,
  };

  static propTypes = {
    rightAligned: PropTypes.bool,
    overlayBoundaries: PropTypes.string, // jquery-ui position.my
    triggerBoundaries: PropTypes.string, // jquery-ui position.at
    autoClose: PropTypes.bool,
  };

  static defaultProps = {
    overlayBoundaries: 'left bottom',
    triggerBoundaries: 'left top',
    autoClose: true,
  };

  open = () => {
    if (this.state.open) {
      // already open
      return;
    }
    this.setState({
      open: true,
    });
  };

  close = () => {
    if (!this.state.open) {
      // already closed
      return;
    }
    this.setState({
      open: false,
    });
  };

  toggle = () => {
    this.setState({
      open: !this.state.open,
    });
  };

  _onAnimationDone = () => {
    const { open } = this.state;
    if (!open) {
      this.mountPoint.removeClass(cf('open'));
    }
  };

  _handleTouchOnOverlay = () => {
    const { autoClose } = this.props;
    if (autoClose) {
      this.close();
    }
  };

  relocateOverlay = () => {
    const ref = $(findDOMNode(this.refs.trigger));
    const { overlayBoundaries, triggerBoundaries } = this.props;

    setTimeout(
      () =>
        this.mountPoint.position({
          my: overlayBoundaries, // 'right top', TODO: validate this props
          at: triggerBoundaries, // 'right bottom',
          of: ref,
        }),
      16,
    );
  };

  get actionButton() {
    return findDOMNode(this.refs.trigger);
  }

  _renderOverlay() {
    let { open } = this.state;

    open = !!open;

    const { rightAligned } = this.props;

    const overlayProps = {
      isOpen: open,
      rightAligned,
      onAnimationDone: this._onAnimationDone,
    };

    render(<ActionMenuOverlay {...overlayProps}>{this.props.children}</ActionMenuOverlay>, this.mountPoint[0]);

    const mountPoint = this.mountPoint;

    if (open) {
      mountPoint.addClass(cf('open'));
      const ref = $(findDOMNode(this.refs.trigger));

      this.relocateOverlay();

      this.$doc.on(`mouseup.ns_${this.id}`, e => {
        const $target = $(e.target);

        const clickHappenInTheOverlay = $target.closest(this.mountPoint).length > 0;
        const clickHappenInTheTrigger = $target.closest(ref).length > 0;

        if (clickHappenInTheOverlay) {
          this._handleTouchOnOverlay();
          return;
        }

        if (clickHappenInTheTrigger) {
          return;
        }

        this.close();
      });

      this.$doc.on(`window:resize.ns_${this.id}`, this.relocateOverlay);
    } else {
      this.$doc.off(`.ns_${this.id}`);
    }
  }

  componentDidUpdate() {
    this._renderOverlay();
  }

  componentDidMount() {
    this.mountPoint = $(`<div class="${cf('popover')}" />`).appendTo($(findDOMNode(this.refs.trigger)).parent());
    this._renderOverlay();
    this.relocateOverlay();
  }

  componentWillUnmount() {
    unmountComponentAtNode(this.mountPoint[0]);

    this.$doc.off(`.ns_${this.id}`);

    this.mountPoint.remove();
    this.mountPoint = null;
  }

  render() {
    const props = this.props;
    const icon = props.icon;
    const btnClassName = props.btnClassName;

    const iconOpen = props.iconOpen || icon;
    const theIcon = this.state.open ? iconOpen : icon;

    return (
      <ActionButton className={btnClassName} size="large" ref="trigger" onClick={this.toggle}>
        <Icon name={theIcon} />
      </ActionButton>
    );
  }
}
