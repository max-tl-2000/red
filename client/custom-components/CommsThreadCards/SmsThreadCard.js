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
import { getMostRecentCommunication, getPersonDisplayName, getSMSFailMessage } from 'helpers/communications';
import ellipsis from 'helpers/ellipsis';
import { getFailureNotice } from 'helpers/sms';
import Validator from 'components/Validator/Validator';
import ParticipantsList from './ParticipantsList';
import { cf } from './CommunicationThreadCard.scss';

const { Text, Caption, SubHeader } = Typography;

const getMostRecentComm = createSelector(
  (state, props) => props.communications,
  comms => getMostRecentCommunication(comms),
);

const getBounceMessage = createSelector([getMostRecentComm, (state, props) => props.participants], (communication, participants) =>
  getSMSFailMessage(communication, participants),
);

@connect((state, props) => ({
  mostRecentComm: getMostRecentComm(state, props),
  bounceMessage: getBounceMessage(state, props),
}))
export default class SmsThreadCard extends Component {
  static propTypes = {
    id: PropTypes.string,
    threadId: PropTypes.string,
    communications: PropTypes.array,
    onOpenSmsThread: PropTypes.func,
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
    const { threadId, onOpenSmsThread } = this.props;
    onOpenSmsThread && onOpenSmsThread(threadId);
  };

  render = () => {
    const { participants, communications, timezone, bounceMessage } = this.props;
    const comm = this.props.mostRecentComm;
    const { message, created_at } = comm;
    const participantName = getPersonDisplayName(comm.persons[0], participants);
    const theIndex = this.props.id;

    const failureNotice = getFailureNotice(message);

    return (
      <div id={`smsThread_${theIndex}`} className={cf('container')} onClick={this.handleOnTouchTapMessage}>
        <div className={cf('avatarSection')}>
          <Avatar userName={participantName} badgeIcon={'message-text'} />
        </div>
        <div className={cf('commSection')}>
          <div className={cf('cardHeader')}>
            <div className={cf('cardHeaderRow')}>
              <SubHeader className={cf('messageTitle')} inline>
                <ParticipantsList participants={participants} mostRecentComm={comm} threadComms={communications} />
                {this.getNoOfMessagesInThread(communications.length)}
              </SubHeader>
              <Caption className={cf('timeStampSection')}>{formatTimestamp(created_at, { timezone })}</Caption>
            </div>
            {failureNotice && (
              <Validator>
                <Caption error>{failureNotice} </Caption>
              </Validator>
            )}
            {bounceMessage && (
              <Validator>
                <Caption error>{bounceMessage} </Caption>
              </Validator>
            )}
          </div>
          <div className={cf('messageSection')}>
            <Text secondary data-id="smsText">
              {ellipsis(message.text, 300)}
            </Text>
          </div>
        </div>
      </div>
    );
  };
}
