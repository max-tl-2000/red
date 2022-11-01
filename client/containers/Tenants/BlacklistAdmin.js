/*
 * Copyright (c) 2022 Reva Technology Inc., all rights reserved.
 * Unauthorized copying of this file, via any medium is strictly prohibited
 * Licensed under the Elastic License 2.0; you may not use this file except
 * in compliance with the Elastic License 2.0.
 */

import PropTypes from 'prop-types';
import React, { Component } from 'react';
import { t } from 'i18next';
import injectProps from 'helpers/injectProps';
import { connect } from 'react-redux';
import { bindActionCreators } from 'redux';
import { formatPhoneNumber } from 'helpers/strings';
import debounce from 'debouncy';
import { loadBlacklist, removeFromBlacklist } from 'redux/modules/blacklistStore';
import { RedTable, TwoPanelPage, LeftPanel, RightPanel, Section, FilterToolbar, Button, MsgBox, Typography } from 'components';
import { ClientConstants } from '../../helpers/clientConstants';
import { DALTypes } from '../../../common/enums/DALTypes';
import { cf } from './BlacklistAdmin.scss';
import { getDisplayName } from '../../../common/helpers/person-helper';
import { now, toMoment } from '../../../common/helpers/moment-utils';

const { Table, Cell, RowHeader, Row, TextPrimary } = RedTable;

const { Text } = Typography;

@connect(
  state => ({
    blacklist: state.blacklist.blacklist,
  }),
  dispatch =>
    bindActionCreators(
      {
        loadBlacklist,
        removeFromBlacklist,
      },
      dispatch,
    ),
)
export default class BlacklistAdmin extends Component {
  constructor() {
    super();
    this.state = {
      isUnblockDialogOpen: false,
      selectedBlacklistItem: {},
      filterText: '',
    };
  }

  static propTypes = {
    users: PropTypes.object,
    loadBlacklist: PropTypes.func,
    removeFromBlacklist: PropTypes.func,
  };

  getUserName = userId => userId && this.props.users && (this.props.users.get(userId) || {}).fullName;

  getPersonsDisplayData = persons => persons && persons.map(getDisplayName).join(', ');

  getFormattedPhoneNumber = text => (text ? formatPhoneNumber(text, null, 2) : '');

  getFormattedDisplayChannel = blacklistItem =>
    blacklistItem.type === DALTypes.ContactInfoType.PHONE ? this.getFormattedPhoneNumber(blacklistItem.value) : blacklistItem.value;

  getLastContactFormattedValue = lastContactDate => {
    if (now().isSame(toMoment(lastContactDate), 'day')) {
      return t('DATETIME_TODAY');
    }
    const daysAgo = now().diff(lastContactDate, 'days');
    return daysAgo > 1 ? `${daysAgo} ${t('BLACKLIST_LAST_CONTACT_DAYS_AGO')}` : `${daysAgo} ${t('BLACKLIST_LAST_CONTACT_DAY_AGO')}`;
  };

  onUnblockClicked = blacklistItem => {
    this.setState({
      selectedBlacklistItem: blacklistItem,
      isUnblockDialogOpen: true,
    });
  };

  handleUnblockContactInfo = blacklistItem => {
    const { type, value } = blacklistItem;
    type && value && this.props.removeFromBlacklist(type, value);
  };

  onTextChange = debounce(
    filterText => {
      this.setState({ filterText });
    },
    ClientConstants.SEARCH_DEBOUNCE_INTERVAL,
    this,
  );

  componentWillMount = () => {
    this.props.loadBlacklist();
  };

  renderUnblockDialog = () => {
    const { selectedBlacklistItem } = this.state;
    const currentChannel = selectedBlacklistItem && this.getFormattedDisplayChannel(selectedBlacklistItem);
    return (
      <MsgBox
        ref="blockContactDialog"
        open={this.state.isUnblockDialogOpen}
        closeOnTapAway={false}
        lblOK={t('UNBLOCK')}
        onOKClick={() => this.handleUnblockContactInfo(selectedBlacklistItem)}
        title={t('NOT_SPAM_CONFIRMATION')}
        onCloseRequest={() => this.setState({ isUnblockDialogOpen: false })}>
        <Text inline bold>
          {t('NOT_SPAM_CHANNEL', { channel: currentChannel })}{' '}
        </Text>
        <Text inline>{` ${t('NOT_SPAM_CAN_BE_USED')}`}</Text>
        <div className={cf('unblock-spam-dialog')}>
          <Text inline>{t('NOT_SPAM_FUTURE_COMMUNICATION_FROM')}</Text>
          <Text inline bold>{` ${t('NOT_SPAM_CHANNEL', {
            channel: currentChannel,
          })} `}</Text>
          <Text inline>{t('NOT_SPAM_FUTURE_COMMUNICATION_ROUTED')}</Text>
        </div>
      </MsgBox>
    );
  };

  renderRow = blacklistItem => (
    <Row key={`row-${blacklistItem.value}`}>
      <Cell width={'25%'}>
        <TextPrimary inline>{this.getFormattedDisplayChannel(blacklistItem)}</TextPrimary>
      </Cell>
      <Cell width={'10%'}>
        <TextPrimary inline>{blacklistItem.type}</TextPrimary>
      </Cell>
      <Cell>
        <TextPrimary inline>{this.getPersonsDisplayData(blacklistItem.persons)}</TextPrimary>
      </Cell>
      <Cell>
        <TextPrimary inline>{this.getLastContactFormattedValue(blacklistItem.lastContact)}</TextPrimary>
      </Cell>
      <Cell>
        <TextPrimary inline>{blacklistItem.messageCount}</TextPrimary>
      </Cell>
      <Cell>
        <TextPrimary inline>{this.getUserName(blacklistItem.markedAsSpamBy)}</TextPrimary>
      </Cell>
      <Cell>
        <Button id="btnUnblock" type="flat" onClick={() => this.onUnblockClicked(blacklistItem)} label={t('UNBLOCK')} />
      </Cell>
    </Row>
  );

  @injectProps
  render({ blacklist }) {
    const blacklistItems = blacklist && blacklist.filter(item => item && item.value.includes(this.state.filterText));

    return (
      <div>
        <TwoPanelPage>
          <LeftPanel>
            <Section className={cf('filterToolbarSection')}>
              <FilterToolbar textValue={this.state.filterText} textPlaceholder={t('BLACKLIST_SEARCH')} onTextChange={({ value }) => this.onTextChange(value)} />
            </Section>
            <Section padContent={false}>
              <Table>
                <RowHeader>
                  <Cell width={'25%'}>{t('BLACKLIST_CHANNEL')}</Cell>
                  <Cell width={'10%'}>{t('BLACKLIST_TYPE')}</Cell>
                  <Cell>{t('BLACKLIST_ASSOCIATED_PERSON')}</Cell>
                  <Cell>{t('BLACKLIST_LAST_CONTACT')}</Cell>
                  <Cell>{t('BLACKLIST_MESSAGE_COUNT')}</Cell>
                  <Cell>{t('BLACKLIST_MARKED_BY')}</Cell>
                  <Cell>{t(' ')}</Cell>
                </RowHeader>
                {blacklistItems && blacklistItems.map(item => this.renderRow(item))}
              </Table>
            </Section>
          </LeftPanel>
          <RightPanel />
        </TwoPanelPage>
        {this.renderUnblockDialog()}
      </div>
    );
  }
}
