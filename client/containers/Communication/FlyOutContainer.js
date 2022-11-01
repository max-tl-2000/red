/*
 * Copyright (c) 2022 Reva Technology Inc., all rights reserved.
 * Unauthorized copying of this file, via any medium is strictly prohibited
 * Licensed under the Elastic License 2.0; you may not use this file except
 * in compliance with the Elastic License 2.0.
 */

import { t } from 'i18next';
import Immutable from 'immutable';
import PropTypes from 'prop-types';
import React, { Component } from 'react';
import { bindActionCreators } from 'redux';
import { connect } from 'react-redux';
import {
  NEW_EMAIL,
  NEW_CALL,
  EMAIL_THREAD,
  SMS_THREAD,
  INACTIVE_CALL,
  ACTIVE_CALL,
  WEB_THREAD,
  WALK_IN,
  DIRECT_MESSAGE_THREAD,
} from 'helpers/comm-flyout-types';
import { createPhoneContactGroupsFromPartyMembers } from 'helpers/contacts';
import { sendMessage, sendCommunication } from 'redux/modules/communication';
import { saveCommunicationDraft, deleteCommunicationDraft } from 'redux/modules/communicationDraftStore';
import { deleteDocument } from 'redux/modules/documents';
import { openFlyout, clear } from 'redux/modules/flyoutStore';
import { markContactAsSpam } from 'redux/modules/blacklistStore';
import { sendQuoteMail } from 'redux/modules/quotes';
import { hidePlivoConnectionDialogError } from 'redux/modules/telephony';
import callStates from 'helpers/enums/callStates';
import { GenericFlyOutContainer, Typography as T, MsgBox } from 'components';
import { logger } from '../../../common/client/logger';
import { telephonyDisconnectedReasons } from '../../../common/enums/enums';
import { windowOpen } from '../../helpers/win-open';
import { window } from '../../../common/helpers/globals';

import SmsThreadFlyOut from './SmsThreadFlyOut';
import EmailFlyout from './EmailFlyout';
import EmailThreadFlyOut from './EmailThreadFlyOut';
import NewCallFlyOut from '../Telephony/NewCallFlyOut';
import WebThreadFlyout from './WebThreadFlyout';
import InactiveCallFlyout from '../Telephony/InactiveCallFlyout';
import ActiveCallFlyout from '../Telephony/ActiveCallFlyout';
import DirectMessageThreadFlyOut from './DirectMessageThreadFlyOut';

import WalkinThreadFlyOut from './WalkinThreadFlyOut';

@connect(
  state => ({
    currentUser: state.auth.user,
    userToken: state.auth.token,
    allPartyMembers: state.dataStore.get('members'),
    allInactiveMembers: state.dataStore.get('inactiveMembers'),
    allPersons: state.dataStore.get('persons'),
    allCommunications: state.dataStore.get('communications'),
    users: state.globalStore.get('users'),
    openedFlyouts: state.flyoutStore.openedFlyouts,
    callState: state.telephony.callState,
    activeCallFlyoutId: state.telephony.activeCallFlyoutId,
    isPlivoConnectionError: state.telephony.isPlivoConnectionError,
    plivoConnectionErrorReason: state.telephony.plivoConnectionErrorReason,
    showPlivoConnectionErrorDialog: state.telephony.showPlivoConnectionErrorDialog,
  }),
  dispatch =>
    bindActionCreators(
      {
        sendMessage,
        sendCommunication,
        sendQuoteMail,
        saveCommunicationDraft,
        deleteCommunicationDraft,
        openFlyout,
        clear,
        markContactAsSpam,
        deleteDocument,
        hidePlivoConnectionDialogError,
      },
      dispatch,
    ),
)
export default class FlyOutContainer extends Component {
  static propTypes = {
    currentUser: PropTypes.object,
    allPartyMembers: PropTypes.object,
    allInactiveMembers: PropTypes.object,
    allPersons: PropTypes.object,
    allCommunications: PropTypes.object,
    users: PropTypes.object,
    openedFlyouts: PropTypes.object,
    sendMessage: PropTypes.func,
    sendCommunication: PropTypes.func,
    openFlyout: PropTypes.func,
    clear: PropTypes.func,
    markContactAsSpam: PropTypes.func,
    callState: PropTypes.string,
    activeCallFlyoutId: PropTypes.string.isRequired,
  };

  componentWillReceiveProps(nextProps) {
    this.handleCallStateTransition(nextProps);
  }

  handleCallStateTransition = nextProps => {
    const nextCallState = nextProps.callState;
    const prevCallState = this.props.callState;
    if (nextCallState === prevCallState) return;

    const isNewOutgoingCall = nextCallState === callStates.OUTGOING;

    const isNewIncomingCall = prevCallState !== callStates.OUTGOING && nextCallState === callStates.ONGOING;

    if (isNewIncomingCall || isNewOutgoingCall) {
      this.props.openFlyout(ACTIVE_CALL, {
        flyoutId: this.props.activeCallFlyoutId,
      });
    }
  };

  componentWillUnmount() {
    this.props.clear();
  }

  getPartyMembers = partyId => {
    if (!partyId) return new Immutable.Map();

    const { allPartyMembers, allPersons } = this.props;

    return allPartyMembers
      .filter(p => p.partyId === partyId)
      .map(p => ({
        ...p,
        person: allPersons.get(p.personId),
      }));
  };

  getInactivePartyMembers = partyId => this.props.allInactiveMembers.filter(p => p.partyId === partyId);

  getPersons = (partyId, partyMembers) => {
    if (!partyId) return new Immutable.Map();

    const { allPersons } = this.props;
    const inactivePartyMembers = this.getInactivePartyMembers(partyId);
    const partyMembersIncludingInactive = partyMembers.merge(inactivePartyMembers);

    return allPersons.filter(pers => partyMembersIncludingInactive.find(pm => pm.personId === pers.id));
  };

  getCommunications = partyId => this.props.allCommunications.filter(c => c.parties.includes(partyId));

  warningDialogForPlivoConnectionError = () => {
    const { isPlivoConnectionError, plivoConnectionErrorReason, showPlivoConnectionErrorDialog } = this.props;
    if (!isPlivoConnectionError || !showPlivoConnectionErrorDialog) return <div />;

    let msgBoxOptions;
    let description;

    switch (plivoConnectionErrorReason) {
      case telephonyDisconnectedReasons.USER_REFUSED_MIC_ACCESS: {
        msgBoxOptions = {
          open: showPlivoConnectionErrorDialog,
          title: t('ENABLE_MICROPHONE_PERMISSIONS_TITLE'),
          lblOK: t('VIEW_INSTRUCTIONS'),
          lblCancel: t('OK_GOT_IT'),
          onOKClick: () => {
            const urlConfigureChromeReva = 'https://reva.zendesk.com/hc/en-us/articles/360038825013-Configuring-Chrome-for-Reva';
            windowOpen(urlConfigureChromeReva, '_blank');
            this.props.hidePlivoConnectionDialogError();
          },
          onCloseRequest: () => this.props.hidePlivoConnectionDialogError(),
        };
        description = t('ENABLE_MICROPHONE_PERMISSIONS_DESCRIPTION');
        break;
      }
      case telephonyDisconnectedReasons.NO_INTERNET_CONNECTION: {
        msgBoxOptions = {
          open: showPlivoConnectionErrorDialog,
          title: t('NO_INTERNET_CONNECTION_TITLE'),
          lblOK: t('OK_GOT_IT'),
          lblCancel: '',
          onOKClick: () => this.props.hidePlivoConnectionDialogError(),
          onCloseRequest: () => this.props.hidePlivoConnectionDialogError(),
        };
        description = t('NO_INTERNET_CONNECTION_DESCRIPTION');
        break;
      }
      default: {
        msgBoxOptions = {
          open: showPlivoConnectionErrorDialog,
          title: t('PHONE_CONNECTION_WAS_INTERRUPTED_TITLE'),
          lblOK: t('RELOAD_ACTION_LABEL'),
          lblCancel: '',
          onOKClick: () => {
            window.location.reload(true);
            this.props.hidePlivoConnectionDialogError();
          },
          onCloseRequest: () => this.props.hidePlivoConnectionDialogError(),
        };
        description = t('PHONE_CONNECTION_WAS_INTERRUPTED_DESCRIPTION');
        break;
      }
    }

    return (
      <MsgBox {...msgBoxOptions}>
        <T.Text>{description}</T.Text>
      </MsgBox>
    );
  };

  renderFlyoutType = ({ flyoutType, flyoutProps = {}, flyoutId }) => {
    const { users, currentUser, userToken } = this.props;
    const { partyId, personId, partyMembers: partyMembersProp, associatedProperty: assignedPropertyName } = flyoutProps;
    const members = this.getPartyMembers(partyId);
    const partyMembers = partyMembersProp || members;
    const persons = this.getPersons(partyId, partyMembers);
    const communications = this.getCommunications(partyId);

    switch (flyoutType) {
      case NEW_EMAIL: {
        return (
          <EmailFlyout
            flyoutId={flyoutId}
            partyId={partyId}
            assignedProperty={assignedPropertyName}
            sendMethod={this.props.sendMessage} // TODO: Use sendCommunication when all the templates are ready
            sendQuoteMail={this.props.sendQuoteMail}
            saveDraft={this.props.saveCommunicationDraft}
            deleteDraft={this.props.deleteCommunicationDraft}
            draft={this.props.draft}
            guests={(flyoutProps && flyoutProps.recipients) || persons}
            partyMembers={partyMembers}
            persons={persons}
            deleteAttachments={this.props.deleteDocument}
            {...flyoutProps}
          />
        );
      }
      case SMS_THREAD: {
        const { threadId, communications: receivedComms, ...rest } = flyoutProps;
        const comms = partyId ? receivedComms || communications : this.props.allCommunications.filter(c => c.threadId === flyoutProps.threadId);
        const personsForComms = flyoutProps.personId ? this.props.allPersons.filter(p => p.id === flyoutProps.personId) : persons;
        return (
          <SmsThreadFlyOut
            flyoutId={flyoutId}
            partyId={partyId}
            threadId={threadId}
            communications={comms}
            sendQuoteMail={this.props.sendQuoteMail} // TODO: Delete this when all the templates are ready
            partyMembers={partyMembers}
            persons={personsForComms}
            currentUser={currentUser}
            users={users}
            onMarkAsSpam={this.props.markContactAsSpam}
            saveDraft={this.props.saveCommunicationDraft}
            deleteDraft={this.props.deleteCommunicationDraft}
            draft={this.props.draft}
            {...rest}
          />
        );
      }
      case NEW_CALL:
        return <NewCallFlyOut flyoutId={flyoutId} partyId={partyId} callContacts={createPhoneContactGroupsFromPartyMembers(members)} {...flyoutProps} />;
      case EMAIL_THREAD: {
        const comms = this.props.allCommunications.filter(c => c.threadId === flyoutProps.threadId);
        return (
          <EmailThreadFlyOut
            flyoutId={flyoutId}
            persons={persons}
            partyId={partyId}
            partyMembers={partyMembers}
            sendMethod={this.props.sendMessage}
            saveDraft={this.props.saveCommunicationDraft}
            deleteDraft={this.props.deleteCommunicationDraft}
            draft={this.props.draft}
            onMarkAsSpam={this.props.markContactAsSpam}
            currentUser={currentUser}
            users={users}
            communications={comms.toArray()}
            userToken={userToken}
            deleteAttachments={this.props.deleteDocument}
            assignedProperty={assignedPropertyName}
            {...flyoutProps}
          />
        );
      }

      case DIRECT_MESSAGE_THREAD: {
        const { threadId, communications: receivedComms, ...rest } = flyoutProps;
        const comms = partyId ? receivedComms || communications : this.props.allCommunications.filter(c => c.threadId === flyoutProps.threadId);

        const personsForComms = flyoutProps.personId ? this.props.allPersons.filter(p => p.id === flyoutProps.personId) : persons;
        return (
          <DirectMessageThreadFlyOut
            flyoutId={flyoutId}
            partyId={partyId}
            threadId={threadId}
            communications={comms}
            partyMembers={partyMembers}
            persons={personsForComms}
            currentUser={currentUser}
            users={users}
            saveDraft={this.props.saveCommunicationDraft}
            deleteDraft={this.props.deleteCommunicationDraft}
            draft={this.props.draft}
            {...rest}
          />
        );
      }
      case WEB_THREAD:
        return <WebThreadFlyout flyoutId={flyoutId} partyId={partyId} {...flyoutProps} />;

      case INACTIVE_CALL:
        return (
          <InactiveCallFlyout
            flyoutId={flyoutId}
            wideAvailable
            partyId={partyId}
            personId={personId}
            onMarkAsSpam={this.props.markContactAsSpam}
            communications={communications.toArray()}
            {...flyoutProps}
          />
        );
      case ACTIVE_CALL:
        return <ActiveCallFlyout flyoutId={flyoutId} partyId={partyId} />;
      case WALK_IN:
        return <WalkinThreadFlyOut flyoutId={flyoutId} partyMembers={partyMembers} persons={persons} partyId={partyId} {...flyoutProps} />;
      default:
        logger.error({ flyoutType, flyoutProps }, 'Trying to render an unknown flyout type');
        return <div />;
    }
  };

  render() {
    const { openedFlyouts, showPlivoConnectionErrorDialog } = this.props;
    const flyoutKeys = Object.keys(openedFlyouts);
    const msgBox = this.warningDialogForPlivoConnectionError();

    return (
      <div>
        <GenericFlyOutContainer childrenCount={flyoutKeys.length}>
          {flyoutKeys.map(key => (
            <div key={key}>{this.renderFlyoutType(openedFlyouts[key])}</div>
          ))}
        </GenericFlyOutContainer>
        {showPlivoConnectionErrorDialog && msgBox}
      </div>
    );
  }
}
