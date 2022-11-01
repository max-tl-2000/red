/*
 * Copyright (c) 2022 Reva Technology Inc., all rights reserved.
 * Unauthorized copying of this file, via any medium is strictly prohibited
 * Licensed under the Elastic License 2.0; you may not use this file except
 * in compliance with the Elastic License 2.0.
 */

import PropTypes from 'prop-types';
import React, { Component } from 'react';
import { Typography } from 'components';
import DockedFlyOut from 'components/DockedFlyOut/DockedFlyOut';
import SendEmailComponent from 'custom-components/SendMail/SendEmailComponent';
import { closeFlyout } from 'redux/modules/flyoutStore';
import { bindActionCreators } from 'redux';
import { connect } from 'react-redux';
import { getEmailSignature } from 'helpers/communications';
import { t } from 'i18next';
import { getOutProgramSelector } from 'redux/selectors/programSelectors';
import { DALTypes } from '../../../common/enums/DALTypes';

const { SubHeader } = Typography;

@connect(
  (state, props) => ({
    userToken: state.auth.token,
    currentUser: state.auth.user,
    outgoingProgram: getOutProgramSelector()(state, props),
  }),
  dispatch =>
    bindActionCreators(
      {
        closeFlyout,
      },
      dispatch,
    ),
)
export default class EmailFlyout extends Component {
  static propTypes = {
    partyId: PropTypes.string,
    sendMethod: PropTypes.func,
    saveDraft: PropTypes.func,
    deleteDraft: PropTypes.func,
    templateData: PropTypes.object,
    partyMembers: PropTypes.object,
    subject: PropTypes.string,
    persons: PropTypes.object,
    flyoutId: PropTypes.string,
    visibleElements: PropTypes.array,
    deleteAttachments: PropTypes.func,
  };

  constructor(props) {
    super(props);
    const { draft } = props;
    const draftData = draft && draft.data;
    const draftSubject = draftData && draftData.subject;
    const draftContent = draftData && draftData.content;
    this.state = {
      subject: draftSubject || '',
      content: draftContent || '',
    };
  }

  sendMessage = (recipients, message, type, partyId, recipientPersons, html) => {
    // TODO: This check will be deleted when the templates are ready
    if (this.props.sendQuoteMailArgs) {
      const { sendQuoteMailArgs } = this.props;
      const { quoteId, context } = sendQuoteMailArgs;
      const personIds = recipientPersons.map(({ id }) => id);

      this.props.sendQuoteMail({ quoteId, partyId, context, personIds });
    } else if (this.props.templateData) {
      // TODO: Delete this when templates are ready
      const templateData = this.props.templateData;
      const anchorText = t('VIEW_QUOTE_IN_BROWSER');
      const notificationMessage = t('QUOTE_WAS_SENT');
      // set default notification in message object
      const enhancedMessage = { ...message, notificationMessage };
      // we set the type of template that will be sent
      templateData.templateName = DALTypes.TemplateNames.QUOTE;
      templateData.contentForComms = { anchorText };
      this.props.sendMethod(recipients, enhancedMessage, type, partyId, null, null, templateData);
    } else {
      this.props.sendMethod(recipients, message, type, partyId, null, null, null, null, html);
    }
  };

  get subject() {
    const { state, props } = this;
    return state.subject || props.subject || '';
  }

  get signature() {
    const { props } = this;
    return getEmailSignature(props.currentUser, props.assignedProperty, props.outgoingProgram) || '';
  }

  get content() {
    const { state } = this;
    return state.content || this.signature;
  }

  setBeforeClose = beforeClose => this.setState({ beforeClose });

  onBeforeClose = (manuallyClosed, maximizeIfNecessary) => {
    const { beforeClose } = this.state;
    beforeClose(manuallyClosed, maximizeIfNecessary);

    return { cancel: true };
  };

  render = () => {
    const {
      partyId,
      partyMembers,
      persons,
      guests,
      flyoutId,
      visibleElements,
      templateData,
      userToken,
      currentUser,
      draft,
      propertyId,
      assignedProperty,
      outgoingProgram,
      inventoryId,
      quoteId,
    } = this.props;

    const partyMembersArray = partyMembers ? partyMembers.toArray() : [];
    const personsArray = persons ? persons.toArray() : [];
    const subject = this.subject;
    const draftObject = draft || {};
    const draftRecipients = draftObject.recipients;
    const draftFiles = (draftObject.data || {}).files || [];
    const defaultContent = getEmailSignature(currentUser, assignedProperty, outgoingProgram) || '';

    return (
      <DockedFlyOut
        id="emailFlyout"
        dataId={`email-${subject}`}
        windowIconName="email"
        title={
          <SubHeader style={{ maxWidth: 450 }} ellipsis>
            {subject}
          </SubHeader>
        }
        flyoutId={flyoutId}
        onBeforeClose={this.onBeforeClose}>
        <SendEmailComponent
          onClose={() => this.props.closeFlyout(flyoutId)}
          emailTo={guests}
          propertyId={propertyId}
          templateArgs={{ inventoryId, quoteId }}
          visibleElements={visibleElements}
          sendMethod={this.sendMessage}
          saveDraft={this.props.saveDraft}
          deleteDraft={this.props.deleteDraft}
          setBeforeClose={this.setBeforeClose}
          draftId={(draft || {}).id}
          draftRecipients={draftRecipients}
          draftFiles={draftFiles}
          defaultContent={defaultContent}
          prospectId={partyId}
          subject={subject}
          templateSubject={(templateData && templateData.subject) || ''}
          onSubjectChange={value => this.setState({ subject: value })}
          content={this.content}
          onContentChange={value => this.setState({ content: value })}
          partyMembers={partyMembersArray}
          templateDataId={(templateData || {}).id}
          persons={personsArray}
          userToken={userToken}
          currentUser={currentUser}
          deleteAttachments={this.props.deleteAttachments}
          showListOnFocus={true}
          signature={this.signature}
        />
      </DockedFlyOut>
    );
  };
}
