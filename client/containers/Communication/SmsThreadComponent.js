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
import {
  disableCommsForArchivedParty,
  isCaiEnabled,
  isActiveLeaseParty as isActiveLeaseWfParty,
  getDaysToRouteToALPostMoveout,
} from 'redux/selectors/partySelectors';
import trim from 'helpers/trim';
import { t } from 'i18next';
import { getFailureNotice } from 'helpers/sms';
import { formatDay } from 'helpers/date-utils';
import { IconButton, TextBox, MsgBox } from 'components';
import RecipientsDropdown from 'custom-components/RecipientsDropdown/RecipientsDropdown';
import { isPagePersonDetails } from 'helpers/leasing-navigator';
import isEqual from 'lodash/isEqual';
import { getSMSFailMessage, getCommunicationPlaceholderMessage } from '../../helpers/communications';
import { getDisplayName } from '../../../common/helpers/person-helper';
import { DALTypes } from '../../../common/enums/DALTypes';
import Divider from './Divider';
import SmsMessage from './SmsMessage';
import { cf } from './SmsThreadComponent.scss';
import { formatPhone } from '../../../common/helpers/phone-utils';
import { isSameDay, toMoment, now } from '../../../common/helpers/moment-utils';
import TemplateExpander from '../../custom-components/TemplateExpander/TemplateExpander';
import NotificationBanner from '../../components/NotificationBanner/NotificationBanner';
import sleep from '../../../common/helpers/sleep';

const TYPING_INDICATOR_THRESHOLD = 7000;
@connect(
  (state, props) => ({
    areCommsDisabled: disableCommsForArchivedParty(state, props),
    caiEnabled: isCaiEnabled(state, props),
    isActiveLeaseParty: isActiveLeaseWfParty(state, props),
    daysToRouteToALPostMoveout: getDaysToRouteToALPostMoveout(state, props),
  }),
  dispatch => bindActionCreators({ commsReadByUser }, dispatch),
)
export default class SmsThreadComponent extends Component {
  static propTypes = {
    communications: PropTypes.array,
    partyMembers: PropTypes.array,
    persons: PropTypes.array,
    disabledEdit: PropTypes.bool,
    onSendMessage: PropTypes.func,
    onCloseDialog: PropTypes.func,
    onRecipientsChange: PropTypes.func,
    currentUser: PropTypes.object,
    users: PropTypes.object,
    commsReadByUser: PropTypes.func,
    templateLoadError: PropTypes.string,
    isActiveLeaseParty: PropTypes.bool,
    daysToRouteToALPostMoveout: PropTypes.number,
  };

  constructor(props) {
    super(props);
    const selectedRecipients = props.draftRecipients || this.getSelectedRecipientsByLastComm(props.communications, props.persons);

    const text = props.draftContent || props.defaultValue;

    this.state = {
      sendBtnDisabled: this.shouldDisableSend(selectedRecipients, text),
      selectedRecipients,
      wasManuallyClosed: false,
      typingIndicatorThresholdFinish: false,
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

    const { setBeforeClose, caiEnabled } = this.props;
    setBeforeClose && setBeforeClose(this.beforeClose);

    caiEnabled && (await sleep(TYPING_INDICATOR_THRESHOLD));
    this.setState({ typingIndicatorThresholdFinish: true });
  }

  didRecipientsCIChange = nextProps => {
    if (!nextProps.recipients.length) return false;

    const selectedRecipients = this.getSelectedRecipients(this.props);
    const allRecipients = nextProps.recipients.map(recipient => recipient.contactInfo.defaultPhoneId);
    const recipientsFound = selectedRecipients.every(v => allRecipients.includes(v));

    return !recipientsFound;
  };

  async componentWillReceiveProps(nextProps) {
    if (nextProps.communications > this.props.communications) {
      this.state.focused && this.markThreadAsRead(nextProps.threadId);

      this.setState({ typingIndicatorThresholdFinish: false });
      nextProps.caiEnabled && (await sleep(TYPING_INDICATOR_THRESHOLD));
      this.setState({ typingIndicatorThresholdFinish: true });
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

    const recipientsChanged = this.didRecipientsCIChange(nextProps);

    if (recipientsChanged) {
      const selectedRecipients = [];
      const text = nextProps.draftContent || nextProps.defaultValue;

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

  getSelectedRecipientsByLastComm = (communications, persons) => {
    if (communications?.length) {
      const latestComm = communications.sort((a, b) => toMoment(b.created_at).diff(toMoment(a.created_at)))[0];
      return this.getRecipientsFromComm(latestComm, persons);
    }
    return [];
  };

  getSelectedRecipients = props => {
    const { draftRecipients, recipients, persons, communications } = props;
    if (draftRecipients) return draftRecipients;

    if (recipients) return props.selectedRecipients || recipients.map(recipient => recipient && recipient.contactInfo.defaultPhoneId).filter(x => x);

    if (communications && communications.length) {
      return this.getSelectedRecipientsByLastComm(communications, persons);
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
    const smsIsEmpty = !text;

    if (this.state.wasManuallyClosed || smsIsEmpty) {
      this.props.draftId && this.props.deleteDraft(this.props.draftId);
      return;
    }

    const threadId = this.props.communications && this.props.communications.length ? this.props.threadId : null;

    this.props.saveDraft({
      id: this.props.draftId || '',
      recipients: { contactInfos: selectedRecipients },
      message: { content: text },
      type: DALTypes.CommunicationMessageType.SMS,
      partyId: this.props.partyId,
      userId: this.props.currentUser.id,
      threadId,
    });
  };

  markThreadAsRead = threadId => threadId && this.props.commsReadByUser(threadId);

  scrollToBottom() {
    if (this.commsNode) this.commsNode.scrollTop = this.commsNode.scrollHeight;
  }

  componentDidUpdate(_prevProps, prevState) {
    if (this.state.focused && prevState.focused !== this.state.focused) {
      this.markThreadAsRead(this.props.threadId);
    }

    if (window.event?.type !== 'blur') this.scrollToBottom();
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

  handleSendMessage = () => {
    const { text, selectedRecipients } = this.constructMessage();
    if (!text || !selectedRecipients.length) {
      return;
    }
    const { onSendMessage } = this.props;
    this.content.value = '';
    onSendMessage && onSendMessage(text, selectedRecipients);
    this.props.draftId && this.props.deleteDraft(this.props.draftId);
  };

  handleRecipientsChange = ids => {
    this.setState({
      selectedRecipients: ids,
      sendBtnDisabled: this.shouldDisableSend(ids, this.content.value),
    });
    const { onRecipientsChange } = this.props;
    onRecipientsChange && onRecipientsChange(ids);
  };

  getCommSender = comm => comm.userId !== this.props.currentUser.id && this.props.users.find(item => item.id === comm.userId);

  beforeClose = (manuallyClosed, maximizeIfNecessary) => {
    const { text } = this.constructMessage();
    const isDefaultPersonList = isEqual(
      this.getSelectedRecipientsByLastComm(this.props.communications, this.props.persons).sort(),
      this.state.selectedRecipients.sort(),
    );
    if (!text && isDefaultPersonList) {
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

  render(
    {
      communications,
      partyMembers,
      persons,
      partyId,
      propertyId,
      timezone,
      renderLoadingTemplateStatus,
      areCommsDisabled,
      caiEnabled,
      templateArgs,
      isActiveLeaseParty,
      daysToRouteToALPostMoveout,
    } = this.props,
  ) {
    const commDivs = [];
    let lastDate;
    const { typingIndicatorThresholdFinish } = this.state;

    (communications || []).forEach((comm, index) => {
      const { direction, message, created_at } = comm;

      const failureNotice = getFailureNotice(message);
      const bounceMessage = getSMSFailMessage(comm, persons);

      const isOwner = direction === DALTypes.CommunicationDirection.OUT;
      if (!lastDate || !isSameDay(lastDate, comm.created_at, { timezone })) {
        commDivs.push(
          <div key={formatDay(comm.created_at, timezone)}>
            <Divider label={formatDay(comm.created_at, timezone)} />
          </div>,
        );
        lastDate = comm.created_at;
      }

      const shouldShowTypingIndicator =
        caiEnabled &&
        index === communications.length - 1 &&
        direction === DALTypes.CommunicationDirection.IN &&
        now().diff(toMoment(created_at), 'seconds') < 5 &&
        !typingIndicatorThresholdFinish;

      commDivs.push(
        <div key={comm.id}>
          <SmsMessage
            isOwner={isOwner}
            timezone={timezone}
            time={comm.created_at}
            content={message.text || ''}
            sentBy={this.getCommSender(comm)}
            failureNotice={failureNotice}
            bounceMessage={bounceMessage}
            shouldShowTypingIndicator={shouldShowTypingIndicator}
            attachaments={message.attachaments || []}
          />
        </div>,
      );
    });

    const members = partyMembers.filter(pm => persons.find(pers => pm.personId === pers.id));
    const recipientsMap = members.reduce((acc, item) => {
      const person = persons.find(p => p.id === item.personId);
      const phones = person.contactInfo.phones;
      const supportedSmsPhones = phones.filter(phone => !!phone.metadata.sms);
      const newItems = supportedSmsPhones.length
        ? supportedSmsPhones.map(phone => ({
            id: phone.id,
            memberType: item.memberType,
            name: getDisplayName(person),
            value: formatPhone(phone.value),
            isPrimary: phone.isPrimary,
          }))
        : [
            {
              memberType: item.memberType,
              name: getDisplayName(person),
              value: t('PHONE_MISSING'),
              disabled: true,
              id: person.id,
            },
          ];
      acc.set(item.memberType, {
        id: item.memberType,
        name: item.memberType,
        items: [...((acc.get(item.memberType) || {}).items || []), ...newItems],
      });
      return acc;
    }, new Map());
    const recipients = [...recipientsMap.values()];
    const smsPlaceholderMessage = getCommunicationPlaceholderMessage({ areCommsDisabled, isActiveLeaseParty, isEmail: false, daysToRouteToALPostMoveout });

    return (
      <TemplateExpander
        className={cf('expander')}
        partyId={partyId}
        propertyId={propertyId}
        onExpand={this.resizeTextArea}
        context="sms"
        data={{ templateArgs }}>
        {({ renderProcessingStatus, renderErrorSection }) => (
          <div className={cf('mainContent')}>
            <div className={cf('messages-section')}>
              <RecipientsDropdown
                recipients={recipients}
                selectedRecipients={this.state.selectedRecipients}
                className={cf('recipients-section')}
                onChange={this.handleRecipientsChange}
                showListOnFocus={true}
                readOnly={areCommsDisabled}
              />
              <div className={cf('messages')} id="commsId" ref={node => (this.commsNode = node)}>
                {commDivs}
              </div>
              <div className={cf('form-section')}>
                {renderProcessingStatus()}
                {renderLoadingTemplateStatus && renderLoadingTemplateStatus()}
                <div className={cf('form')}>
                  <TextBox
                    id="smsToSend"
                    inputStyle={{ fontSize: '.8125rem' }}
                    disabled={!!this.props.disabledEdit || isPagePersonDetails()}
                    ref={e => (this.content = e)}
                    autoFocus
                    data-expansion-trigger={true}
                    multiline={true}
                    maxRows={6}
                    placeholder={smsPlaceholderMessage}
                    onEnterPress={this.handleSendMessage}
                    onFocus={this.onFocus}
                    onBlur={this.onBlur}
                    onChange={this.onChange}
                    value={this.props.draftContent || this.props.defaultValue}
                  />
                  <div
                    className={cf('send-button', {
                      disabled: this.state.sendBtnDisabled,
                    })}>
                    {!areCommsDisabled && <IconButton id="sendSms" iconName="send" disabled={this.state.sendBtnDisabled} onClick={this.handleSendMessage} />}
                  </div>
                </div>
              </div>
            </div>
            <NotificationBanner
              style={{ position: 'absolute', width: '100%', top: 0, left: 0 }}
              type="warning"
              visible={!!this.props.templateLoadError}
              closeable
              content={t('TEMPLATE_LOADING_FAILURE')}
              onCloseRequest={this.props.clearTemplateError}
            />
            {renderErrorSection({ style: { position: 'absolute', width: '100%', top: 0, left: 0 } })}
            <MsgBox
              open={this.state.discardChangesWarning}
              onCloseRequest={() => this.setState({ discardChangesWarning: false })}
              onOKClick={this.props.onClose}
              lblOK={t('DISCARD_CHANGES')}
              lblCancel={t('KEEP_EDITING')}
              title={'Discard message draft?'}
            />
          </div>
        )}
      </TemplateExpander>
    );
  }
}
