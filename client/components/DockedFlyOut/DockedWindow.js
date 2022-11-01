/*
 * Copyright (c) 2022 Reva Technology Inc., all rights reserved.
 * Unauthorized copying of this file, via any medium is strictly prohibited
 * Licensed under the Elastic License 2.0; you may not use this file except
 * in compliance with the Elastic License 2.0.
 */

import PropTypes from 'prop-types';
import React, { Component } from 'react';
import generateId from 'helpers/generateId';
import clsc from 'helpers/coalescy';
import typeOf from 'helpers/type-of';
import elevationShadow from 'helpers/elevationShadow';
import { observer } from 'mobx-react';
import { cf, g } from './DockedFlyOut.scss';
import Icon from '../Icon/Icon';
import IconButton from '../IconButton/IconButton';
import Text from '../Typography/Text';

@observer
export default class DockedWindow extends Component {
  constructor(props, context) {
    super(props, context);
    this.id = generateId(this);
  }

  state = {
    minimized: false,
  };

  static propTypes = {
    id: PropTypes.string,
    windowIconName: PropTypes.string,
    title: PropTypes.any,
    displayHeader: PropTypes.bool,
  };

  static defaultProps = {
    windowIconName: 'window-maximize',
    displayHeader: true,
  };

  toggleMinimize = () => {
    this.setState({
      minimized: !this.state.minimized,
    });
  };

  maximizeIfNecessary = () => {
    if (this.state.minimized) {
      this.setState({
        minimized: !this.state.minimized,
      });
    }
  };

  _iconByState() {
    return this.state.minimized ? 'window-restore' : 'window-minimize';
  }

  render() {
    const { className, children, onClose, displayHeader, windowIconName, dataId } = this.props;
    let { id, title, style } = this.props;

    const { minimized } = this.state;

    if (typeOf(title) === 'string') {
      title = (
        <Text bold lighter>
          {title}
        </Text>
      );
    }

    id = clsc(id, this.id);

    style = {
      ...style,
      boxShadow: elevationShadow(8),
    };

    return (
      <div id={id} data-id={dataId} className={cf('docked-window', g(className))} style={style}>
        {displayHeader && (
          <div className={cf('window-header')}>
            <div className={cf('icon-section')} onClick={this.toggleMinimize}>
              <Icon iconStyle="light" name={windowIconName} />
            </div>
            <div className={cf('main-section')} onClick={this.toggleMinimize}>
              <div className={cf('title-section')}>{title}</div>
            </div>
            <div className={cf('controls-section')}>
              <IconButton compact iconStyle="light" iconName={this._iconByState()} onClick={this.toggleMinimize} />
              <IconButton compact iconStyle="light" iconName="close" onClick={() => onClose(true, this.maximizeIfNecessary)} />
            </div>
          </div>
        )}
        <div
          className={cf({
            'window-content': !minimized,
            'window-minimized': minimized,
          })}>
          {children}
        </div>
      </div>
    );
  }
}
