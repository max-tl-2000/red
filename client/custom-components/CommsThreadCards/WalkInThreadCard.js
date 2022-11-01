/*
 * Copyright (c) 2022 Reva Technology Inc., all rights reserved.
 * Unauthorized copying of this file, via any medium is strictly prohibited
 * Licensed under the Elastic License 2.0; you may not use this file except
 * in compliance with the Elastic License 2.0.
 */

import PropTypes from 'prop-types';
import React, { Component } from 'react';
import { Avatar, Typography } from 'components';
import { formatTimestamp } from 'helpers/date-utils';
import ellipsis from 'helpers/ellipsis';
import { cf } from './CommunicationThreadCard.scss';
import { getContactEventTypes } from '../../../common/helpers/contactEventTypes';
import { getDisplayName } from '../../../common/helpers/person-helper';

const { Text, Caption } = Typography;

export default class WalkInThreadCard extends Component {
  static propTypes = {
    threadId: PropTypes.string,
    contactEvent: PropTypes.object,
    participants: PropTypes.object,
    onOpenContactEventFlyout: PropTypes.func,
  };

  handleOnTouchTapMessage = () => {
    this.props.onOpenContactEventFlyout && this.props.onOpenContactEventFlyout(this.props.threadId);
  };

  getAvatarUserName = participants => {
    const participantsArray = participants.toArray();
    return participantsArray.length ? participantsArray[0].fullName : '';
  };

  render() {
    const { participants, contactEvent, timezone } = this.props;
    const { message, created_at } = contactEvent;
    const cardTitle = (getContactEventTypes().find(e => e.id === message.type) || {}).text || '--';

    return (
      <div className={cf('container')} onClick={this.handleOnTouchTapMessage}>
        <div className={cf('avatarSection')}>
          <Avatar userName={this.getAvatarUserName(participants)} badgeIcon={'calendar-text'} />
        </div>
        <div className={cf('commSection')}>
          <div className={cf('cardHeader')}>
            <div className={cf('cardHeaderRow')}>
              {cardTitle}
              <Caption className={cf('timeStampSection')}>{formatTimestamp(created_at, { timezone })}</Caption>
            </div>
            <Caption className={cf('cardHeaderRow')}>
              <span>{participants.map(p => getDisplayName(p)).join(', ')}</span>
            </Caption>
          </div>
          <div className={cf('messageSection')}>{<Text secondary>{ellipsis(message.text, 300)}</Text>}</div>
        </div>
      </div>
    );
  }
}
