/*
 * Copyright (c) 2022 Reva Technology Inc., all rights reserved.
 * Unauthorized copying of this file, via any medium is strictly prohibited
 * Licensed under the Elastic License 2.0; you may not use this file except
 * in compliance with the Elastic License 2.0.
 */

import React, { Component } from 'react';

import { Typography, Avatar, RedList } from 'components';
import { t } from 'i18next';
import PropTypes from 'prop-types';

import { getBadgeName } from '../../helpers/users';
import { cf } from './AgentStatusCard.scss';
import { DALTypes } from '../../../common/enums/DALTypes';
import AgentCallDuration from './AgentCallDuration';
const { Text } = Typography;
const { ListItem, AvatarSection, MainSection } = RedList;

export default class AgentStatusCard extends Component {
  static propTypes = {
    employeeFullName: PropTypes.string.isRequired,
    title: PropTypes.string,
    avatarUrl: PropTypes.string.isRequired,
    metadata: PropTypes.shape({
      status: PropTypes.string.isRequired,
      statusUpdatedAt: PropTypes.string,
    }),
  };

  renderAvatar = (employeeFullName, avatarUrl, status) => {
    const badgeName = getBadgeName(status);
    const imageWidth = 32;
    return (
      <Avatar
        userName={employeeFullName}
        src={avatarUrl}
        small
        imageWidth={imageWidth}
        badgeIconStyle={{ background: '#fff' }}
        badgeIconViewBox="2 2 20 20"
        badgeIcon={badgeName}
        className={cf('avatar', badgeName)}
      />
    );
  };

  get header() {
    const { employeeFullName, metadata } = this.props;
    const { status } = metadata || {};

    const mapStatusTokens = {
      [DALTypes.UserStatus.AVAILABLE]: 'IS_AVAILABLE',
      [DALTypes.UserStatus.BUSY]: 'IS_BUSY_ON_CALL',
      [DALTypes.UserStatus.NOT_AVAILABLE]: 'IS_UNAVAILABLE',
    };

    return t(mapStatusTokens[status], { employeeFullName });
  }

  render() {
    const { employeeFullName, avatarUrl, metadata } = this.props;
    const { status, statusUpdatedAt } = metadata || {};

    const avatar = this.renderAvatar(employeeFullName, avatarUrl, status);

    return (
      <ListItem rowStyle="mixed" hoverable={false} clickable={false}>
        <AvatarSection className={cf('avatarSection')}>{avatar}</AvatarSection>
        <MainSection className={cf('mainSection')}>
          <Text>{this.header}</Text>
          {status === DALTypes.UserStatus.BUSY && <AgentCallDuration statusUpdatedAt={statusUpdatedAt} />}
        </MainSection>
      </ListItem>
    );
  }
}
