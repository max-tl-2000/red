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
import { getSmallAvatar } from 'helpers/cloudinary';
import Icon from '../Icon/Icon';
import { cf, g } from './avatar.scss';
import { computeAvatarDefaultSize, getDevicePixelRatio, avatarBadgeIconStyleMapping } from '../../helpers/avatar';

export default class Avatar extends Component {
  constructor(props, context) {
    super(props, context);
    this.id = generateId(this);
    this.state = { avatarSize: null };
  }

  static propTypes = {
    id: PropTypes.string,
    userName: PropTypes.string,
    src: PropTypes.string,
    badgeIcon: PropTypes.string,
    iconName: PropTypes.string,
    imageWidth: PropTypes.number,
  };

  componentDidMount() {
    const avatarWrapper = this.avatarWrapper;
    const { imageWidth } = this.props;

    const fixedWidth = imageWidth || avatarWrapper.clientWidth || 40;

    const avatarSize = computeAvatarDefaultSize(fixedWidth);
    this.setState({ avatarSize, dpr: getDevicePixelRatio() });
  }

  renderBadgeIcon() {
    const { emptyBadge, badgeIcon, badgeClassName, badgeIconViewBox, badgeIconStyle } = this.props;
    const { fill } = badgeIconStyle || {};

    if (emptyBadge) {
      return <span />;
    }
    return <Icon name={badgeIcon} className={badgeClassName} viewBox={badgeIconViewBox} style={{ fill }} />;
  }

  render() {
    const {
      className,
      src,
      id,
      userName,
      iconName,
      emptyBadge,
      badgeIcon,
      dataId,
      style,
      circle,
      small,
      badgeIconStyle,
      isRenewalOrActiveLease = false,
    } = this.props;
    const { avatarSize, dpr } = this.state;
    const theId = clsc(id, this.id);

    const sizeClass = small ? 'small' : 'normal';

    const hasBadgeIcon = emptyBadge || badgeIcon;
    const avatarBadgeIconStyle = avatarBadgeIconStyleMapping[avatarSize] || {};

    return (
      <div
        ref={node => {
          this.avatarWrapper = node;
        }}
        id={theId}
        data-id={dataId}
        data-component="avatar"
        style={style}
        className={cf('avatar', sizeClass, g(className))}>
        {avatarSize && (
          <div className={cf('avatar-wrapper', { circle })}>
            <img
              alt="avatar"
              className={cf('avatar-image')}
              src={getSmallAvatar(src, userName, avatarSize, hasBadgeIcon, dpr, isRenewalOrActiveLease)}
              style={{ width: avatarSize, height: avatarSize }}
            />
            {iconName && <Icon name={iconName} className={cf('icon')} />}
          </div>
        )}
        {hasBadgeIcon && (
          <div data-part="badge" style={{ ...avatarBadgeIconStyle, ...badgeIconStyle }}>
            {this.renderBadgeIcon()}
          </div>
        )}
      </div>
    );
  }
}
