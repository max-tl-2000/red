/*
 * Copyright (c) 2022 Reva Technology Inc., all rights reserved.
 * Unauthorized copying of this file, via any medium is strictly prohibited
 * Licensed under the Elastic License 2.0; you may not use this file except
 * in compliance with the Elastic License 2.0.
 */

import React, { Component } from 'react';
import { Avatar } from 'components';
import { cf } from './EmployeeCard.scss';
import { DALTypes } from '../../../common/enums/DALTypes';
import { getBadgeName } from '../../helpers/users';
import ContactCard from './ContactCard';

export default class EmployeeCard extends Component {
  renderAvatar = (employeeName, avatarUrl, showStatus, status, smallAvatar) => {
    const badgeName = getBadgeName(status);

    const extraProps = showStatus ? { badgeIcon: badgeName, className: cf('employee-avatar', badgeName) } : {};
    const imageWidth = smallAvatar ? 32 : null;
    return (
      <Avatar
        userName={employeeName}
        src={avatarUrl}
        small={smallAvatar}
        imageWidth={imageWidth}
        {...extraProps}
        badgeIconStyle={{ background: '#fff' }}
        badgeIconViewBox="2 2 20 20"
      />
    );
  };

  render() {
    const {
      title,
      employeeName,
      selected,
      nameWithMatches,
      avatarUrl,
      showStatus = false,
      status = DALTypes.UserStatus.NOT_AVAILABLE,
      smallAvatar,
      contactCardClassName,
      disabled,
    } = this.props;

    const avatar = this.renderAvatar(employeeName, avatarUrl, showStatus, status, smallAvatar);

    return (
      <ContactCard
        className={contactCardClassName}
        fullName={employeeName}
        title={title}
        selected={selected}
        nameWithMatches={nameWithMatches}
        avatar={avatar}
        withSmallAvatar={smallAvatar}
        data-id={`${employeeName.replace(/\s/g, '')}_contactCard`}
        disabled={disabled}
      />
    );
  }
}
