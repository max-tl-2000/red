/*
 * Copyright (c) 2022 Reva Technology Inc., all rights reserved.
 * Unauthorized copying of this file, via any medium is strictly prohibited
 * Licensed under the Elastic License 2.0; you may not use this file except
 * in compliance with the Elastic License 2.0.
 */

import PropTypes from 'prop-types';
import React, { Component } from 'react';
import { createSelector } from 'reselect';
import { connect } from 'react-redux';
import { Avatar, Typography } from 'components';
import { formatTimestamp } from 'helpers/date-utils';
import { getMostRecentCommunication, getPersonDisplayName } from 'helpers/communications';
import ellipsis from 'helpers/ellipsis';
import { t } from 'i18next';
import ParticipantsList from './ParticipantsList';
import { cf } from './CommunicationThreadCard.scss';
import { DALTypes } from '../../../common/enums/DALTypes';

const { Text, Caption, SubHeader } = Typography;

const getMostRecentComm = createSelector(
  (state, props) => props.communications,
  comms => getMostRecentCommunication(comms),
);

@connect((state, props) => ({
  currentUser: state.auth.user,
  mostRecentComm: getMostRecentComm(state, props),
}))
export default class DirectMessageThreadCard extends Component {
  static propTypes = {
    threadId: PropTypes.string,
    communications: PropTypes.array,
    onOpenDirectMessageThread: PropTypes.func,
    participants: PropTypes.object,
  };

  getNoOfMessagesInThread = commLength =>
    commLength > 1 ? (
      <SubHeader className={cf('messagesCount')} inline secondary>
        {' '}
        {`(${commLength})`}
      </SubHeader>
    ) : null;

  handleOnTouchTapMessage = () => {
    const { threadId, onOpenDirectMessageThread } = this.props;
    onOpenDirectMessageThread && onOpenDirectMessageThread(threadId);
  };

  render = () => {
    const { participants, communications, currentUser, timezone } = this.props;
    const comm = this.props.mostRecentComm;
    const { message, created_at, category } = comm;
    const participantName = getPersonDisplayName(comm.persons[0], participants);

    const messageToDisplay = () => {
      switch (category) {
        case DALTypes.PostCategory.EMERGENCY:
          return `${t('EMERGENCY')}: ${message.title}`;
        case DALTypes.PostCategory.ANNOUNCEMENT:
          return `${t('ANNOUNCEMENT')}: ${message.title}`;
        default:
          return message.text;
      }
    };

    return (
      <div data-id="directMessageThread" className={cf('container')} onClick={this.handleOnTouchTapMessage}>
        <div className={cf('avatarSection')}>
          <Avatar userName={participantName} badgeIcon={'chat'} />
        </div>
        <div className={cf('commSection')}>
          <div className={cf('cardHeader')}>
            <div className={cf('cardHeaderRow')}>
              <SubHeader className={cf('messageTitle')} inline>
                <ParticipantsList participants={participants} mostRecentComm={comm} threadComms={communications} authUserId={currentUser.id} />
                {this.getNoOfMessagesInThread(communications.length)}
              </SubHeader>
              <Caption className={cf('timeStampSection')}>{formatTimestamp(created_at, { timezone })}</Caption>
            </div>
          </div>
          <div className={cf('messageSection')}>
            <Text secondary data-id="directMessageText">
              {ellipsis(messageToDisplay(), 300)}
            </Text>
          </div>
        </div>
      </div>
    );
  };
}
