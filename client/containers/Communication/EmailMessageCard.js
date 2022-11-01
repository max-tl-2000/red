/*
 * Copyright (c) 2022 Reva Technology Inc., all rights reserved.
 * Unauthorized copying of this file, via any medium is strictly prohibited
 * Licensed under the Elastic License 2.0; you may not use this file except
 * in compliance with the Elastic License 2.0.
 */

import PropTypes from 'prop-types';
import React, { Component } from 'react';
import { findDOMNode } from 'react-dom';
import { connect } from 'react-redux';
import { bindActionCreators } from 'redux';
import { logPrintAction } from 'redux/modules/communication';
import { t } from 'i18next';
import { formatTimestamp } from 'helpers/date-utils';
import { parseMessage } from 'helpers/parse-message';
import Validator from 'components/Validator/Validator';
import { getEmailBounceMessage } from 'helpers/communications';
import { createSelector } from 'reselect';
import Linkify from 'components/Linkify/Linkify';
import { fetchResults as searchPersons } from 'redux/modules/personsStore';
import trim from 'helpers/trim';
import { windowOpen } from 'helpers/win-open';
import $ from 'jquery';
import { Avatar, Typography, CardMenu, CardMenuItem } from 'components';
import { getDisplayName } from '../../../common/helpers/person-helper';
import EmailAttachmentChip from './EmailAttachmentChip';
import BlockContactDialog from './BlockContactDialog';
import { DALTypes } from '../../../common/enums/DALTypes';
import { cf } from './EmailMessageCard.scss';
import Frame from '../../custom-components/Frame/Frame';
import { editorDefaultFontFamily, editorDefaultFontSize } from '../../components/FroalaEditor/config';

const { Text, Caption } = Typography;

const getBounceMessage = createSelector(
  (state, props) => props.communication,
  (state, props) => props.participants,
  (communication, participants) => getEmailBounceMessage(communication, participants),
);

@connect(
  (state, props) => ({
    bounceMessage: getBounceMessage(state, props),
    users: state.globalStore.get('users'),
  }),
  dispatch =>
    bindActionCreators(
      {
        logPrintAction,
        searchPersons,
      },
      dispatch,
    ),
)
export default class EmailMessageCard extends Component {
  static propTypes = {
    persons: PropTypes.object,
    participants: PropTypes.object,
    communication: PropTypes.object,
    currentUser: PropTypes.object,
    users: PropTypes.object,
    userToken: PropTypes.string,
    onMarkAsSpam: PropTypes.func,
    searchPersons: PropTypes.func,
  };

  constructor(props) {
    super(props);
    this.state = {
      isBlockSenderDialogOpen: false,
    };
  }

  searchUser = (userId = '') => {
    const { users } = this.props;
    return users.find(u => u.id === userId);
  };

  handlePrint = async communication => {
    const personSearch = await this.props.searchPersons({
      emails: communication.message?.from,
    });
    const user = this.searchUser(communication.userId) || {};
    const [party] = communication?.parties || [];
    const url = `${window.location.origin}/friendlyPrint/party/${party}/comm/${communication.id}/autoprint`;
    const fullName = communication.direction === DALTypes.CommunicationDirection.IN ? personSearch[0]?.fullName : user.fullName;
    windowOpen(url);
    this.props.logPrintAction({
      communication,
      fullName,
    });
  };

  getCommSenderAsUser = comm => {
    if (comm.userId === this.props.currentUser.id) {
      return t('ME');
    }

    const user = this.props.users.find(item => item.id === comm.userId);

    if (!user) {
      throw new Error(`Cannot find user with provided id ${comm.userId}`);
    }

    return user.fullName;
  };

  getSenderObject = comm => {
    if (comm.direction === DALTypes.CommunicationDirection.OUT) {
      return this.props.users.find(item => item.id === comm.userId);
    }
    if (comm.direction === DALTypes.CommunicationDirection.IN) {
      const [senderPersonIdFromComm] = comm.persons;
      return this.props.persons.find(person => person.id === senderPersonIdFromComm) || {};
    }
    return {};
  };

  getToAndFrom = (communication, participants, persons) => {
    let from;
    let to;
    if (communication.direction === DALTypes.CommunicationDirection.OUT) {
      from = this.getCommSenderAsUser(communication);
      to = participants.map(p => getDisplayName(p)).join();
    } else if (communication.direction === DALTypes.CommunicationDirection.IN) {
      const [senderPersonIdFromComm] = communication.persons;
      const sender = persons.find(person => person.id === senderPersonIdFromComm) || {};

      from = sender.fullName;

      const participantsNames = participants.filter(p => p.id !== sender.id).map(p => p.fullName);
      const otherToEmailAddresses = communication?.message?.otherToIdentifiers || [];

      const recipientsText = [...participantsNames.toArray(), ...otherToEmailAddresses].join(', ');

      to = recipientsText.length ? `${t('ME')}, ${recipientsText}` : t('ME');
    }
    return { from, to };
  };

  shouldDisplayOverflow = (comm, shouldDisplayPrintBtn) => comm.userId !== this.props.currentUser.id || shouldDisplayPrintBtn;

  handleOpenBlockSender = () => {
    this.setState({
      isBlockSenderDialogOpen: true,
    });
  };

  handleBlockSender = contactInfo => {
    const emailContact = contactInfo.emails.find(e => e.id === contactInfo.defaultEmailId);
    const { onMarkAsSpam } = this.props;
    onMarkAsSpam && onMarkAsSpam(emailContact);
  };

  renderBlockSender = sender => {
    const open = this.state && this.state.isBlockSenderDialogOpen;
    const email = sender.contactInfo ? sender.contactInfo.defaultEmail : '';

    return (
      <BlockContactDialog
        open={open}
        fullName={sender.fullName || email}
        msgCommunicationFrom={t('FUTURE_EMAILS_FROM')}
        channel={email}
        onBlockContact={() => this.handleBlockSender(sender.contactInfo)}
        onCloseRequest={() => this.setState({ isBlockSenderDialogOpen: false })}
      />
    );
  };

  renderMessageHeader = communication => {
    const { participants, persons, timezone } = this.props;
    const { from, to } = this.getToAndFrom(communication, participants, persons);
    const sender = this.getSenderObject(communication);

    const cc = communication?.message?.rawMessage?.cc.join(', ');

    return (
      <div className={cf('header')}>
        <div className={cf('left-side-header')}>
          <Avatar className={cf('avatar')} userName={sender.fullName} src={sender.avatarUrl} />
          <div className={cf('recipients-details')}>
            <Text>{from}</Text>
            <div>
              <Caption secondary inline>
                {`${t('RECIPIENTS_TO')} `}
              </Caption>
              <Caption inline>{to}</Caption>
            </div>
            {!!cc && (
              <div>
                <Caption secondary inline>
                  {`${t('RECIPIENTS_CC')} `}
                </Caption>
                <Caption inline>{cc}</Caption>
              </div>
            )}
          </div>
        </div>
        <div className={cf('right-side-header')}>
          <Text>{formatTimestamp(communication.created_at, { timezone })}</Text>
          {/* TODO: Uncomment when CPM-7568 is ready */}
          <div className={this.shouldDisplayOverflow(communication, this.props.shouldDisplayPrintBtn) ? cf('overflow-visible') : cf('overflow-hidden')}>
            <CardMenu iconName="dots-vertical" iconStyle="dark">
              <CardMenuItem text={t('PRINT')} onClick={async () => await this.handlePrint(communication)} disabled={false} />
              {/* <CardMenuItem
                text={t('BLOCK_NAME', { name: sender.fullName || (sender.contactInfo && sender.contactInfo.defaultEmail) })}
                onClick={this.handleOpenBlockSender}
              /> */}
            </CardMenu>
          </div>

          {this.renderBlockSender(sender)}
        </div>
      </div>
    );
  };

  renderAttachments = message => {
    const { userToken } = this.props;
    const hasAttachements = message.files && message.files.length;

    return hasAttachements ? (
      message.files.map(file => <EmailAttachmentChip id={file.id} key={file.id} originalName={file.originalName || file.orginalname} userToken={userToken} />)
    ) : (
      <div />
    );
  };

  replaceLinkBySpan = link => {
    const span = document.createElement('span');
    span.innerHTML = link.innerHTML;
    const pn = link.parentNode;

    if (pn) {
      try {
        pn.replaceChild(span, link);
      } catch (err) {
        console.error('Error replacing link', err);
      }
    }
  };

  stripEmailTo() {
    if (!this.emailCardRef) return;

    const links = Array.from(this.emailCardRef.querySelectorAll('a'));

    links.forEach(link => {
      const href = trim(link.getAttribute('href'));
      // links for emails and phones can be :
      // - mailto:
      // - tel:
      if (!href || (!href.match(/^mailto:/) && !href.match(/^tel:/))) {
        // make all other links to open in a new target
        link.setAttribute('target', '_blank');
        return;
      }

      this.replaceLinkBySpan(link);
    });
  }

  disableActionLink = link => {
    const $link = $(link.firstChild);
    $link.css({ color: '#9f9f9f' });
    $link.closest('table').css({ background: '#dfdfdf', boxShadow: 'none' });
    this.replaceLinkBySpan(link);
  };

  disableActionsTemplate = (messageContext, searchExpression) => {
    if (this.actionsDisabled) return;
    const actionLinks = Array.from(messageContext.find(searchExpression));
    actionLinks.forEach(this.disableActionLink);
    this.actionsDisabled = !!actionLinks.length;
  };

  removeQuoteLink = messageContext => messageContext.find('p.contentForEmailCard > a').closest('table').remove();

  disableActions = () => {
    if (!this.emailCardRef) return;

    // TODO: Do not use findDOMNOde
    const $messageContext = $(findDOMNode(this)); // eslint-disable-line react/no-find-dom-node
    this.disableActionsTemplate($messageContext, 'a:contains("APPLY NOW")');
    this.removeQuoteLink($messageContext);
    this.disableActionsTemplate($messageContext, 'a:contains("OPEN APPLICATION")');
    this.disableActionsTemplate($messageContext, 'a:contains("REVIEW AND SIGN LEASE")');
    this.disableActionsTemplate($messageContext, 'a:contains("VIEW LEASE")');
  };

  sanitizeEmailbody = () => {
    this.disableActions();
    this.stripEmailTo();
  };

  componentDidMount() {
    this.sanitizeEmailbody();
  }

  componentDidUpdate() {
    this.sanitizeEmailbody();
  }

  storeRef = ref => {
    this.emailCardRef = ref;
  };

  render() {
    const { communication, bounceMessage } = this.props;
    const { storeRef } = this;

    const { html, text } = parseMessage(communication.message);

    const useText = !html;
    // adding body{margin:0px} to align the content with header
    const htmlWithReplacedStyle = html?.replace('<head>', '<head><style type="text/css">body{margin:0px}</style>');
    return (
      <div ref={storeRef} className={cf('card-content')}>
        {this.renderMessageHeader(communication)}
        {!!bounceMessage && (
          <div className={cf('bounce-warning')}>
            <Validator>
              <Caption error>{bounceMessage}</Caption>
            </Validator>
          </div>
        )}
        {htmlWithReplacedStyle && (
          <Frame
            content={htmlWithReplacedStyle}
            stretchToContentSize={true}
            style={{ border: 'none' }}
            bodyStyle={{ fontFamily: editorDefaultFontFamily, fontSize: `${editorDefaultFontSize}px`, margin: '0px' }}
          />
        )}
        {useText && <Linkify>{text}</Linkify>}
        <div className={cf('message-attachments')}>{this.renderAttachments(communication.message)}</div>
      </div>
    );
  }
}
