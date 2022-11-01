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
import { Avatar, Typography, Icon } from 'components';
import Validator from 'components/Validator/Validator';
import { formatTimestamp } from 'helpers/date-utils';
import { parseMessage } from 'helpers/parse-message';
import ellipsis from 'helpers/ellipsis';
import { getMostRecentCommunication, getPersonDisplayName, getEmailBounceMessage, isLastCommUnreadByUser, getCommHeaderPrefix } from 'helpers/communications';
import ParticipantsList from './ParticipantsList';
import { cf } from './CommunicationThreadCard.scss';

const { Caption, SubHeader, Text } = Typography;

const getMostRecentComm = createSelector(
  (state, props) => props.communications,
  comms => getMostRecentCommunication(comms),
);

const getBounceMessage = createSelector([getMostRecentComm, (state, props) => props.participants], (communication, participants) =>
  getEmailBounceMessage(communication, participants),
);

@connect((state, props) => ({
  currentUser: state.auth.user,
  mostRecentComm: getMostRecentComm(state, props),
  bounceMessage: getBounceMessage(state, props),
}))
export default class EmailThreadCard extends Component {
  static propTypes = {
    id: PropTypes.string,
    threadId: PropTypes.string,
    communications: PropTypes.array,
    onOpenEmailThread: PropTypes.func,
    participants: PropTypes.object,
  };

  handleOnTouchTapMessage = () => {
    const { onOpenEmailThread } = this.props;
    onOpenEmailThread && onOpenEmailThread(this.props.threadId);
  };

  getNoOfMessagesInThread = commLength =>
    commLength > 1 ? (
      <SubHeader className={cf('messagesCount')} inline secondary>
        {' '}
        {`(${commLength})`}
      </SubHeader>
    ) : null;

  getMessageSubject = (message, communications = {}, prefix) => {
    const { currentUser } = this.props;
    if (!currentUser) {
      return null; // no need to render anything if the user is not logged in
    }
    const isUnread = isLastCommUnreadByUser(communications);
    const subject = prefix ? `${prefix}${message.subject}` : message.subject;
    return (
      <SubHeader className={cf('messageTitle')} bold={isUnread}>
        {subject} {this.getNoOfMessagesInThread(communications.length)}
      </SubHeader>
    );
  };

  render = () => {
    const { participants, communications, bounceMessage, timezone } = this.props;
    const comm = this.props.mostRecentComm;
    const { message, created_at } = comm;
    const theIndex = this.props.id;

    const participantName = getPersonDisplayName(comm.persons[0], participants);

    const showAttachmentIcon = communications.some(c => c.message.files && c.message.files.length);

    const { text } = parseMessage(message);
    const headerPrefix = getCommHeaderPrefix(message);

    return (
      <div id={`emailThreadCard_${theIndex}`} className={cf('container')} onClick={this.handleOnTouchTapMessage}>
        <div className={cf('avatarSection')}>
          <Avatar userName={participantName} badgeIcon={'email'} />
        </div>
        <div className={cf('commSection')}>
          <div className={cf('cardHeader')}>
            <div className={cf('cardHeaderRow')}>
              <div data-id={`emailThreadSubject_${theIndex}`} className={cf('subjectWithNoOfMessages')}>
                {this.getMessageSubject(message, communications, headerPrefix)}
              </div>
              <Caption className={cf('timeStampSection')}>{formatTimestamp(created_at, { timezone })}</Caption>
            </div>
            <div className={cf('cardHeaderRow')}>
              <Caption style={{ marginBottom: '.5rem' }}>
                <ParticipantsList participants={participants} mostRecentComm={comm} threadComms={communications} id={theIndex} />
              </Caption>
              {showAttachmentIcon && <Icon name="attachment" className={cf('attachment-icon')} />}
            </div>
            {!!bounceMessage && (
              <Validator>
                <Caption error>{bounceMessage} </Caption>
              </Validator>
            )}
          </div>
          <div className={cf('messageSection')}>
            <Text>{ellipsis(text, 300)}</Text>
          </div>
        </div>
      </div>
    );
  };
}
