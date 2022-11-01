/*
 * Copyright (c) 2022 Reva Technology Inc., all rights reserved.
 * Unauthorized copying of this file, via any medium is strictly prohibited
 * Licensed under the Elastic License 2.0; you may not use this file except
 * in compliance with the Elastic License 2.0.
 */

import PropTypes from 'prop-types';
import React, { Component } from 'react';
import generateId from '../../../client/helpers/generateId';
import clsc from '../../../common/helpers/coalescy';
import Icon from './Icon';
import { getMetaFromName } from '../../../common/helpers/avatar-helpers';
import createElement from './create-element';
const Text = createElement('text');
import sass from 'node-sass';
import path from 'path';

export default class Avatar extends Component {
  constructor(props, context) {
    super(props, context);
    this.id = generateId(this);
  }

  static propTypes = {
    id: PropTypes.string,
    userName: PropTypes.string,
    src: PropTypes.string,
    iconName: PropTypes.string,
    badgeIcon: PropTypes.string,
    initialsStyle: PropTypes.object,
  };

  static styles = [sass.renderSync({ file: path.resolve(__dirname, './Avatar.scss') }).css.toString(), ...Icon.styles];

  static defaultProps = {
    initialsStyle: { fontSize: '1rem' },
  };

  renderBadgeIcon() {
    const { emptyBadge, badgeIcon, badgeClassName } = this.props;

    if (emptyBadge) {
      return <span />;
    }
    return <Icon name={badgeIcon} className={badgeClassName} />;
  }

  render() {
    const { className, src, id, userName, iconName, bgColor, emptyBadge, badgeIcon, lighter, initialsStyle, testId, style } = this.props;

    const theId = clsc(id, this.id);
    const avatarUserName = userName || '?';

    const meta = getMetaFromName(avatarUserName);

    const avatarToReturn = (
      <div id={theId} data-id={testId} data-component="avatar" style={style} className={`avatar ${className}`}>
        <div className="avatar-wrapper">
          {do {
            if (src) {
              <div className="avatar-image" style={{ backgroundImage: `url(${src})` }} />;
            } else {
              <div className="letters" style={{ ...initialsStyle, background: badgeIcon ? 'rgba(0,0,0,0)' : meta.color }}>
                {badgeIcon && (
                  <svg data-part="cutted-avatar" viewBox="0 0 40 40" style={{ fill: bgColor || meta.color }}>
                    <path
                      d="M25.785,37.787c0-6.629,5.373-12.002,12.002-12.002c0.451,0,0.895,0.03,1.334,0.08C39.689,24.01,40,22.041,40,20
  C40,8.955,31.047,0,20,0S0,8.955,0,20c0,11.046,8.953,20,20,20c2.041,0,4.01-0.311,5.864-0.879
  C25.815,38.684,25.785,38.238,25.785,37.787z"
                    />
                  </svg>
                )}
                {do {
                  if (iconName) {
                    <Icon name={iconName} className="icon" />;
                  } else {
                    <Text lighter={lighter} style={{ fontSize: 7, verticalAlign: 'middle' }} inline>
                      {meta.initials}
                    </Text>;
                  }
                }}
              </div>;
            }
          }}
        </div>
        {(emptyBadge || badgeIcon) && <div data-part="badge">{this.renderBadgeIcon()}</div>}
      </div>
    );
    return avatarToReturn;
  }
}
