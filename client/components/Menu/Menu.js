/*
 * Copyright (c) 2022 Reva Technology Inc., all rights reserved.
 * Unauthorized copying of this file, via any medium is strictly prohibited
 * Licensed under the Elastic License 2.0; you may not use this file except
 * in compliance with the Elastic License 2.0.
 */

import PropTypes from 'prop-types';
import React, { Component } from 'react';
import $ from 'jquery';
import clsc from 'helpers/coalescy';
import generateId from 'helpers/generateId';
import FlyOut from '../FlyOut/FlyOut';
import FlyOutOverlay from '../FlyOut/FlyOutOverlay';
import List from '../List/List';

export default class Menu extends Component {
  static propTypes = {
    id: PropTypes.string,
    menuListClassName: PropTypes.string,
    iconClassName: PropTypes.string,
    iconName: PropTypes.string,
    iconStyle: PropTypes.string,
    trigger: PropTypes.object,
    expandTo: PropTypes.string,
    positionArgs: PropTypes.object,
    buttonStyle: PropTypes.object,
    menuListStyle: PropTypes.object,
    appendToBody: PropTypes.bool,
  };

  static defaultProps = {
    expandTo: 'bottom-right',
    positionArgs: {
      my: 'right top',
      at: 'right top',
    },
  };

  constructor(props) {
    super(props);
    this.id = generateId(this);
  }

  raiseSelect = e => {
    const { onSelect, onCloseRequest } = this.props;

    const $item = $(e.target).closest('[data-menu-item="true"]');
    if ($item.length > 0) {
      if ($item.attr('data-disabled') === 'true') {
        onCloseRequest && onCloseRequest({ source: 'clickOnDisabledItem' });
        // do not consider disabled items
        return;
      }

      const args = {
        autoClose: true,
        closeMenu: () => onCloseRequest && onCloseRequest({ source: 'closeMenu' }),
        action: $item.attr('data-action'),
        $item,
      };

      onSelect && onSelect(args);

      if (args.autoClose) {
        onCloseRequest && onCloseRequest({ source: 'autoClose' });
      }
    }
  };

  render() {
    const {
      id,
      children,
      expandTo,
      positionArgs,
      onCloseRequest,
      open,
      trigger,
      noAutoBind,
      menuListClassName,
      menuListStyle,
      skipInitialRenderingIfClosed,
      ...rest
    } = this.props;

    const style = {
      whiteSpace: 'nowrap',
      minWidth: 170, // as requested by Ityam
      ...menuListStyle,
    };

    const theId = clsc(id, this.id);
    return (
      <FlyOut
        id={theId}
        open={open}
        onCloseRequest={onCloseRequest}
        expandTo={expandTo}
        noAutoBind={noAutoBind}
        positionArgs={positionArgs}
        skipInitialRenderingIfClosed={skipInitialRenderingIfClosed}
        {...rest}>
        {trigger}
        <FlyOutOverlay id={theId} lazy container={false} elevation={2}>
          <List id={`${theId}_optionList`} style={style} className={menuListClassName} onClick={this.raiseSelect}>
            {children}
          </List>
        </FlyOutOverlay>
      </FlyOut>
    );
  }
}
