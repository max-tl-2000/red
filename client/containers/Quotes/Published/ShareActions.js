/*
 * Copyright (c) 2022 Reva Technology Inc., all rights reserved.
 * Unauthorized copying of this file, via any medium is strictly prohibited
 * Licensed under the Elastic License 2.0; you may not use this file except
 * in compliance with the Elastic License 2.0.
 */

import PropTypes from 'prop-types';
import React, { Component } from 'react';
import { IconButton, FlyOutOverlay, FlyOut, Icon, DialogHeaderActions, AutoSize, Typography as T } from 'components';
import { printQuote } from 'redux/modules/quotes';
import { bindActionCreators } from 'redux';
import { connect } from 'react-redux';
import injectProps from 'helpers/injectProps';

import { t } from 'i18next';
const { SubHeader } = T;
import { DALTypes } from '../../../../common/enums/DALTypes';
import { cf, g } from './ShareActions.scss';
import { SMS_THREAD, NEW_EMAIL } from '../../../helpers/comm-flyout-types';
import { computeThreadId } from '../../../../common/helpers/utils';
import { personHasValidSMSNumber } from '../../../../common/helpers/contactInfoUtils';
import { CommunicationContext } from '../../../../common/enums/communicationTypes';
import { shouldEnableQuoteAction } from '../../../../common/inventory-helper';
import { TemplateNames } from '../../../../common/enums/templateTypes';

@connect(
  (state, props) => ({
    emailError: state.quotes.emailError,
    emailSuccess: state.quotes.emailSuccess,
    loggedInUser: state.auth.user,
    quoteActionEnabled: shouldEnableQuoteAction(props.inventory || {}, { leaseState: props.quote?.leaseState }),
  }),
  dispatch =>
    bindActionCreators(
      {
        printQuote,
      },
      dispatch,
    ),
)
export default class ShareActions extends Component {
  static propTypes = {
    partyId: PropTypes.string,
    partyMembers: PropTypes.object,
    isQuoteExpired: PropTypes.bool,
    inventory: PropTypes.object,
    emailError: PropTypes.string,
    emailSuccess: PropTypes.string,
    quoteFrameId: PropTypes.string,
    quote: PropTypes.object,
    printQuote: PropTypes.func,
    templateData: PropTypes.object,
    onDuplicateClick: PropTypes.func,
  };

  get membersNames() {
    const { partyMembers } = this.props;

    return (partyMembers || [])
      .reduce((acc, member) => {
        const memberName = member.preferredName;
        acc.push(memberName);
        return acc;
      }, [])
      .join(', ');
  }

  handlePrint = () =>
    this.props.printQuote({
      ...this.props.quote,
      partyId: this.props.partyId,
      inventoryName: this.props.inventory.name,
      quoteFrameId: this.props.quoteFrameId,
    });

  handleSMS = () => {
    const {
      partyMembers,
      quote: { id: quoteId },
      isRenewal,
      inventory,
    } = this.props;
    const recipients = partyMembers.map(p => p.person).toArray();

    const validPersons = recipients
      .filter(p => p.contactInfo.phones.length)
      .map(p => p.id)
      .sort();

    const propertyTemplate = isRenewal
      ? {
          propertyId: inventory.property.id,
          section: 'QUOTE',
          action: 'RENEWAL_LETTER',
        }
      : undefined;

    this.props.openCommFlyOut({
      flyoutType: SMS_THREAD,
      props: {
        type: DALTypes.CommunicationMessageType.SMS,
        threadId: computeThreadId(DALTypes.CommunicationMessageType.SMS, validPersons),
        defaultText: this.props.defaultText,
        useSendQuoteMail: true, // TODO: This boolean will not be needed when all the templates are ready
        sendQuoteMailArgs: {
          context: CommunicationContext.PREFER_SMS,
          quoteId,
          propertyTemplate,
          templateName: !isRenewal ? TemplateNames.AGENT_TO_RESIDENT_QUOTE_TEMPLATE : TemplateNames.AGENT_TO_RESIDENT_RENEWAL_LETTER_TEMPLATE,
          templateArgs: { quoteId, inventoryId: inventory.id, personId: recipients?.[0]?.id },
        },
        templateData: this.props.templateData,
        recipients,
        partyMembers,
      },
    });
  };

  sendQuoteEmail = () => {
    const {
      quote: { id: quoteId },
      partyMembers,
    } = this.props;

    this.props.openCommFlyOut({
      flyoutType: NEW_EMAIL,
      props: {
        type: DALTypes.CommunicationMessageType.EMAIL,
        sendQuoteMailArgs: {
          context: CommunicationContext.PREFER_EMAIL,
          quoteId,
        },
        templateData: { id: quoteId, subject: ' ' }, // TODO: Remove this when we inject the mjml templates to the Flyout
        visibleElements: [],
        partyMembers,
      },
    });
  };

  renderComboActions = ({ quoteActionEnabled, onDuplicateClick } = this.props) => (
    <FlyOutOverlay container={false} className={cf('combo-actions')}>
      <ul>
        <li>
          <SubHeader disabled={!quoteActionEnabled} onClick={() => quoteActionEnabled && onDuplicateClick()}>
            {t('DUPLICATE_QUOTE')}
          </SubHeader>
        </li>
        {/* TODO We have a separate story in v3 to implement the full hold functionality
        <li className={ cf('hide') }>
          <SubHeader>{ t('HOLD_UNIT') }</SubHeader>
        </li> */}
      </ul>
    </FlyOutOverlay>
  );

  @injectProps
  renderLoose() {
    const { isRenewal, isQuoteExpired, partyMembers } = this.props;
    const boxStyle = cf('commBox');
    const persons = partyMembers.map(p => p.person);
    const atLeastOnePersonHasSMSNos = persons.find(m => personHasValidSMSNumber(m));
    const noMembersHaveEmailAddresses = persons.every(m => !m.contactInfo.emails.length);
    return (
      <div className={boxStyle}>
        {!isQuoteExpired && [
          <IconButton
            key="email"
            iconName="email"
            className="commButton"
            iconStyle="light"
            disabled={noMembersHaveEmailAddresses}
            onClick={this.sendQuoteEmail}
          />,
          <IconButton
            key="message"
            iconName="message-text"
            className="commButton"
            iconStyle="light"
            disabled={!atLeastOnePersonHasSMSNos}
            onClick={this.handleSMS}
          />,
          <IconButton key="print" iconName="printer" className="commButton" iconStyle="light" onClick={this.handlePrint} />,
        ]}
        {!isRenewal && (
          <FlyOut expandTo="left-bottom" overTrigger={true}>
            <IconButton iconStyle="light" iconName="dots-vertical" />
            {this.renderComboActions()}
          </FlyOut>
        )}
      </div>
    );
  }

  @injectProps
  renderCompact() {
    const { isQuoteExpired, isRenewal } = this.props;
    return (
      <DialogHeaderActions>
        <div className={cf('commBox')}>
          {!isQuoteExpired && [
            <IconButton key="email" iconName="email" className="commButton" iconStyle="light" onClick={this.sendQuoteEmail} />,
            <FlyOut key="flyOut" expandTo="bottom">
              <Icon name="menu-down" iconStyle="light" />
              <FlyOutOverlay container={false} className={cf('dropdown')}>
                <IconButton iconName="message-text" className="commButton" onClick={this.handleSMS} />
                <IconButton iconName="printer" className="commButton" onClick={this.handlePrint} />
              </FlyOutOverlay>
            </FlyOut>,
          ]}
          {!isRenewal && (
            <FlyOut expandTo="left-bottom" overTrigger={true}>
              <IconButton iconStyle="light" iconName="dots-vertical" />
              {this.props.isQuoteExpired && this.renderComboActions()}
            </FlyOut>
          )}
        </div>
      </DialogHeaderActions>
    );
  }

  @injectProps
  render({ className }) {
    const theClasses = cf('wrapper', g(className));
    return (
      <AutoSize breakpoints={false} className={theClasses}>
        {({ width }) => (width < 200 ? this.renderCompact() : this.renderLoose())}
      </AutoSize>
    );
  }
}
