/*
 * Copyright (c) 2022 Reva Technology Inc., all rights reserved.
 * Unauthorized copying of this file, via any medium is strictly prohibited
 * Licensed under the Elastic License 2.0; you may not use this file except
 * in compliance with the Elastic License 2.0.
 */

import PropTypes from 'prop-types';
import React, { Component } from 'react';
import generateId from 'helpers/generateId';
import IconButton from '../IconButton/IconButton';
import Menu from '../Menu/Menu';

export default class CardMenu extends Component {
  static propTypes = {
    menuListClassName: PropTypes.string,
    iconClassName: PropTypes.string,
    iconName: PropTypes.string,
    iconStyle: PropTypes.string,
    trigger: PropTypes.object,
    expandTo: PropTypes.string,
    positionArgs: PropTypes.object,
    buttonStyle: PropTypes.object,
    noAutoBind: PropTypes.bool,
    onSelect: PropTypes.func,
    appendToBody: PropTypes.bool,
    matchTriggerSize: PropTypes.bool,
    id: PropTypes.string,
  };

  static defaultProps = {
    noAutoBind: true,
    expandTo: 'bottom-left',
    positionArgs: {
      my: 'right top',
      at: 'right top',
    },
  };

  constructor(props) {
    super(props);
    this.id = generateId(this);
    this.state = {};
  }

  open() {
    if (this.state.open) {
      return;
    }
    this.setState({ open: true });
  }

  close() {
    if (!this.state.open) {
      return;
    }
    this.setState({ open: false });
  }

  toggle() {
    if (this.state.open) {
      this.close();
    } else {
      this.open();
    }
  }

  render() {
    const {
      children,
      id,
      expandTo,
      positionArgs,
      buttonStyle,
      trigger,
      iconStyle,
      iconName,
      noAutoBind,
      iconClassName,
      menuListClassName,
      onSelect,
      menuListStyle,
      appendToBody,
      skipInitialRenderingIfClosed,
      disabled,
      triggerProps = {},
      matchTriggerSize = false,
    } = this.props;

    let triggerC = trigger;

    if (!triggerC) {
      triggerC = (
        <IconButton
          data-id={id}
          data-component="card-menu"
          onClick={() => this.setState({ open: true })}
          iconName={iconName}
          disabled={disabled}
          className={iconClassName}
          iconStyle={iconStyle}
          style={buttonStyle}
          {...triggerProps}
        />
      );
    }

    const { open } = this.state;

    return (
      <Menu
        id={id}
        appendToBody={appendToBody}
        matchTriggerSize={matchTriggerSize}
        skipInitialRenderingIfClosed={skipInitialRenderingIfClosed}
        open={open}
        expandTo={expandTo}
        noAutoBind={noAutoBind}
        positionArgs={positionArgs}
        menuListClassName={menuListClassName}
        menuListStyle={menuListStyle}
        onSelect={onSelect}
        onCloseRequest={() => this.setState({ open: false })}
        trigger={triggerC}>
        {children}
      </Menu>
    );
  }
}
