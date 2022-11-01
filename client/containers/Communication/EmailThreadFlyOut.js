/*
 * Copyright (c) 2022 Reva Technology Inc., all rights reserved.
 * Unauthorized copying of this file, via any medium is strictly prohibited
 * Licensed under the Elastic License 2.0; you may not use this file except
 * in compliance with the Elastic License 2.0.
 */

import truncate from 'lodash/truncate';
import PropTypes from 'prop-types';
import React, { Component } from 'react';
import { Typography } from 'components';
import DockedFlyOut from 'components/DockedFlyOut/DockedFlyOut';
import EmailThreadComponent from './EmailThreadComponent';

const { SubHeader } = Typography;

export default class EmailThreadFlyOut extends Component {
  static propTypes = {
    flyoutId: PropTypes.string,
    communications: PropTypes.array,
    persons: PropTypes.object,
    partyMembers: PropTypes.object,
    partyId: PropTypes.string,
    userToken: PropTypes.string,
    sendMethod: PropTypes.func,
    onMarkAsSpam: PropTypes.func,
    saveDraft: PropTypes.func,
    deleteDraft: PropTypes.func,
    draft: PropTypes.object,
  };

  setBeforeClose = beforeClose => this.setState({ beforeClose });

  onBeforeClose = (manuallyClosed, maximizeIfNecessary) => {
    const { beforeClose } = this.state;
    beforeClose(manuallyClosed, maximizeIfNecessary);

    return { cancel: true };
  };

  render() {
    const {
      flyoutId,
      communications,
      persons,
      partyMembers,
      partyId,
      sendMethod,
      onMarkAsSpam,
      currentUser,
      users,
      threadId,
      userToken,
      deleteAttachments,
      assignedProperty,
      propertyId,
      saveDraft,
      deleteDraft,
      draft,
      inventoryId,
      quoteId,
    } = this.props;

    const communicationThreads = communications && communications.filter(comm => comm.threadId === threadId);
    const communication = communicationThreads && communicationThreads.pop();
    const subject = communication ? communication.message.subject || '' : '';

    return (
      <DockedFlyOut
        windowIconName="email"
        flyoutId={flyoutId}
        title={<SubHeader inline>{truncate(subject, { length: 50 })}</SubHeader>}
        onBeforeClose={this.onBeforeClose}>
        <EmailThreadComponent
          communications={communications}
          threadId={threadId}
          persons={persons}
          partyMembers={partyMembers}
          partyId={partyId}
          sendMethod={sendMethod}
          onMarkAsSpam={onMarkAsSpam}
          currentUser={currentUser}
          users={users}
          userToken={userToken}
          deleteAttachments={deleteAttachments}
          assignedProperty={assignedProperty}
          propertyId={propertyId}
          saveDraft={saveDraft}
          deleteDraft={deleteDraft}
          draft={draft}
          flyoutId={flyoutId}
          setBeforeClose={this.setBeforeClose}
          templateArgs={{ inventoryId, quoteId }}
        />
      </DockedFlyOut>
    );
  }
}
