/*
 * Copyright (c) 2022 Reva Technology Inc., all rights reserved.
 * Unauthorized copying of this file, via any medium is strictly prohibited
 * Licensed under the Elastic License 2.0; you may not use this file except
 * in compliance with the Elastic License 2.0.
 */

import PropTypes from 'prop-types';
import React, { Component } from 'react';
import { MsgBox, Typography, RedTable, Radio } from 'components';
import { t } from 'i18next';
import { sendQuoteMail } from 'redux/modules/quotes';
import { bindActionCreators } from 'redux';
import { connect } from 'react-redux';
import { cf } from './SendRenewalLetterDialog.scss';
import { DALTypes } from '../../../common/enums/DALTypes';
import { CommunicationContext } from '../../../common/enums/communicationTypes';

const { Text } = Typography;

const { Table, Row, RowHeader, Cell, TextPrimary, SubTitle } = RedTable;

const selectionValues = {
  SMS: 'sms',
  EMAIL: 'email',
  NONE: 'none',
};

@connect(
  state => ({
    quotes: state.quotes.quotes,
  }),
  dispatch =>
    bindActionCreators(
      {
        sendQuoteMail,
      },
      dispatch,
    ),
)
export default class SendRenewalLetterDialog extends Component {
  static propTypes = {
    handleShowDialog: PropTypes.func,
    sendQuoteMail: PropTypes.func,
  };

  constructor(props) {
    super(props);
    const { partyMembers } = props;
    const residentPartyMembers = partyMembers.filter(pm => pm.memberType === DALTypes.MemberType.RESIDENT);

    this.state = { residentPartyMembers, selectedValues: this.createSelectionModel(residentPartyMembers) };
  }

  createSelectionModel = partyMembers =>
    partyMembers.reduce((acc, member) => {
      const { emails, phones } = member?.person?.contactInfo;
      acc[member.id] = (!!emails.length && selectionValues.EMAIL) || (!!phones.length && selectionValues.SMS) || selectionValues.NONE;
      return acc;
    }, {});

  renderResidentMembersRows = () => {
    const { residentPartyMembers } = this.state;

    return (
      <div>
        <Row key={DALTypes.MemberType.RESIDENT} noDivider>
          <Cell noSidePadding>
            <SubTitle>{t('RESIDENTS')}</SubTitle>
          </Cell>
        </Row>
        {residentPartyMembers.map(pm => this.renderResidentMemberRow(pm))}
      </div>
    );
  };

  renderResidentMemberRow = member => {
    const { selectedValues } = this.state;

    const key = member.id;
    const memberFullName = member?.person?.fullName;
    const { emails, phones } = member?.person?.contactInfo;

    return (
      <Row key={key} noDivider>
        <Cell noSidePadding>
          <TextPrimary>{memberFullName}</TextPrimary>
        </Cell>
        <Cell noSidePadding width={90} className={cf('renewal-letter-cell')}>
          <Radio
            checked={selectedValues[key] === selectionValues.NONE}
            onChange={() => this.setState({ selectedValues: { ...selectedValues, [key]: selectionValues.NONE } })}
          />
        </Cell>
        <Cell noSidePadding width={90} className={cf('renewal-letter-cell')}>
          <Radio
            checked={selectedValues[key] === selectionValues.EMAIL}
            disabled={!emails.length}
            onChange={() => this.setState({ selectedValues: { ...selectedValues, [key]: selectionValues.EMAIL } })}
          />
        </Cell>
        <Cell noSidePadding width={90} className={cf('renewal-letter-cell')}>
          <Radio
            checked={selectedValues[key] === selectionValues.SMS}
            disabled={!phones.length}
            onChange={() => this.setState({ selectedValues: { ...selectedValues, [key]: selectionValues.SMS } })}
          />
        </Cell>
      </Row>
    );
  };

  handleCloseDialog = () => {
    const { handleShowDialog } = this.props;
    handleShowDialog && handleShowDialog(false);
  };

  getLastPublishedQuoteId = quotes => quotes.find(quote => quote.publishDate).id;

  handleSendCommunications = () => {
    const { quotes, partyId } = this.props;
    const { residentPartyMembers, selectedValues } = this.state;
    const quoteId = this.getLastPublishedQuoteId(quotes);

    const { personIdsToSendEmail, personIdsToSendSMS } = residentPartyMembers.reduce(
      (acc, resident) => {
        if (selectedValues[resident.id] === selectionValues.EMAIL) {
          acc.personIdsToSendEmail.push(resident.personId);
        }
        if (selectedValues[resident.id] === selectionValues.SMS) {
          acc.personIdsToSendSMS.push(resident.personId);
        }
        return acc;
      },
      { personIdsToSendEmail: [], personIdsToSendSMS: [] },
    );

    personIdsToSendEmail.length && this.props.sendQuoteMail({ quoteId, partyId, context: CommunicationContext.PREFER_EMAIL, personIds: personIdsToSendEmail });
    personIdsToSendSMS.length && this.props.sendQuoteMail({ quoteId, partyId, context: CommunicationContext.PREFER_SMS, personIds: personIdsToSendSMS });

    this.handleCloseDialog();
  };

  render() {
    const { open } = this.props;
    return (
      <MsgBox
        open={open}
        overlayClassName={cf('send-renewal-letter-dialog')}
        title={t('SEND_RENEWAL_QUOTE')}
        lblOK={t('SEND')}
        onCloseRequest={() => this.handleCloseDialog()}
        onOKClick={() => this.handleSendCommunications()}
        onCancelClick={() => this.handleCloseDialog()}>
        <Text>{t('LETTER_WILL_BE_EMAILED')}</Text>
        <Text className={cf('add-margin-top')}>{t('SEND_A_TEXT_MESSAGE')}</Text>
        <Table wide>
          <RowHeader>
            <Cell noSidePadding />
            <Cell noSidePadding width={90} className={cf('renewal-letter-cell')}>
              <SubTitle>{t('DO_NOT_SEND')}</SubTitle>
            </Cell>
            <Cell noSidePadding width={90} className={cf('renewal-letter-cell')}>
              <SubTitle>{t('CE_TYPE_EMAIL')}</SubTitle>
            </Cell>
            <Cell noSidePadding width={90} className={cf('renewal-letter-cell')}>
              <SubTitle>{t('CE_TYPE_SMS')}</SubTitle>
            </Cell>
          </RowHeader>
          {this.renderResidentMembersRows()}
        </Table>
      </MsgBox>
    );
  }
}
