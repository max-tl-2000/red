/*
 * Copyright (c) 2022 Reva Technology Inc., all rights reserved.
 * Unauthorized copying of this file, via any medium is strictly prohibited
 * Licensed under the Elastic License 2.0; you may not use this file except
 * in compliance with the Elastic License 2.0.
 */

import React, { Component } from 'react';
import PropTypes from 'prop-types';
import { Card, Typography, Avatar } from 'components';
import { cf } from './NavigationHistoryCard.scss';
const { Caption, SubHeader } = Typography;

export default class NavigationHistoryCard extends Component {
  static propTypes = {
    entity: PropTypes.object,
    onClick: PropTypes.func,
  };

  renderAvatar = entity => {
    if (entity.isClosed) {
      // temp implementation; there will be a future story to replace the icon with a watermark
      return <Avatar src="/closed-party.svg" />;
    }

    return (
      <Avatar
        lighter
        bgColor="#d8d8d8"
        userName={entity.defaultGuestName}
        badgeIcon={entity.scoreIcon}
        badgeClassName={cf({
          blueBadge: entity.score,
          lightBlueBadge: !entity.score,
        })}
      />
    );
  };

  render({ entity } = this.props) {
    // This is the card for the parties as the other ones are disabled for now
    // The cards have different styles depending on the type of entity. Existing implementation was not sufficient
    return (
      <Card elevation={0} key={entity.index} className={cf('card')} onClick={entity.onClick}>
        <div className={cf('avatarSection')}>{this.renderAvatar(entity)}</div>
        <div className={cf('dataSection')}>
          <SubHeader className={cf('topRow')}>{entity.title}</SubHeader>
          <Caption secondary>{entity.firstLine}</Caption>
          <Caption secondary>{entity.secondLine}</Caption>
        </div>
        <div className={cf('timestampSection')}>
          <Caption secondary>{entity.date}</Caption>
        </div>
      </Card>
    );
  }
}
