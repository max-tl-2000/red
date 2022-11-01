/*
 * Copyright (c) 2022 Reva Technology Inc., all rights reserved.
 * Unauthorized copying of this file, via any medium is strictly prohibited
 * Licensed under the Elastic License 2.0; you may not use this file except
 * in compliance with the Elastic License 2.0.
 */

import PropTypes from 'prop-types';
import React, { Component } from 'react';
import { connect } from 'react-redux';
import { openFlyout } from 'redux/modules/flyoutStore';
import newUUID from 'uuid/v4';
import { bindActionCreators } from 'redux';
import { Avatar, Typography, AudioPlayer } from 'components';
import ellipsis from 'helpers/ellipsis';
import { formatTimestamp } from 'helpers/date-utils';
import { getMostRecentCommunication, getPersonDisplayName, getAgentsInvolvedInCall } from 'helpers/communications';
import { updateCommunicationsByCommunicationId } from 'redux/modules/communication';
import intersection from 'lodash/intersection';
import ParticipantsList from './ParticipantsList';
import { cf } from './CommunicationThreadCard.scss';
const { Text, Caption, SubHeader } = Typography;

@connect(
  state => ({
    parties: state.dataStore.get('parties'),
    users: state.globalStore.get('users'),
  }),
  dispatch =>
    bindActionCreators(
      {
        openFlyout,
        updateCommunicationsByCommunicationId,
      },
      dispatch,
    ),
)
export default class TelephonyThreadCard extends Component {
  static propTypes = {
    communications: PropTypes.array,
    onOpenPhoneThread: PropTypes.func,
    participants: PropTypes.object,
    parties: PropTypes.object,
    users: PropTypes.object,
  };

  constructor(props) {
    super(props);
    this.state = {
      mostRecentComm: getMostRecentCommunication(this.props.communications),
      flyoutId: newUUID(),
    };
  }

  componentWillReceiveProps = nextProps => {
    this.setState({
      mostRecentComm: getMostRecentCommunication(nextProps.communications),
    });
  };

  handleOnTouchTapMessage = (comm, participantName) => {
    if (this.recordingPlayerClicked) {
      this.recordingPlayerClicked = false;
      return;
    }
    const { onOpenPhoneThread } = this.props;
    onOpenPhoneThread && onOpenPhoneThread(comm.threadId, participantName);
  };

  recordingPlayed = () => {
    const { mostRecentComm } = this.state;
    const delta = { message: { listened: true } };
    this.props.updateCommunicationsByCommunicationId(mostRecentComm.id, delta);
  };

  getNoOfMessagesInThread = commLength =>
    commLength > 1 ? (
      <SubHeader className={cf('messagesCount')} inline secondary>
        {' '}
        {`(${commLength})`}
      </SubHeader>
    ) : null;

  getCallType({ direction, message: { isMissed, transferredToNumber, transferredToDisplayName, isCallbackRequested }, transferredFromCommId }) {
    const isTransferred = !!transferredFromCommId;
    const isTransferredToNumber = transferredToNumber && transferredToDisplayName;
    if (isTransferred || isTransferredToNumber) return 'call-transferred';
    if (isCallbackRequested) return 'call-callback';
    if (isMissed) return 'call-missed';

    switch (direction) {
      case 'in':
        return 'call-received';
      case 'out':
        return 'call-made';
      default:
        return 'missing-icon';
    }
  }

  getInvolvedAgents = () =>
    getAgentsInvolvedInCall({
      mostRecentCall: this.state.mostRecentComm,
      calls: this.props.communications,
      parties: this.props.parties,
      users: this.props.users,
    });

  render = () => {
    const { participants, communications, timezone } = this.props;
    const comm = this.state.mostRecentComm;
    const { message, created_at } = comm;
    const participantIds = intersection(
      comm.persons,
      participants.toArray().map(f => f.id),
    );
    const participantName = getPersonDisplayName(participantIds[0], participants);

    const agentsInvolvedInCall = this.getInvolvedAgents();

    return (
      <div className={cf('container')} onClick={() => this.handleOnTouchTapMessage(comm, participantName)}>
        <div className={cf('avatarSection')}>
          <Avatar userName={participantName} badgeIcon={this.getCallType(comm)} />
        </div>
        <div className={cf('commSection')}>
          <div className={cf('cardHeader')}>
            <div className={cf('cardHeaderRow')}>
              <div className={cf('subjectWithNoOfMessages')}>
                <SubHeader className={cf('messageTitle')} inline>
                  <ParticipantsList
                    participants={participants}
                    secondaryParticipants={agentsInvolvedInCall}
                    mostRecentComm={comm}
                    threadComms={communications}
                  />
                  {this.getNoOfMessagesInThread(communications.length)}
                </SubHeader>
              </div>
              <Caption className={cf('timeStampSection')}>{formatTimestamp(created_at, { timezone })}</Caption>
            </div>
          </div>
          <div className={cf('messageSection')}>
            {message.isVoiceMail && (
              <AudioPlayer src={message.recordingUrl} onPlayed={this.recordingPlayed} onClick={() => (this.recordingPlayerClicked = true)} />
            )}
            <div>
              <Text inline className={cf('messageDuration')}>
                {message.duration}
              </Text>
              <Text inline secondary>
                {ellipsis(message.notes, 300)}
              </Text>
            </div>
          </div>
        </div>
      </div>
    );
  };
}
