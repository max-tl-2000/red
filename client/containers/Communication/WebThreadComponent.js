/*
 * Copyright (c) 2022 Reva Technology Inc., all rights reserved.
 * Unauthorized copying of this file, via any medium is strictly prohibited
 * Licensed under the Elastic License 2.0; you may not use this file except
 * in compliance with the Elastic License 2.0.
 */

import PropTypes from 'prop-types';
import React, { Component } from 'react';
import { t } from 'i18next';
import { connect } from 'react-redux';
import { bindActionCreators } from 'redux';

import scrollIntoView from 'helpers/scrollIntoView';
import { formatPhoneNumber } from 'helpers/strings';
import CommunicationBox from 'custom-components/CommunicationBox/CommunicationBox';
import { GeminiScrollbar, Typography } from 'components';
import { initOutgoingCall } from 'redux/modules/telephony';
import { openFlyout } from 'redux/modules/flyoutStore';

import { getWebInquiryHeaderFromComm, getWebInquiryDescription, isWebInquiry } from 'helpers/communications';
import Linkify from 'components/Linkify/Linkify';
import { parseMessage } from 'helpers/parse-message';
import { logger } from 'client/logger';
import { NEW_EMAIL, SMS_THREAD } from '../../helpers/comm-flyout-types';
import { DALTypes } from '../../../common/enums/DALTypes';
import { cf } from './WebThreadComponent.scss';
import { toMoment } from '../../../common/helpers/moment-utils';

const { Text } = Typography;

@connect(
  state => ({
    user: state.auth.user,
    isUserBusy: state.usersStore.isAuthUserBusy,
  }),
  dispatch =>
    bindActionCreators(
      {
        initOutgoingCall,
        openFlyout,
      },
      dispatch,
    ),
)
export default class WebThreadComponent extends Component {
  static propTypes = {
    communications: PropTypes.array,
    participant: PropTypes.object,
  };

  getMessagesFromComms = comms =>
    (comms &&
      comms
        .sort((a, b) => toMoment(a.created_at).diff(toMoment(b.created_at)))
        .map(c => ({
          text: c.message.text,
          timeStamp: c.created_at,
          validationMessages: c.message.validationMessages,
          html: parseMessage(c.message).html,
        }))) ||
    [];

  constructor(props) {
    super(props);

    const { communications } = props;
    const [comm] = communications;
    const partyId = comm && comm.parties[0];

    this.state = {
      messages: this.getMessagesFromComms(props.communications),
      partyId,
    };
  }

  scrollToLastMessage = () => this.messagesSection && scrollIntoView(this.messagesSection.lastChild);

  componentDidMount() {
    this.scrollToLastMessage();
  }

  componentDidUpdate() {
    this.scrollToLastMessage();
  }

  componentWillReceiveProps(nextProps) {
    this.setState({
      messages: this.getMessagesFromComms(nextProps.communications),
    });
  }

  handleOnOpenCallFlyout = () => {
    const { participant } = this.props;

    this.props.initOutgoingCall({
      fullName: participant.fullName,
      phone: participant.contactInfo.defaultPhone,
      personId: participant.id,
      partyId: this.state.partyId,
    });
  };

  handleOnOpenSmsFlyout = () => {
    const { participant } = this.props;

    this.props.openFlyout(SMS_THREAD, {
      type: DALTypes.CommunicationMessageType.SMS,
      recipients: [participant],
      partyId: this.state.partyId,
    });
  };

  handleOnOpenEmailFlyout = () => {
    const { participant, communications } = this.props;

    const subject = getWebInquiryHeaderFromComm(communications[0]);

    this.props.openFlyout(NEW_EMAIL, {
      type: DALTypes.CommunicationMessageType.EMAIL,
      recipients: [participant],
      subject,
      partyId: this.state.partyId,
    });
  };

  renderValidationMessages = validationMessages => (
    <div>
      <br />
      <br />
      <Text>{validationMessages}</Text>
    </div>
  );

  renderMessages() {
    const { messages } = this.state;
    const { communications } = this.props;

    if (!messages.length) return <noscript />;

    const msgs =
      messages.length > 1 ? (
        messages.map(({ text, html, timeStamp, validationMessages }) => (
          <div key={timeStamp} className={cf('message-text')}>
            {!html && <Linkify>{text}</Linkify>}
            {html && <div className={cf('htmlContent')} dangerouslySetInnerHTML={{ __html: html }} />}
            {validationMessages && this.renderValidationMessages(validationMessages)}
          </div>
        ))
      ) : (
        <div>
          {!messages[0].html && <Linkify>{messages[0].text}</Linkify>}
          {messages[0].html && <div className={cf('htmlContent')} dangerouslySetInnerHTML={{ __html: messages[0].html }} />}
          {messages[0].validationMessages && this.renderValidationMessages(messages[0].validationMessages)}
        </div>
      );

    const webInquiryDescription = isWebInquiry(communications[0]) ? getWebInquiryDescription(communications[0], this.props.timezone) : '';

    return (
      <div>
        <Text secondary data-id="webThreadMessageLabel" className={cf('message-label')}>
          {webInquiryDescription}
        </Text>
        <GeminiScrollbar data-id="webThreadMessageBody" className={cf('message-body')}>
          <div ref={c => (this.messagesSection = c)}>{msgs}</div>
        </GeminiScrollbar>
      </div>
    );
  }

  render() {
    let { participant } = this.props;
    const { isUserBusy } = this.props;

    // when participant is not provided this components produces a TypeError which
    // prevents the prospect page from being shown. As shown in this FullStory https://fsty.io/v/KLyYdUu

    if (!participant) {
      // not sure under which circunstances a participant might not be available
      // Adding some logs here to try to gather a bit more of info
      // these messages will be visible in the application logs and in FS
      logger.error({ props: this.props }, 'participant was not found');
      participant = {};
    }

    let { contactInfo } = participant;

    if (!contactInfo) {
      logger.error({ props: this.props }, 'contactInfo was not found');
      contactInfo = { phones: [], emails: [] };
    }

    const participantHasNoPhone = !contactInfo.phones.length;
    const participantHasNoEmail = !contactInfo.emails.length;

    return (
      <div className={cf('main')}>
        <div className={cf('message')}>
          <div data-id="webThreadMessageHeader" className={cf('message-header')}>
            <div>
              <Text inline secondary>
                {t('NAME')}:{' '}
              </Text>
              <Text inline>{participant.fullName}</Text>
            </div>
            <div>
              <Text inline secondary>
                {t('EMAIL')}:{' '}
              </Text>
              <Text inline>{contactInfo.defaultEmail}</Text>
            </div>
            <div>
              <Text inline secondary>
                {t('PHONE')}:{' '}
              </Text>
              <Text inline>{contactInfo.defaultPhone && formatPhoneNumber(contactInfo.defaultPhone)}</Text>
            </div>
          </div>
          {this.renderMessages()}
        </div>
        <CommunicationBox
          className={cf('communication-box')}
          commBoxClassName={cf('commBox')}
          iconsStyle="light"
          callDisabled={participantHasNoPhone || isUserBusy}
          messageDisabled={participantHasNoPhone}
          mailDisabled={participantHasNoEmail}
          onCall={this.handleOnOpenCallFlyout}
          onMessage={this.handleOnOpenSmsFlyout}
          onMail={this.handleOnOpenEmailFlyout}
        />
      </div>
    );
  }
}
