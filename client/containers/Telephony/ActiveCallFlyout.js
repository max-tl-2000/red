/*
 * Copyright (c) 2022 Reva Technology Inc., all rights reserved.
 * Unauthorized copying of this file, via any medium is strictly prohibited
 * Licensed under the Elastic License 2.0; you may not use this file except
 * in compliance with the Elastic License 2.0.
 */

import { t } from 'i18next';
import PropTypes from 'prop-types';
import React, { Component } from 'react';
import { connect } from 'react-redux';
import { bindActionCreators } from 'redux';
import * as telephonyActions from 'redux/modules/telephony';
import { hangup, mute, unmute, sendDigit } from 'helpers/telephonyProvider';
import { updateCommunicationsByCommunicationId } from 'redux/modules/communication';
import { openFlyout, closeFlyout } from 'redux/modules/flyoutStore';
import callStates from 'helpers/enums/callStates';
import notifier from 'helpers/notifier/notifier';
import { getAllTeamsFromUsers } from 'helpers/models/team';
import { INACTIVE_CALL } from 'helpers/comm-flyout-types';
import { getLeadScoreIcon } from 'helpers/leadScore';
import DialPad from 'custom-components/DialPad/DialPad';
import { RedList, Avatar, Button, TextBox, IconButton, Typography, FlyOut, FlyOutOverlay, Icon } from 'components';
import DockedFlyOut from 'components/DockedFlyOut/DockedFlyOut';
import { updateUserStatus } from 'redux/modules/usersStore';
import { observer, inject, Observer } from 'mobx-react';
import { reaction } from 'mobx';
import ForwardCallSelector from '../Dashboard/ForwardCallSelector';
import { logger } from '../../../common/client/logger';
import { DALTypes } from '../../../common/enums/DALTypes';

import { shouldDisplayViewPartyLink as shouldDisplayViewParty } from '../../helpers/telephony';
import { getUsersAndTeamsForForwardComm } from '../../../common/employee-selectors/forward-comm-selector-data';
import { cf } from './ActiveCallFlyout.scss';
import { getDisplayName } from '../../../common/helpers/person-helper';
import { toMoment } from '../../../common/helpers/moment-utils';
import { obscureObject } from '../../../common/helpers/logger-utils';

const { SubHeader, Caption, Title, Text } = Typography;

const removeRecordingUndoSeconds = 3;

@connect(
  state => ({
    comm: state.telephony.comm,
    associatedParty: state.telephony.associatedParty,
    activeCallDataLoaded: state.telephony.activeCallDataLoaded,
    commId: state.telephony.commId,
    partyId: state.telephony.partyId,
    uiStatus: state.telephony.uiStatus,
    callState: state.telephony.callState,
    failReason: state.telephony.failReason,
    microphoneMuted: state.telephony.microphoneMuted,
    contact: state.telephony.contact,
    isPhoneToPhone: state.telephony.isPhoneToPhone,
    isRemovingRecording: state.telephony.isRemovingRecording,
    currentUser: state.auth.user,
    users: state.globalStore.get('users'),
    externalPhones: state.dataStore.get('externalPhones'),
    activeCallFlyoutId: state.telephony.activeCallFlyoutId,
    callOnHoldSelected: state.telephony.callOnHoldSelected,
  }),
  dispatch =>
    bindActionCreators(
      {
        ...telephonyActions,
        updateCommunicationsByCommunicationId,
        openFlyout,
        closeFlyout,
        updateUserStatus,
      },
      dispatch,
    ),
)
@inject('leasingNavigator')
@observer
export default class ActiveCallFlyout extends Component {
  static propTypes = {
    comm: PropTypes.object,
    callState: PropTypes.string,
    microphoneMuted: PropTypes.bool,
    callOnHoldSelected: PropTypes.bool,
    contact: PropTypes.object,
    isPhoneToPhone: PropTypes.bool,
    isRemovingRecording: PropTypes.bool,
    endCallSession: PropTypes.func,
    transferCall: PropTypes.func,
    clearCallTransferStatus: PropTypes.func,
    getActiveCallData: PropTypes.func,
    users: PropTypes.object,
    currentUser: PropTypes.object,
    parties: PropTypes.object,
    partyIds: PropTypes.array,
    partyId: PropTypes.string,
    flyoutId: PropTypes.string,
    activeCallFlyoutId: PropTypes.string.isRequired,
    openFlyout: PropTypes.func,
    closeFlyout: PropTypes.func,
  };

  constructor(props) {
    super(props);
    this.state = {
      numberPadSelected: false,
      callForwardSelected: false,
      numberPadInput: '',
      counter: 0,
      notesEdited: false,
      alreadySaved: false,
      minimized: false,
      callNotes: '',
    };
  }

  componentWillMount = () => {
    this.props.loadExternalPhones();
    this.doLoadActiveCallData();
    this.setState({ ...this.getUsersForForwardSelector(this.props) });
  };

  componentDidMount = () => {
    const { callState, leasingNavigator } = this.props;
    this.mounted = true;
    callState === callStates.ONGOING && this.startCounter();

    // this will listen for changes in leasingNavigator.location object
    // which is the object that holds the location for the current url
    this.stopReaction = reaction(
      () => leasingNavigator.location,
      () => this.doLoadActiveCallData(),
    );
  };

  doLoadActiveCallData = () => {
    const { commId, partyId, getActiveCallData } = this.props;
    commId && getActiveCallData(commId, partyId);
  };

  componentWillUnmount = async () => {
    this.mounted = false;
    clearInterval(this.timer);
    this.stopReaction && this.stopReaction();

    if (!this.state.alreadySaved) {
      logger.info('Post-call ops handled on unmount');
      await this.handlePostCallOperations();
    }
  };

  componentWillReceiveProps = async nextProps => {
    if (this.mounted) this.setState({ ...this.getUsersForForwardSelector(nextProps) });

    if (nextProps.stopRecordingError && !this.props.stopRecordingError) {
      notifier.error(t('STOP_RECORDING_ERROR'));
    }

    const comm = nextProps.comm;
    if (this.mounted && comm) {
      this.setState({
        isRecorded: comm.message.isRecorded,
        recordingWasRemoved: comm.message.recordingWasRemoved,
      });
    } else if (nextProps.commId) {
      this.props.getActiveCallData(nextProps.commId, this.props.partyId);
    }
  };

  componentDidUpdate = async prevProps => {
    const { callState } = this.props;
    const callStateChanged = prevProps.callState && prevProps.callState !== callState;

    if (!callStateChanged) return;

    if (callState === callStates.NONE || callState === callStates.FAILED) {
      await this.handleCallTerminated(this.props.callState);
    } else {
      callState === callStates.ONGOING ? this.startCounter() : this.stopAndResetCounter();
    }
  };

  handlePostCallOperations = async () => {
    const { notesEdited, minimized, callNotes } = this.state;

    const delta = { message: { duration: this.formatDuration() } };
    if (notesEdited) {
      delta.message.notes = minimized ? callNotes : this.notesInput.value;
    }

    const { comm, contact, partyId } = this.props;
    if (!comm) {
      logger.warn({ contact, partyId }, 'No comm entity received');
      return;
    }
    await this.props.updateCommunicationsByCommunicationId(comm.id, delta);

    const inactiveCallFlyoutData = {
      threadId: comm.threadId,
      personId: comm.persons[0],
      fullName: getDisplayName(contact),
      focusedCommId: comm.id,
      partyId,
    };

    logger.trace({ inactiveCallFlyoutData }, 'call ended, opening inactive call flyout');
    this.props.openFlyout(INACTIVE_CALL, inactiveCallFlyoutData);
  };

  handleCallTerminated = async callState => {
    // safeguard because for an outgoing call from 'this computer'
    // we don't have the comm  untill the backend creates it and notifies
    // CPM-9158 should solve this
    const { comm, commId } = this.props;
    logger.info({ comm: obscureObject(comm), commId, callState }, 'handling call termination in active call flyout');

    if (!comm) {
      // If the call was initiated and killed immediatley from UI, it has not reached the handling on the backend,
      // so we need to set the user back to AVAILABLE on the client side
      this.props.updateUserStatus(this.props.currentUser.id, { status: DALTypes.UserStatus.AVAILABLE });
    }

    let alreadySaved = false;
    if (this.props.comm) {
      logger.info('Post-call ops handled on componentDidUpdate');
      await this.handlePostCallOperations();
      alreadySaved = true;
    }

    this.setState({ alreadySaved }, () => this.props.closeFlyout(this.props.activeCallFlyoutId));
  };

  getUsersForForwardSelector = ({ users, currentUser, associatedParty }) => {
    if (!associatedParty) return {};
    const teams = getAllTeamsFromUsers(users);
    return getUsersAndTeamsForForwardComm(users, teams, associatedParty, currentUser);
  };

  startCounter = () => {
    this.timer = setInterval(() => this.mounted && this.setState(state => ({ counter: state.counter + 1 })), 1000);
  };

  stopAndResetCounter = () => {
    clearInterval(this.timer);

    if (!this.mounted) return;

    this.setState({
      counter: 0,
    });
  };

  updateSelection = key => {
    this.setState(state => ({ [key]: !state[key] }));
  };

  formatDuration = () => {
    const { counter } = this.state;
    return toMoment(0, { parseFormat: 'HH', strict: false }).add(counter, 's').format('mm:ss');
  };

  get minMaxIcon() {
    return this.state.minimized ? 'window-restore' : 'window-minimize';
  }

  toggleMinimize = () => {
    this.setState(prevState => ({
      minimized: !prevState.minimized,
      callNotes: !prevState.minimized ? this.notesInput.value : prevState.callNotes,
    }));
  };

  renderAvatarSection = contact => {
    const badgeIcon = getLeadScoreIcon(contact.score);
    return <Avatar userName={contact.fullName} badgeIcon={badgeIcon} badgeIconStyle={{ fill: '#fff' }} />;
  };

  renderHeader = duration => {
    const { minimized } = this.state;
    const { contact, microphoneMuted, isPhoneToPhone, failReason, uiStatus, callState, callOnHoldSelected } = this.props;

    const isOngoing = callState === callStates.ONGOING;

    const getStatus = () => {
      if (callOnHoldSelected) return t('ON_HOLD');
      if (microphoneMuted) return t('MUTED');
      if (failReason) return failReason;
      return t(uiStatus.toUpperCase());
    };

    let status = getStatus();
    if (isPhoneToPhone) {
      if (isOngoing) status = `${t('PHONE-TO-PHONE')} ${status.toLowerCase()}`;
      else status = `${status} ${t('PHONE-TO-PHONE').toLowerCase()}`;
    }

    if (isOngoing) status = `${duration} ${status}`;
    else status = `${status}...`;

    const displayName = getDisplayName(contact);

    return (
      <RedList.ListItem rowStyle="mixed">
        <RedList.AvatarSection>
          {minimized && isPhoneToPhone && this.renderAvatarSection(contact)}
          {minimized && !isPhoneToPhone && (
            <IconButton id="hangup-button" iconName="phone-hangup" iconStyle="light" onClick={this.hangupOngoingCall} className={cf('end-call-minimized')} />
          )}
          {!minimized && this.renderAvatarSection(contact)}
        </RedList.AvatarSection>
        <RedList.MainSection className={cf('header-text')}>
          <SubHeader lighter>{displayName}</SubHeader>
          <Caption lighter>{status}</Caption>
        </RedList.MainSection>
        <RedList.ActionSection>
          <IconButton compact iconStyle="light" iconName={this.minMaxIcon} onClick={this.toggleMinimize} />
        </RedList.ActionSection>
      </RedList.ListItem>
    );
  };

  handleDialKeyClick = ({ symbol }) => {
    this.setState(state => ({ numberPadInput: `${state.numberPadInput}${symbol}` }));
    sendDigit(symbol);
  };

  renderDialPadFlyOutOverlay = () => (
    <FlyOutOverlay style={{ padding: 0 }}>
      <div className={cf('phone-number-wrapper')}>
        <Title>{this.state.numberPadInput}</Title>
      </div>
      <DialPad className={cf('dial-pad')} onClick={button => this.handleDialKeyClick(button)} />
    </FlyOutOverlay>
  );

  onForwardTargetSelected = target => {
    if (!target || !target.id) return;

    this.props.transferCall(this.props.comm.id, target, this.props.contact);
    this.forwardToSelector.close();
  };

  renderForwardToSelectorFlyOutOverlay = () => {
    if (!this.mounted) return <noscript />;
    const { suggestedUsers = [], suggestedTeams = [], allUsers = [], allTeams = [] } = this.state || {};
    const { externalPhones, associatedParty, commId, currentUser, activeCallDataLoaded } = this.props;
    const primaryTeamId = (associatedParty || {}).ownerTeam;

    if (activeCallDataLoaded && (!associatedParty || !primaryTeamId || (associatedParty?.userId && !suggestedUsers.length) || !externalPhones.size)) {
      logger.warn(
        { associatedParty, primaryTeamId, suggestedUsersLength: suggestedUsers.length, externalPhones, commId },
        'missing data when rendering forward call selector',
      );
    }

    return (
      <FlyOutOverlay className={cf('forward-selector')}>
        <ForwardCallSelector
          suggestedUsers={suggestedUsers}
          suggestedTeams={suggestedTeams}
          users={allUsers || []}
          teams={allTeams}
          loggedInUser={currentUser}
          externalPhones={externalPhones.toArray()}
          primaryTeamId={primaryTeamId}
          onTargetSelected={this.onForwardTargetSelected}
          placeholderText={t('FIND_MORE')}
        />
      </FlyOutOverlay>
    );
  };

  changeMicrophoneStatus = () => {
    const { microphoneMuted, handleMicrophoneMuted } = this.props;
    microphoneMuted ? unmute() : mute();
    handleMicrophoneMuted && handleMicrophoneMuted();
  };

  changeOnHoldCallStatus = () => {
    const { handleHoldCall, handleUnholdCall, callOnHoldSelected, comm } = this.props;

    !callOnHoldSelected ? handleHoldCall(comm.id) : handleUnholdCall(comm.id);
  };

  hangupOngoingCall = () => {
    hangup();
    this.props.endCallSession();
  };

  clickViewPartyHandler = () => {
    const { leasingNavigator, associatedParty } = this.props;

    leasingNavigator.navigateToParty(associatedParty.id);
  };

  removeRecording = () => {
    this.setState({ removeRecordingUndoTime: removeRecordingUndoSeconds });
    this.removeRecordingIntervalId = setInterval(() => {
      // eslint-disable-next-line react/no-access-state-in-setstate
      const removeRecordingUndoTime = this.state.removeRecordingUndoTime - 1;
      if (removeRecordingUndoTime === 0) {
        this.props.stopRecording(this.props.comm.id);
        clearInterval(this.removeRecordingIntervalId);
      }
      this.setState({ removeRecordingUndoTime });
    }, 1000);
  };

  undoRemoveRecording = () => {
    clearInterval(this.removeRecordingIntervalId);
    this.setState({ removeRecordingUndoTime: 0 });
  };

  shouldDisplayViewPartyLink = () => {
    const { associatedParty, comm, leasingNavigator } = this.props;
    return shouldDisplayViewParty(leasingNavigator.location.pathname, associatedParty, comm);
  };

  handleNotesEdited = () => this.setState({ notesEdited: true });

  renderRecordingSection = () => {
    const { isRecorded, removeRecordingUndoTime, recordingWasRemoved } = this.state;
    const { isRemovingRecording } = this.props;
    const isRecording = isRecorded && !removeRecordingUndoTime && !recordingWasRemoved && !isRemovingRecording;

    if (isRecording) {
      return (
        <div className={cf('recording-section')}>
          <Icon name="recording" className={cf('active-recording-icon')} />
          <div className={cf('recording-text')}>
            <Caption>{t('RECORDING')}</Caption>
          </div>
          <IconButton iconName="delete" onClick={this.removeRecording} />
        </div>
      );
    }

    if (removeRecordingUndoTime) {
      return (
        <div className={cf('recording-section')}>
          <Icon name="recording" />
          <div className={cf('recording-text')}>
            <Caption inline> {t('REMOVING_RECORDING_IN')} </Caption>
            <Text inline className={cf('recording-undo-time')}>
              {removeRecordingUndoTime}
            </Text>
          </div>
          <Button type="flat" btnRole="primary" label={t('UNDO')} onClick={this.undoRemoveRecording} />
        </div>
      );
    }

    if (isRemovingRecording) {
      return (
        <div className={cf('recording-section')}>
          <Icon name="recording" />
          <div className={cf('recording-text')}>
            <Caption className={cf('recording-text')}>{t('REMOVING_RECORDING')}</Caption>
          </div>
        </div>
      );
    }

    if (recordingWasRemoved) {
      return (
        <div className={cf('recording-section')}>
          <Icon name="missing-icon" />
          <div className={cf('recording-text')}>
            <Caption className={cf('recording-text')}>{t('CALL_RECORDING_REMOVED')}</Caption>
          </div>
        </div>
      );
    }

    return <noscript />;
  };

  render() {
    const { microphoneMuted, isPhoneToPhone, callOnHoldSelected } = this.props;
    const { minimized, callNotes } = this.state;

    return (
      <DockedFlyOut displayHeader={false}>
        <div className={cf('form-content', { minimized })}>
          <div className={cf('header-section')}>{this.renderHeader(this.formatDuration())}</div>
          {!minimized && (
            <Observer>
              {() =>
                this.shouldDisplayViewPartyLink() && (
                  <Button type="flat" btnRole="primary" label={t('VIEW_PARTY')} className={cf('view-party-section')} onClick={this.clickViewPartyHandler} />
                )
              }
            </Observer>
          )}
          {!minimized && this.renderRecordingSection()}
          {!minimized && (
            <TextBox
              placeholder={t('TYPE_CALL_NOTES')}
              ref={tb => (this.notesInput = tb)}
              value={callNotes}
              autoResize={false}
              underline={false}
              multiline
              onChange={this.handleNotesEdited}
              className={cf('notes-section')}
              inputClassName={cf('notes-input')}
            />
          )}
          {(!minimized && !isPhoneToPhone && (
            <div className={cf('actions-section')}>
              <IconButton
                iconName={microphoneMuted ? 'mic-off' : 'mic'}
                onClick={() => this.changeMicrophoneStatus()}
                className={cf('icon-button', { selected: microphoneMuted })}
              />
              <IconButton iconName="pause" onClick={() => this.changeOnHoldCallStatus()} className={cf('icon-button', { selected: callOnHoldSelected })} />
              <IconButton id="hangup-button" iconName="phone-hangup" iconStyle="light" onClick={this.hangupOngoingCall} className={cf('end-call')} />
              <FlyOut
                expandTo="top"
                positionArgs={{ at: 'top-5', of: '#hangup-button' }}
                onOpening={() => this.updateSelection('numberPadSelected')}
                onClosing={() => this.updateSelection('numberPadSelected')}>
                <IconButton iconName="number-pad" className={cf('icon-button', { selected: this.state.numberPadSelected })} />
                {this.renderDialPadFlyOutOverlay()}
              </FlyOut>
              <FlyOut
                ref={c => (this.forwardToSelector = c)}
                expandTo="top"
                positionArgs={{ at: 'top-5', of: '#hangup-button' }}
                onOpening={() => this.updateSelection('callForwardSelected')}
                onClosing={() => this.updateSelection('callForwardSelected')}>
                <IconButton iconName="call-forward" className={cf('icon-button', { selected: this.state.callForwardSelected })} />
                {this.renderForwardToSelectorFlyOutOverlay()}
              </FlyOut>
            </div>
          )) || <noscript />}
        </div>
      </DockedFlyOut>
    );
  }
}
