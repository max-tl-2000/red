/*
 * Copyright (c) 2022 Reva Technology Inc., all rights reserved.
 * Unauthorized copying of this file, via any medium is strictly prohibited
 * Licensed under the Elastic License 2.0; you may not use this file except
 * in compliance with the Elastic License 2.0.
 */

import PropTypes from 'prop-types';
import React, { Component } from 'react';
import { getStyleFor } from './Styles.js';
import { getMetaFromName } from '../../../../common/helpers/avatar-helpers';
import Image from '../Image/Image';

export default class Avatar extends Component {
  static propTypes = {
    id: PropTypes.string,
    userName: PropTypes.string,
    src: PropTypes.string,
  };

  render() {
    const { className, id, userName, src, style } = this.props;
    const theId = id;

    const meta = userName && getMetaFromName(userName);

    const renderAvatar = () =>
      src ? (
        <Image alt={'agent photo'} src={src} style={getStyleFor('avatar-image')} width="100%" height="100%" />
      ) : (
        <div style={getStyleFor('avatar-wrapper')}>
          <div style={getStyleFor('letters', { background: (meta && meta.color) || '#e0e0e0' })}>
            <span style={getStyleFor('letters-span')}>{(meta && meta.initials) || 'RU'}</span>
          </div>
        </div>
      );

    const avatarToReturn = (
      <div id={theId} data-component="avatar" style={getStyleFor('avatar', style)} className={className}>
        {renderAvatar()}
      </div>
    );
    return avatarToReturn;
  }
}
