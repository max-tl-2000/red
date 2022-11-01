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
import { getPersonDisplayName, getWebInquiryHeaderFromComm, getMostRecentCommunication, isWebInquiry, getWebInquiryDescription } from 'helpers/communications';
import ParticipantsList from './ParticipantsList';
import { cf } from './CommunicationThreadCard.scss';

const { Text, Caption, SubHeader } = Typography;

export default class WebThreadCard extends Component {
  static propTypes = {
    threadId: PropTypes.string,
    communications: PropTypes.array,
    onOpenWebThread: PropTypes.func,
    participants: PropTypes.object,
  };

  constructor(props) {
    super(props);
    this.state = {
      mostRecentComm: getMostRecentCommunication(props.communications) || {},
    };
  }

  componentWillReceiveProps(nextProps) {
    this.setState({
      mostRecentComm: getMostRecentCommunication(nextProps.communications) || {},
    });
  }

  handleOnTouchTapMessage = () => {
    const { onOpenWebThread, threadId } = this.props;
    onOpenWebThread && onOpenWebThread(threadId);
  };

  getSubject = comm => {
    const subject = getWebInquiryHeaderFromComm(comm);
    return (
      <SubHeader bold={comm.unread} className={cf('messageTitle')}>
        {subject}
      </SubHeader>
    );
  };

  render() {
    const { participants, communications, timezone } = this.props;
    const mostRecentComm = this.state.mostRecentComm;
    const participantName = getPersonDisplayName(communications[0].persons[0], participants);

    return (
      <div data-id="webThread" className={cf('container')} onClick={this.handleOnTouchTapMessage}>
        <div className={cf('avatarSection')}>
          <Avatar userName={participantName} badgeIcon={'web'} />
        </div>
        <div className={cf('commSection')}>
          <div className={cf('cardHeader')}>
            <div className={cf('cardHeaderRow')}>
              {this.getSubject(mostRecentComm)}
              <Caption className={cf('timeStampSection')}>{formatTimestamp(mostRecentComm.created_at, { timezone })}</Caption>
            </div>
            <Caption className={cf('cardHeaderRow')}>
              <ParticipantsList participants={participants} mostRecentComm={communications[0]} threadComms={communications} />
            </Caption>
          </div>
          {mostRecentComm?.category && isWebInquiry(mostRecentComm) && (
            <div className={cf('messageSection')}>
              <Text secondary>{getWebInquiryDescription(mostRecentComm, this.props.timezone)}</Text>
            </div>
          )}
        </div>
      </div>
    );
  }
}
