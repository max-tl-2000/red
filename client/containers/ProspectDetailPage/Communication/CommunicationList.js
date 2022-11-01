/*
 * Copyright (c) 2022 Reva Technology Inc., all rights reserved.
 * Unauthorized copying of this file, via any medium is strictly prohibited
 * Licensed under the Elastic License 2.0; you may not use this file except
 * in compliance with the Elastic License 2.0.
 */

import PropTypes from 'prop-types';
import React, { Component } from 'react';
import { t } from 'i18next';
import injectProps from 'helpers/injectProps';
import EmailThreadCard from 'custom-components/CommsThreadCards/EmailThreadCard';
import SmsThreadCard from 'custom-components/CommsThreadCards/SmsThreadCard';
import TelephonyThreadCard from 'custom-components/CommsThreadCards/TelephonyThreadCard';
import WebThreadCard from 'custom-components/CommsThreadCards/WebThreadCard';
import WalkInThreadCard from 'custom-components/CommsThreadCards/WalkInThreadCard';
import NoCommsCard from 'custom-components/CommsThreadCards/NoCommsCard';
import DirectMessageThreadCard from 'custom-components/CommsThreadCards/DirectMessageThreadCard';
import { Typography as T, PreloaderBlock } from 'components';
import { connect } from 'react-redux';
import { bindActionCreators } from 'redux';
import { commsReadByUser } from 'redux/modules/communication';
import { DALTypes } from 'enums/DALTypes';
import { adjustWalkinDates } from 'helpers/walkInUtils';
import { groupByThreadAndSort, getFlattenedCommPersons } from 'helpers/communications';
import { createSelector } from 'reselect';
import { getPersonsInParty } from 'redux/selectors/partySelectors';
import { EMAIL_THREAD, SMS_THREAD, INACTIVE_CALL, WEB_THREAD, WALK_IN, DIRECT_MESSAGE_THREAD } from 'helpers/comm-flyout-types';
import { locals as styles, cf } from './CommunicationList.scss';
import { getPartyTimezone } from '../../../redux/selectors/partySelectors';
import SvgCharExhaustedLight from '../../../../resources/pictographs/char-exhausted-light.svg';

const getThreads = createSelector(
  props => props.communications,
  comms => {
    const adjustedComms = adjustWalkinDates(comms);
    return groupByThreadAndSort(adjustedComms);
  },
);

@connect(
  (state, props) => ({
    threads: getThreads(props),
    currentUser: state.auth.user,
    users: state.globalStore.get('users'),
    persons: props.persons.size ? props.persons : getPersonsInParty(state, props),
    timezone: getPartyTimezone(state, props),
  }),
  dispatch => bindActionCreators({ commsReadByUser }, dispatch),
)
export default class CommunicationList extends Component {
  static propTypes = {
    communications: PropTypes.object,
    persons: PropTypes.object,
    users: PropTypes.object,
    loadPersons: PropTypes.func,
    loading: PropTypes.bool,
    onOpenCommFlyOut: PropTypes.func,
    threadToOpen: PropTypes.string,
    commsReadByUser: PropTypes.func,
  };

  openFlyoutByThread = (threadId, threads = this.props.threads) => {
    const thread = (threads || []).find(p => p.threadId === threadId) || {};
    switch (thread.type) {
      case DALTypes.CommunicationMessageType.EMAIL:
        this.handleOpenEmailThread(threadId, threads);
        break;
      case DALTypes.CommunicationMessageType.SMS:
        this.handleOpenSmsThread(threadId, threads);
        break;
      case DALTypes.CommunicationMessageType.WEB:
        this.handleOpenWebThread(threadId, threads);
        break;
      case DALTypes.CommunicationMessageType.CALL:
        this.handleOpenInactiveCallFlyout(threadId, threads);
        break;
      case DALTypes.CommunicationMessageType.DIRECT_MESSAGE:
        this.handleOpenDirectMessageThread(threadId, threads);
        break;
      default:
        break;
    }
  };

  componentDidMount() {
    const { threadToOpen, threads, party, persons } = this.props;

    if (!party) return;

    if (threadToOpen && threads.size && persons.size) {
      this.openFlyoutByThread(threadToOpen, threads);
      this.props.onThreadOpened();
      this.threadOpenedAtLeastOnce = true;
    }
  }

  componentDidUpdate(prevProps) {
    const { threadToOpen, party, threads, persons } = this.props;

    if (this.threadOpenedAtLeastOnce) return;
    const partyHasChanged = prevProps.party !== party;
    const threadsHaveChanged = prevProps.threads !== threads;
    const personsHaveChanged = prevProps.persons !== persons;

    if ((partyHasChanged || threadsHaveChanged || personsHaveChanged) && party && threads.size > 0 && persons.size > 0) {
      this.openFlyoutByThread(threadToOpen, threads);
      this.threadOpenedAtLeastOnce = true;
    }
  }

  markThreadAsRead = threadId => this.props.commsReadByUser(threadId);

  handleOpenEmailThread = (threadId, threads = this.props.threads) => {
    this.markThreadAsRead(threadId);
    const thread = threads.find(p => p.threadId === threadId);
    if (thread.comms) {
      this.props.onOpenCommFlyOut({
        flyoutType: EMAIL_THREAD,
        props: {
          type: DALTypes.CommunicationMessageType.EMAIL,
          threadId,
          associatedProperty: this.props.associatedProperty,
          timezone: this.props.timezone,
        },
      });
    }
  };

  handleOpenWebThread = (threadId, threads = this.props.threads) => {
    this.markThreadAsRead(threadId);
    const thread = threads.find(p => p.threadId === threadId);
    const participants = this.getRecipientList(thread.comms);
    const participant = participants.find(p => p.id === thread.comms[0].persons[0]);

    this.props.onOpenCommFlyOut({
      flyoutType: WEB_THREAD,
      props: {
        threadId,
        communications: thread.comms,
        participant,
        timezone: this.props.timezone,
      },
    });
  };

  handleOpenInactiveCallFlyout = (threadId, participantName) => {
    this.props.onOpenCommFlyOut({
      flyoutType: INACTIVE_CALL,
      props: {
        threadId,
        fullName: participantName,
        timezone: this.props.timezone,
      },
    });
  };

  handleOpenSmsThread = threadId => {
    const { onOpenCommFlyOut, timezone } = this.props;
    onOpenCommFlyOut({
      flyoutType: SMS_THREAD,
      props: {
        type: DALTypes.CommunicationMessageType.SMS,
        threadId,
        timezone,
      },
    });
  };

  handleOpenDirectMessageThread = threadId => {
    const { onOpenCommFlyOut, timezone } = this.props;
    onOpenCommFlyOut({
      flyoutType: DIRECT_MESSAGE_THREAD,
      props: {
        type: DALTypes.CommunicationMessageType.DIRECT_MESSAGE,
        threadId,
        timezone,
      },
    });
  };

  handleOpenWalkinThread = threadId => {
    const { onOpenCommFlyOut, persons, threads, timezone } = this.props;
    const thread = threads.find(p => p.threadId === threadId);
    const participants = this.getRecipientList(thread.comms);
    const contactEvent = thread.comms[0];

    onOpenCommFlyOut({
      flyoutType: WALK_IN,
      props: {
        type: DALTypes.CommunicationMessageType.CONTACTEVENT,
        participants,
        persons,
        threadId,
        contactEvent,
        timezone,
      },
    });
  };

  renderCommunications() {
    const { threads, timezone } = this.props;

    if (!threads || threads.size === 0) {
      return <T.Text secondary>{t('NO_MESSAGES')}</T.Text>;
    }

    return threads.valueSeq().map((msg, index) => {
      switch (msg.type) {
        case DALTypes.CommunicationMessageType.EMAIL:
          return (
            <EmailThreadCard
              id={`${index}`}
              key={msg.threadId}
              participants={this.getRecipientList(msg.comms)}
              threadId={msg.threadId}
              communications={msg.comms}
              onOpenEmailThread={this.handleOpenEmailThread}
              timezone={timezone}
            />
          );
        case DALTypes.CommunicationMessageType.SMS:
          return (
            <SmsThreadCard
              id={`${index}`}
              key={msg.threadId}
              participants={this.getRecipientList(msg.comms)}
              threadId={msg.threadId}
              communications={msg.comms}
              onOpenSmsThread={this.handleOpenSmsThread}
              timezone={timezone}
            />
          );
        case DALTypes.CommunicationMessageType.CALL:
          return (
            <TelephonyThreadCard
              key={msg.threadId}
              participants={this.getRecipientList(msg.comms)}
              communications={msg.comms}
              onOpenPhoneThread={this.handleOpenInactiveCallFlyout}
              timezone={timezone}
            />
          );
        case DALTypes.CommunicationMessageType.WEB:
          return (
            <WebThreadCard
              key={msg.threadId}
              participants={this.getRecipientList(msg.comms)}
              threadId={msg.threadId}
              communications={msg.comms}
              onOpenWebThread={this.handleOpenWebThread}
              timezone={timezone}
            />
          );
        case DALTypes.CommunicationMessageType.CONTACTEVENT:
          return (
            <WalkInThreadCard
              key={msg.threadId}
              contactEvent={msg.comms && msg.comms.length ? msg.comms[0] : {}}
              participants={this.getRecipientList(msg.comms)}
              threadId={msg.threadId}
              onOpenContactEventFlyout={this.handleOpenWalkinThread}
              timezone={timezone}
            />
          );
        case DALTypes.CommunicationMessageType.DIRECT_MESSAGE:
          return (
            <DirectMessageThreadCard
              key={msg.threadId}
              participants={this.getRecipientList(msg.comms)}
              threadId={msg.threadId}
              communications={msg.comms}
              onOpenDirectMessageThread={this.handleOpenDirectMessageThread}
              timezone={timezone}
            />
          );
        default:
          console.error('Unknown communication type');
          return <div />;
      }
    });
  }

  getRecipientList = commList => {
    const commPersons = getFlattenedCommPersons(commList);
    return this.props.persons.filter(pers => commPersons.indexOf(pers.id) >= 0);
  };

  renderCommsLoadingError = () => (
    <div className={cf('loadingError')}>
      <SvgCharExhaustedLight />
      <T.SubHeader> {t('ERROR_LOADING_COMMS')} </T.SubHeader>
      <T.Text secondary> {t('GENERIC_SUPPORT_MESSAGE')} </T.Text>
    </div>
  );

  @injectProps
  render({ loading, communications, error }) {
    if (!communications || communications.size === 0) {
      return (
        <div style={{ padding: '1.25rem' }}>
          {error && this.renderCommsLoadingError()}
          {!loading && !error && <NoCommsCard message={t('NO_COMMUNICATIONS_WITH_PARTY')} />}
          {loading && !error && <PreloaderBlock />}
        </div>
      );
    }

    return <div className={styles.containerStyle}>{this.renderCommunications()}</div>;
  }
}
