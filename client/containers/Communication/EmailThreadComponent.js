/*
 * Copyright (c) 2022 Reva Technology Inc., all rights reserved.
 * Unauthorized copying of this file, via any medium is strictly prohibited
 * Licensed under the Elastic License 2.0; you may not use this file except
 * in compliance with the Elastic License 2.0.
 */

import PropTypes from 'prop-types';
import React, { Component } from 'react';
import { connect } from 'react-redux';
import { bindActionCreators } from 'redux';
import scrollIntoView from 'helpers/scrollIntoView';
import { GeminiScrollbar } from 'components';
import { commsReadByUser } from 'redux/modules/communication';
import { updateFlyout, closeFlyout } from 'redux/modules/flyoutStore';
import EmailMessageCard from './EmailMessageCard';
import EmailReply from './EmailReply';
import { cf } from './EmailThreadComponent.scss';
import { getPartyTimezone, disableCommsForArchivedParty } from '../../redux/selectors/partySelectors';
import { toMoment } from '../../../common/helpers/moment-utils';

@connect(
  (state, props) => ({
    timezone: getPartyTimezone(state, props),
    areCommsDisabled: disableCommsForArchivedParty(state, props),
  }),
  dispatch =>
    bindActionCreators(
      {
        commsReadByUser,
        closeFlyout,
        updateFlyout,
      },
      dispatch,
    ),
)
export default class EmailThreadComponent extends Component {
  static propTypes = {
    communications: PropTypes.array,
    persons: PropTypes.object,
    partyId: PropTypes.string,
    partyMembers: PropTypes.object,
    sendMethod: PropTypes.func,
    currentUser: PropTypes.object,
    users: PropTypes.object,
    threadId: PropTypes.string,
    userToken: PropTypes.string,
    deleteAttachments: PropTypes.func,
    commsReadByUser: PropTypes.func,
    saveDraft: PropTypes.func,
    deleteDraft: PropTypes.func,
    draft: PropTypes.object,
    timezone: PropTypes.string,
    areCommsDisabled: PropTypes.bool,
  };

  constructor(props) {
    super(props);
    this.state = {
      comms: (props.communications || [])
        .filter(comm => comm.threadId === this.props.threadId)
        .sort((a, b) => toMoment(a.created_at).diff(toMoment(b.created_at))),
    };
  }

  componentDidMount() {
    this.scrollToBottom();
  }

  componentWillReceiveProps(nextProps) {
    if (nextProps.communications) {
      this.setState({
        comms: (nextProps.communications || [])
          .filter(comm => comm.threadId === this.props.threadId)
          .sort((a, b) => toMoment(a.created_at).diff(toMoment(b.created_at))),
      });
    }

    if (nextProps.communications !== this.props.communications && this.state.focused) {
      this.markThreadAsRead(nextProps.threadId);
    }
  }

  componentDidUpdate(prevProps, prevState) {
    if (prevState.comms.length !== this.state.comms.length) {
      this.scrollToBottom();
    }
  }

  markThreadAsRead = threadId => this.props.commsReadByUser(threadId);

  getRecipientList = comm => this.props.persons.filter(pers => comm.persons.indexOf(pers.id) >= 0);

  scrollToLastComm = () => this.commsSection && scrollIntoView(this.commsSection.lastChild);

  scrollToBottom = () => {
    scrollIntoView(this.endOfEmailThread);
  };

  handleFocus = () => {
    this.setState({ focused: true });
    this.markThreadAsRead(this.props.threadId);
  };

  handleBlur = () => this.setState({ focused: false });

  clearFlyoutDraft = () => this.props.updateFlyout(this.props.flyoutId, { draft: null });

  render = () => {
    const {
      partyMembers,
      persons,
      sendMethod,
      currentUser,
      users,
      userToken,
      onMarkAsSpam,
      deleteAttachments,
      communications,
      assignedProperty,
      propertyId,
      timezone,
      areCommsDisabled,
      templateArgs,
    } = this.props;

    const { comms } = this.state;

    const commDivs = comms.map(comm => {
      const participants = this.getRecipientList(comm);
      return (
        <EmailMessageCard
          key={comm.id}
          persons={persons}
          timezone={timezone}
          communication={comm}
          communicationThread={comms}
          participants={participants}
          currentUser={currentUser}
          users={users}
          userToken={userToken}
          onMarkAsSpam={onMarkAsSpam}
          shouldDisplayPrintBtn={true}
        />
      );
    });

    return (
      <div className={cf('main-content')} onFocus={this.handleFocus} onBlur={this.handleBlur}>
        <GeminiScrollbar>
          <div ref={node => (this.commsSection = node)} className={cf('communications')}>
            {commDivs}
          </div>
          <EmailReply
            partyMembers={partyMembers}
            persons={persons}
            replyToCommunication={comms[comms.length - 1]}
            sendMethod={sendMethod}
            clearFlyoutDraft={this.clearFlyoutDraft}
            currentUser={currentUser}
            userToken={userToken}
            deleteAttachments={deleteAttachments}
            communications={communications}
            assignedProperty={assignedProperty}
            propertyId={propertyId}
            saveDraft={this.props.saveDraft}
            deleteDraft={this.props.deleteDraft}
            draft={this.props.draft}
            partyId={this.props.partyId}
            threadId={this.props.threadId}
            setBeforeClose={this.props.setBeforeClose}
            onClose={() => this.props.closeFlyout(this.props.flyoutId)}
            readOnly={areCommsDisabled}
            templateArgs={templateArgs}
            scrollToBottom={this.scrollToBottom}
          />
          <div
            ref={el => {
              this.endOfEmailThread = el;
            }}
          />
        </GeminiScrollbar>
      </div>
    );
  };
}
