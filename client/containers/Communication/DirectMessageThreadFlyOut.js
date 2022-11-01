/*
 * Copyright (c) 2022 Reva Technology Inc., all rights reserved.
 * Unauthorized copying of this file, via any medium is strictly prohibited
 * Licensed under the Elastic License 2.0; you may not use this file except
 * in compliance with the Elastic License 2.0.
 */

import PropTypes from 'prop-types';
import React, { Component } from 'react';
import { bindActionCreators } from 'redux';
import { connect } from 'react-redux';
import { sendMessage } from 'redux/modules/communication';
import { updateFlyout, closeFlyout } from 'redux/modules/flyoutStore';
import ellipsis from 'helpers/ellipsis';

import { Typography } from 'components';

import DockedFlyOut from 'components/DockedFlyOut/DockedFlyOut';
import { observer } from 'mobx-react';
import { cf } from './SmsThreadFlyOut.scss';
import { getFlattenedCommPersons } from '../../helpers/communications';
import { DALTypes } from '../../../common/enums/DALTypes';
import DirectMessageThreadComponent from './DirectMessageThreadComponent';
import { getPartyTimezone } from '../../redux/selectors/partySelectors';
import { toMoment } from '../../../common/helpers/moment-utils';
import { getDisplayName } from '../../../common/helpers/person-helper';

const { SubHeader } = Typography;

const getCommParticipants = (threadId, persons, communications) => {
  const involvedPersonsIds = getFlattenedCommPersons(communications);
  const involvedPersons = involvedPersonsIds.map(personId => persons.get(personId)).filter(p => p);
  const commParticipants = involvedPersons.map(p => getDisplayName(p)).join(', ');
  const hasCommunications = communications && communications.length;

  if (threadId && commParticipants && hasCommunications) {
    return commParticipants;
  }

  return '';
};

@connect(
  (state, props) => ({
    timezone: getPartyTimezone(state, props),
  }),
  dispatch =>
    bindActionCreators(
      {
        sendMessage,
        updateFlyout,
        closeFlyout,
      },
      dispatch,
    ),
)
@observer
export default class DirectMessageThreadFlyOut extends Component {
  static propTypes = {
    communications: PropTypes.object,
    partyMembers: PropTypes.object,
    persons: PropTypes.object,
    updateFlyout: PropTypes.func,
    recipients: PropTypes.array,
    currentUser: PropTypes.object,
    users: PropTypes.object,
    threadId: PropTypes.string,
    sendMessage: PropTypes.func,
    defaultText: PropTypes.string,
  };

  sendDirectMessageHandler = (text, selectedContactInfoIds) => {
    const { partyId, threadId } = this.props;
    const recipients = { contactInfos: selectedContactInfoIds };
    const message = {
      content: text,
      unread: false,
    };

    this.props.sendMessage(recipients, message, DALTypes.CommunicationMessageType.DIRECT_MESSAGE, partyId, undefined, undefined, undefined, threadId);

    this.props.updateFlyout(this.props.flyoutId, {
      draft: null,
    });
  };

  setBeforeClose = beforeClose => this.setState({ beforeClose });

  onBeforeClose = (manuallyClosed, maximizeIfNecessary) => {
    const { beforeClose } = this.state;
    beforeClose(manuallyClosed, maximizeIfNecessary);

    return { cancel: true };
  };

  render({ threadId, communications, partyMembers, persons, flyoutId, currentUser, users, draft, timezone, partyId, propertyId } = this.props) {
    const comms = communications
      .filter(p => p.threadId === threadId)
      .sort((a, b) => toMoment(a.created_at).diff(toMoment(b.created_at)))
      .toArray();

    const partyMembersArray = partyMembers ? partyMembers.toArray() : [];
    const commParticipants = getCommParticipants(threadId, persons, comms);

    const recipients = getFlattenedCommPersons(comms).map(personId => persons.get(personId));

    const directMessageDraft = draft || {};
    const draftRecipients = directMessageDraft.recipients && directMessageDraft.recipients.contactInfos;
    const draftContent = directMessageDraft.data && directMessageDraft.data.content;

    return (
      <div>
        <DockedFlyOut
          id="directMessageFlyOut"
          flyoutId={flyoutId}
          windowIconName="chat"
          title={
            <div className={cf('title')}>
              <SubHeader inline>{ellipsis(commParticipants, 16)}</SubHeader>
            </div>
          }
          onBeforeClose={this.onBeforeClose}>
          <DirectMessageThreadComponent
            communications={comms}
            partyMembers={partyMembersArray}
            disableEdit={!!this.props.templateData}
            persons={persons.toArray()}
            threadId={threadId}
            onSendDirectMessage={this.sendDirectMessageHandler}
            recipients={this.props.recipients || recipients}
            currentUser={currentUser}
            saveDraft={this.props.saveDraft}
            deleteDraft={this.props.deleteDraft}
            setBeforeClose={this.setBeforeClose}
            draftId={(draft || {}).id}
            partyId={partyId}
            propertyId={propertyId}
            onClose={() => this.props.closeFlyout(flyoutId)}
            users={users}
            timezone={timezone}
            draftRecipients={draftRecipients}
            draftContent={draftContent}
          />
        </DockedFlyOut>
      </div>
    );
  }
}
