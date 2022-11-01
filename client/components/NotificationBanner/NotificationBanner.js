/*
 * Copyright (c) 2022 Reva Technology Inc., all rights reserved.
 * Unauthorized copying of this file, via any medium is strictly prohibited
 * Licensed under the Elastic License 2.0; you may not use this file except
 * in compliance with the Elastic License 2.0.
 */

import PropTypes from 'prop-types';
import React, { Component } from 'react';
import { VelocityComponent } from 'helpers/velocity';
import { observer } from 'mobx-react';
import { observable, action } from 'mobx';
import { cf, g } from './NotificationBanner.scss';

import * as T from '../Typography/Typography';
import * as L from '../List/RedList';
import Icon from '../Icon/Icon';
import IconButton from '../IconButton/IconButton';

@observer
export default class NotificationBanner extends Component {
  @observable
  _visible = true;

  @observable
  _dislayContent = false;

  constructor(props) {
    super(props);
    this.syncProp(props);
  }

  static propTypes = {
    id: PropTypes.string,
    className: PropTypes.string,
    content: PropTypes.oneOfType([PropTypes.string, PropTypes.func, PropTypes.element]),
    type: PropTypes.string,
    visible: PropTypes.bool,
    closeable: PropTypes.bool,
    contentWrapperStyle: PropTypes.object,
    contentWrapperClassName: PropTypes.string,
    onCloseRequest: PropTypes.func,
  };

  iconByTypes = {
    warning: 'alert',
    info: 'information',
    success: 'available',
  };

  static defaultProps = {
    type: 'warning',
    visible: true,
  };

  @action
  handleClose = () => {
    const { onCloseRequest } = this.props;

    if (onCloseRequest) {
      onCloseRequest();
      return;
    }

    this._visible = false;
  };

  syncProp(props) {
    if ('visible' in props) {
      if (props.visible !== this._visible) {
        this._visible = props.visible;
      }
    }
  }

  componentWillReceiveProps(nextProps) {
    this.syncProp(nextProps);
  }

  @action
  handleBegin = () => {
    const { _visible } = this;
    if (_visible) {
      this._dislayContent = true;
    }
  };

  @action
  handleComplete = () => {
    const { _visible, props } = this;
    if (!_visible) {
      this._dislayContent = false;

      const { onClose } = props;

      onClose && setTimeout(onClose, 0);
    }
  };

  render() {
    const { props, _visible: visible, _dislayContent } = this;
    const {
      id,
      className,
      closeable,
      content,
      type,
      contentWrapperClassName,
      contentWrapperStyle,
      onCloseRequest,
      visible: theVisible,
      onClose,
      ...rest
    } = props;

    const iconName = this.iconByTypes[type];
    let text = content;

    if (typeof text === 'string') {
      text = <T.Text raw>{content}</T.Text>;
    }

    if (typeof text === 'function') {
      text = text();
    }

    const animProps = {
      animation: {
        opacity: visible ? 1 : 0,
        transformOriginX: ['50%', '50%'],
        transformOriginY: ['50%', '50%'],
        translateY: visible ? 0 : -10,
      },
      runOnMount: true,
      easing: [250, 25],
      duration: 550,
      begin: this.handleBegin,
      complete: this.handleComplete,
    };

    return (
      <div id={id} data-component="notification-banner" {...rest}>
        <VelocityComponent {...animProps}>
          <div style={{ opacity: 0, transform: 'translateY(-10px)' }}>
            {_dislayContent && (
              <div className={cf('NotificationBanner', type, g(contentWrapperClassName))} style={contentWrapperStyle}>
                <L.ListItem hoverable={false} clickable={false}>
                  {iconName && (
                    <L.AvatarSection>
                      <Icon name={iconName} className={cf('icon')} />
                    </L.AvatarSection>
                  )}
                  <L.MainSection>{text}</L.MainSection>
                  {closeable && (
                    <L.ActionSection>
                      <IconButton
                        iconStyle="light"
                        iconName="close"
                        className={cf('iconClose')}
                        onClick={this.handleClose}
                        iconProps={{ style: { width: '1.25rem' } }}
                      />
                    </L.ActionSection>
                  )}
                </L.ListItem>
              </div>
            )}
          </div>
        </VelocityComponent>
      </div>
    );
  }
}
