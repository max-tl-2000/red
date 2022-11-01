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
import { sendMessage, updateThreadIdForSms } from 'redux/modules/communication';
import { updateFlyout, closeFlyout } from 'redux/modules/flyoutStore';
import ellipsis from 'helpers/ellipsis';
import { t } from 'i18next';
import { formatPhoneNumber } from 'helpers/strings';

import { Typography } from 'components';

import DockedFlyOut from 'components/DockedFlyOut/DockedFlyOut';
import { observer, inject, Observer } from 'mobx-react';
import { computed } from 'mobx';
import BlockContactDialog from './BlockContactDialog';
import { cf } from './SmsThreadFlyOut.scss';
import { getFlattenedCommPersons, getCommunicationParticipants } from '../../helpers/communications';
import { DALTypes } from '../../../common/enums/DALTypes';
import SmsThreadComponent from './SmsThreadComponent';
import { getPartyTimezone, disableCommsForArchivedParty } from '../../redux/selectors/partySelectors';
import { toMoment } from '../../../common/helpers/moment-utils';
import { TemplateTypes } from '../../../common/enums/templateTypes';
import Status from '../../components/Status/Status';

const { SubHeader } = Typography;

const getCommParticipants = (threadId, persons, communications) => {
  const involvedPersonsIds = getFlattenedCommPersons(communications);
  const involvedPersons = involvedPersonsIds.map(personId => persons.get(personId)).filter(p => p);
  const commParticipants = getCommunicationParticipants(DALTypes.CommunicationDirection.OUT, involvedPersons);
  const hasCommunications = communications && communications.length;

  if (threadId && commParticipants && hasCommunications) {
    return commParticipants;
  }

  return '';
};

const getInvolvedPersonsInCommunication = (persons, contactInfoIds = []) => {
  const isSelectedPhone = phoneId => contactInfoIds.find(id => phoneId.id === id);
  return persons.filter(person => person.contactInfo.phones.find(isSelectedPhone));
};

@connect(
  (state, props) => ({
    timezone: getPartyTimezone(state, props),
    areCommsDisabled: disableCommsForArchivedParty(state, props),
  }),
  dispatch =>
    bindActionCreators(
      {
        sendMessage,
        updateThreadIdForSms,
        updateFlyout,
        closeFlyout,
      },
      dispatch,
    ),
)
@inject('templateManagerFactory')
@observer
export default class SmsThreadFlyOut extends Component {
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
    updateThreadIdForSms: PropTypes.func,
    defaultText: PropTypes.string,
    quote: PropTypes.object,
    templateData: PropTypes.object,
    onMarkAsSpam: PropTypes.func,
    areCommsDisabled: PropTypes.bool,
  };

  constructor(props) {
    super(props);

    this.templateManager = props.templateManagerFactory.create();

    this.state = {
      isBlockSenderDialogOpen: false,
    };
  }

  @computed
  get defaultTemplateLoading() {
    return this.templateManager.busy;
  }

  async componentWillMount() {
    const { sendQuoteMailArgs = {}, partyId } = this.props;
    const { templateName, templateArgs } = sendQuoteMailArgs;
    if (!templateName) return;

    const defaultTemplate = await this.templateManager.renderTemplateByName(templateName, { partyId, templateArgs, context: TemplateTypes.SMS });
    if (this.templateManager.templateRenderError) {
      this.setState({ templateLoadError: this.templateManager.templateRenderError, defaultTemplate: '' });
      return;
    }
    const defaultTemplateBody = (defaultTemplate || {}).body;
    if (!defaultTemplateBody) return;

    this.setState({ defaultTemplate: defaultTemplateBody });
  }

  componentWillUnmount() {
    this.props.templateManagerFactory.removeInstance(this.templateManager);
    this.templateManager = null;
  }

  recipientsChangeHandler = selectedContactInfoIds => {
    const { persons } = this.props;
    const involvedPersons = getInvolvedPersonsInCommunication(persons, selectedContactInfoIds);
    const personIds = involvedPersons.map(person => person.id).toArray();
    personIds.length && this.props.updateThreadIdForSms(this.props.flyoutId, personIds);
  };

  sendMessageHandler = (text, selectedContactInfoIds) => {
    this.recipientsChangeHandler(selectedContactInfoIds);

    const { partyId, quote, templateData, threadId, useSendQuoteMail, sendQuoteMailArgs } = this.props;
    const recipients = { contactInfos: selectedContactInfoIds };
    const message = {
      content: text,
      unread: false,
    };

    // TODO: This check will be deleted when the templates are ready
    if (useSendQuoteMail) {
      const { quoteId, context } = sendQuoteMailArgs;
      const { persons } = this.props;
      const involvedPersons = getInvolvedPersonsInCommunication(persons, selectedContactInfoIds);
      const personIds = involvedPersons.map(person => person.id).toArray();
      this.props.sendQuoteMail({ quoteId, partyId, context, personIds });
    } else {
      this.props.sendMessage(recipients, message, DALTypes.CommunicationMessageType.SMS, partyId, undefined, quote, templateData, threadId);
    }

    this.props.updateFlyout(this.props.flyoutId, {
      draft: null,
    });
  };

  handleOpenBlockSender = () => {
    this.setState({
      isBlockSenderDialogOpen: true,
    });
  };

  handleBlockPhoneNumber = contactInfo => {
    const { onMarkAsSpam } = this.props;
    if (!onMarkAsSpam) return;

    const phoneContact = contactInfo.phones[0];
    onMarkAsSpam && onMarkAsSpam(phoneContact);
  };

  renderBlockSender = person => {
    if (!person) return <div />;

    const { fullName, contactInfo } = person;

    const open = this.state.isBlockSenderDialogOpen;
    const phone = contactInfo ? contactInfo.defaultPhone : '';
    if (!phone) return <noscript />;

    const formattedPhone = formatPhoneNumber(phone);

    return (
      <BlockContactDialog
        open={open}
        fullName={fullName}
        msgCommunicationFrom={t('FUTURE_CALLS_FROM')}
        channel={formattedPhone}
        onBlockContact={() => this.handleBlockPhoneNumber(contactInfo)}
        onCloseRequest={() => this.setState({ isBlockSenderDialogOpen: false })}
      />
    );
  };

  setBeforeClose = beforeClose => this.setState({ beforeClose });

  onBeforeClose = (manuallyClosed, maximizeIfNecessary) => {
    const { beforeClose } = this.state;
    beforeClose(manuallyClosed, maximizeIfNecessary);

    return { cancel: true };
  };

  clearTemplateError = () => {
    this.setState({
      templateLoadError: null,
    });
  };

  renderLoadingTemplateStatus = () => <Observer>{() => <Status height={1} processing={this.defaultTemplateLoading} />}</Observer>;

  render(
    {
      threadId,
      communications,
      partyMembers,
      persons,
      flyoutId,
      currentUser,
      users,
      draft,
      timezone,
      partyId,
      propertyId,
      areCommsDisabled,
      inventoryId,
      quoteId,
    } = this.props,
  ) {
    const comms = communications
      .filter(p => p.threadId === threadId)
      .sort((a, b) => toMoment(a.created_at).diff(toMoment(b.created_at)))
      .toArray();

    const partyMembersArray = partyMembers ? partyMembers.toArray() : [];
    const commParticipants = getCommParticipants(threadId, persons, comms);

    const recipients = getFlattenedCommPersons(comms)
      .map(personId => persons.get(personId))
      .filter(r => !!r);
    const blockEnabled = recipients.length === 1;
    const person = blockEnabled ? recipients[0] : {};

    const smsDraft = draft || {};
    const draftRecipients = smsDraft.recipients && smsDraft.recipients.contactInfos;
    const draftContent = smsDraft.data && smsDraft.data.content;
    const { defaultTemplate, templateLoadError } = this.state;

    return (
      <div>
        <DockedFlyOut
          id="smsFlyOut"
          flyoutId={flyoutId}
          windowIconName="message-text"
          title={
            <div className={cf('title')}>
              <SubHeader inline>{ellipsis(commParticipants || t('NEW_SMS'), 16)}</SubHeader>
            </div>
          }
          onBeforeClose={this.onBeforeClose}>
          <SmsThreadComponent
            templateLoadError={templateLoadError}
            clearTemplateError={this.clearTemplateError}
            communications={comms}
            partyMembers={partyMembersArray}
            disableEdit={!!this.props.templateData}
            persons={persons.toArray()}
            threadId={threadId}
            defaultValue={defaultTemplate || this.props.defaultText}
            disabledEdit={!!defaultTemplate || areCommsDisabled}
            onRecipientsChange={this.recipientsChangeHandler}
            onSendMessage={this.sendMessageHandler}
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
            renderLoadingTemplateStatus={this.renderLoadingTemplateStatus}
            templateArgs={{ inventoryId, quoteId }}
          />
          {this.renderBlockSender(person)}
        </DockedFlyOut>
      </div>
    );
  }
}
