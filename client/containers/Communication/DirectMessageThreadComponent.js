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
import { commsReadByUser } from 'redux/modules/communication';
import trim from 'helpers/trim';
import { t } from 'i18next';
import { formatDay } from 'helpers/date-utils';
import { IconButton, TextBox, MsgBox } from 'components';
import { isPagePersonDetails } from 'helpers/leasing-navigator';
import { isGroupMessageDelivered } from 'helpers/communications';
import { DALTypes } from '../../../common/enums/DALTypes';
import Divider from './Divider';
import DirectMessage from './DirectMessage';
import GroupMessage from './GroupMessage';
import { cf } from './SmsThreadComponent.scss';
import { isSameDay, toMoment } from '../../../common/helpers/moment-utils';
import TemplateExpander from '../../custom-components/TemplateExpander/TemplateExpander';

@connect(() => ({}), dispatch => bindActionCreators({ commsReadByUser }, dispatch))
export default class DirectMessageThreadComponent extends Component {
  static propTypes = {
    communications: PropTypes.array,
    partyMembers: PropTypes.array,
    persons: PropTypes.array,
    disabledEdit: PropTypes.bool,
    onSendMessage: PropTypes.func,
    onCloseDialog: PropTypes.func,
    currentUser: PropTypes.object,
    users: PropTypes.object,
    commsReadByUser: PropTypes.func,
  };

  constructor(props) {
    super(props);
    const selectedRecipients = this.getSelectedRecipients(props);
    const text = props.draftContent || props.defaultValue;

    this.state = {
      sendBtnDisabled: this.shouldDisableSend(selectedRecipients, text),
      selectedRecipients,
      wasManuallyClosed: false,
    };

    window.addEventListener('beforeunload', this.handleCloseFlyout);
  }

  shouldDisableSend = (recipients, text) => {
    const hasRecipients = recipients && recipients.length;
    const isEmpty = !text;

    return !hasRecipients || isEmpty || isPagePersonDetails();
  };

  async componentDidMount() {
    this.scrollToBottom();

    const { setBeforeClose } = this.props;
    setBeforeClose && setBeforeClose(this.beforeClose);
  }

  async componentWillReceiveProps(nextProps) {
    if (nextProps.communications > this.props.communications) {
      this.state.focused && this.markThreadAsRead(nextProps.threadId);
    }

    const { defaultValue } = this.props;
    if (nextProps.defaultValue !== defaultValue) {
      const text = nextProps.draftContent || nextProps.defaultValue;
      const selectedRecipients = this.getSelectedRecipients(this.props);
      this.state = {
        sendBtnDisabled: this.shouldDisableSend(selectedRecipients, text),
        selectedRecipients,
      };
    }
  }

  componentWillUnmount() {
    this.handleCloseFlyout();
    window.removeEventListener('beforeunload', this.handleCloseFlyout);
  }

  getSelectedRecipients = props => {
    const { draftRecipients, recipients, persons, communications } = props;
    if (draftRecipients) return draftRecipients;

    if (recipients) return props.selectedRecipients || recipients.map(recipient => recipient && recipient.contactInfo.defaultEmail).filter(x => x);

    if (communications && communications.length) {
      // get most recent communication
      const latestComm = communications.sort((a, b) => toMoment(b.created_at).diff(toMoment(a.created_at)))[0];
      return this.getRecipientsFromComm(latestComm, persons);
    }

    return [];
  };

  getRecipientsFromComm = (latestComm, persons) => {
    const recipients = [];
    const recipientsPhonesArray = latestComm.direction === DALTypes.CommunicationDirection.OUT ? latestComm.message.to : [latestComm.message.from];
    const getMatchingPhoneIds = (pers, phoneNo) => pers.contactInfo.phones.filter(p => phoneNo === p.value).map(p => p.id);

    recipientsPhonesArray.forEach(phoneNo =>
      persons.forEach(pers => {
        recipients.push(...getMatchingPhoneIds(pers, phoneNo));
      }),
    );

    return recipients;
  };

  handleCloseFlyout = () => {
    const { text, selectedRecipients } = this.constructMessage();
    const directMessageIsEmpty = !text;

    if (this.state.wasManuallyClosed || directMessageIsEmpty) {
      this.props.draftId && this.props.deleteDraft(this.props.draftId);
      return;
    }

    const threadId = this.props.communications && this.props.communications.length ? this.props.threadId : null;

    this.props.saveDraft({
      id: this.props.draftId || '',
      recipients: { contactInfos: selectedRecipients },
      message: { content: text },
      type: DALTypes.CommunicationMessageType.DIRECT_MESSAGE,
      partyId: this.props.partyId,
      userId: this.props.currentUser.id,
      threadId,
    });
  };

  markThreadAsRead = threadId => threadId && this.props.commsReadByUser(threadId);

  scrollToBottom() {
    if (this.commsNode) this.commsNode.scrollTop = this.commsNode.scrollHeight;
  }

  componentDidUpdate(prevProps, prevState) {
    if (this.state.focused && prevState.focused !== this.state.focused) {
      this.markThreadAsRead(this.props.threadId);
    }

    this.scrollToBottom();
  }

  onFocus = () => this.setState({ focused: true });

  onBlur = () => this.setState({ focused: false });

  onChange = ({ value }) =>
    this.setState(prevState => ({
      sendBtnDisabled: this.shouldDisableSend(prevState.selectedRecipients, value),
    }));

  handleOnCloseDialog = () => {
    const { onCloseDialog } = this.props;
    onCloseDialog && onCloseDialog();
  };

  constructMessage = () => {
    const text = trim(this.content.value);
    const { selectedRecipients } = this.state;

    return { text, selectedRecipients };
  };

  handleSendDirectMessage = () => {
    const { text, selectedRecipients } = this.constructMessage();
    if (!text || !selectedRecipients.length) {
      return;
    }

    const { onSendDirectMessage } = this.props;
    this.content.value = '';
    onSendDirectMessage && onSendDirectMessage(text, selectedRecipients);
    this.props.draftId && this.props.deleteDraft(this.props.draftId);
  };

  getCommSender = (comm, persons) => {
    const commPersons = comm.persons.map(personId => persons.find(p => p.id === personId));

    return comm.direction === DALTypes.CommunicationDirection.IN
      ? commPersons[0]
      : comm.userId !== this.props.currentUser.id && this.props.users.find(item => item.id === comm.userId);
  };

  beforeClose = (manuallyClosed, maximizeIfNecessary) => {
    const { text } = this.constructMessage();
    if (!text) {
      this.setState(
        {
          wasManuallyClosed: manuallyClosed,
        },
        () => this.props.onClose(),
      );
      return;
    }
    maximizeIfNecessary();
    this.setState({
      wasManuallyClosed: manuallyClosed,
      discardChangesWarning: true,
    });
  };

  resizeTextArea = () => {
    const { content } = this;
    if (!content) return;
    content.resize();
  };

  render({ communications, persons, partyId, propertyId, timezone } = this.props) {
    const commDivs = [];
    let lastDate;

    (communications || []).forEach(comm => {
      const { direction, message } = comm;
      const { metadata: { retractDetails = {} } = {} } = message;

      const isDelivered = isGroupMessageDelivered(comm);

      const isOwner = direction === DALTypes.CommunicationDirection.OUT;
      if (!lastDate || !isSameDay(lastDate, comm.created_at, { timezone })) {
        commDivs.push(
          <div key={formatDay(comm.created_at, timezone)}>
            <Divider label={formatDay(comm.created_at, timezone)} />
          </div>,
        );
        lastDate = comm.created_at;
      }

      const commElement = () => {
        switch (comm.category) {
          case DALTypes.PostCategory.ANNOUNCEMENT:
          case DALTypes.PostCategory.EMERGENCY:
            return (
              <GroupMessage
                id={comm.id}
                timezone={timezone}
                time={comm.created_at}
                title={message.title || ''}
                content={message.text || ''}
                sentBy={comm.message?.from}
                category={comm.category}
                isDelivered={isDelivered}
                retractDetails={retractDetails}
              />
            );
          default:
            return (
              <DirectMessage
                isOwner={isOwner}
                timezone={timezone}
                time={comm.created_at}
                content={message.text || ''}
                sentBy={this.getCommSender(comm, persons)}
              />
            );
        }
      };

      commDivs.push(<div key={comm.id}>{commElement()}</div>);
    });
    return (
      <TemplateExpander className={cf('expander')} partyId={partyId} propertyId={propertyId} onExpand={this.resizeTextArea} context="directMesage">
        {({ renderProcessingStatus, renderErrorSection }) => (
          <div className={cf('mainContent')}>
            <div className={cf('messages-section')}>
              <div className={cf('messages')} id="commsId" ref={node => (this.commsNode = node)}>
                {commDivs}
              </div>
              <div className={cf('form-section')}>
                {renderProcessingStatus()}
                <div className={cf('form')}>
                  <TextBox
                    id="directMessageToSend"
                    inputStyle={{ fontSize: '.8125rem' }}
                    disabled={!!this.props.disabledEdit || isPagePersonDetails()}
                    ref={e => (this.content = e)}
                    autoFocus
                    data-expansion-trigger={true}
                    multiline={true}
                    maxRows={6}
                    placeholder={t('DIRECT_MESSAGE_CARD_WRITE_MESSAGE')}
                    onEnterPress={this.handleSendDirectMessage}
                    onFocus={this.onFocus}
                    onBlur={this.onBlur}
                    onChange={this.onChange}
                    value={this.props.draftContent || this.props.defaultValue}
                  />
                  <div
                    className={cf('send-button', {
                      disabled: this.state.sendBtnDisabled,
                    })}>
                    <IconButton id="sendDirectMessage" iconName="send" disabled={this.state.sendBtnDisabled} onClick={this.handleSendDirectMessage} />
                  </div>
                </div>
              </div>
            </div>
            {renderErrorSection({ style: { position: 'absolute', width: '100%', top: 0, left: 0 } })}
            <MsgBox
              open={this.state.discardChangesWarning}
              onCloseRequest={() => this.setState({ discardChangesWarning: false })}
              onOKClick={this.props.onClose}
              lblOK={t('DISCARD_CHANGES')}
              lblCancel={t('KEEP_EDITING')}
              title={t('DISCARD_MESSAGE_DRAFT')}
            />
          </div>
        )}
      </TemplateExpander>
    );
  }
}
