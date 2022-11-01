/*
 * Copyright (c) 2022 Reva Technology Inc., all rights reserved.
 * Unauthorized copying of this file, via any medium is strictly prohibited
 * Licensed under the Elastic License 2.0; you may not use this file except
 * in compliance with the Elastic License 2.0.
 */

import React, { Component } from 'react';
import { observer, inject } from 'mobx-react';
import { Typography, Button, PreloaderBlock } from 'components';
import { t } from 'i18next';
import capitalize from 'lodash/capitalize';
import { partyFromRaw } from '../../../common/helpers/party-utils.js';
import { cf } from './NavigationHistory.scss';
import { DALTypes } from '../../../common/enums/DALTypes';
import { SHORT_DATE_FORMAT, TIME_PERIOD_FORMAT, MONTH_DATE_YEAR_FORMAT } from '../../../common/date-constants';
import NavigationHistoryCard from './NavigationHistoryCards/NavigationHistoryCard';
import { getLeadScoreIcon, getLeadScore } from '../../helpers/leadScore';
import { formatUnitCardInfo, getMoveInDateSummary } from '../../helpers/unitsUtils';

import { getDisplayName } from '../../../common/helpers/person-helper';
import { now, toMoment } from '../../../common/helpers/moment-utils';

const { Text, Caption } = Typography;

@inject('leasingNavigator')
@observer
export default class NavigationHistory extends Component {
  getFormattedDate = date => {
    const today = now();
    const inputDate = toMoment(date);
    if (today.isSame(inputDate, 'day')) return inputDate.format(TIME_PERIOD_FORMAT);
    return inputDate.format(inputDate.isSame(today, 'year') ? SHORT_DATE_FORMAT : MONTH_DATE_YEAR_FORMAT);
  };

  getDefaultGuestName = party => {
    const partyMembers = party.partyMembers.filter(m => m.memberType === DALTypes.MemberType.RESIDENT || m.memberType === DALTypes.MemberType.OCCUPANT);
    return partyFromRaw(partyMembers).defaultGuestFullName;
  };

  getMemberNames = party =>
    partyFromRaw(party.partyMembers)
      .orderedGuests.map(person => getDisplayName(person))
      .join(', ');

  getUnitName = unit => `${capitalize(unit.type)} ${unit.name}`;

  getUnitDetails = unit => {
    const unitInfo = formatUnitCardInfo(unit);
    return unitInfo.unitDetails;
  };

  getMoveInDateOrRange = party => {
    const { timezone, moveInDate, moveInDateRange } = party;
    if (moveInDate) {
      return toMoment(moveInDate, { timezone }).format(MONTH_DATE_YEAR_FORMAT);
    }
    return getMoveInDateSummary(moveInDateRange, { timezone });
  };

  handleSearch = () => {
    this.props.leasingNavigator.navigateToSearch();
  };

  getViewModel = entry => {
    const { leasingNavigator } = this.props;
    // TODO: not sure why we don't just pass the party and use the same viewModel as the one for the cards
    switch (entry.type) {
      case DALTypes.NavigationHistoryType.PARTY:
        return {
          key: entry.entity.id,
          title: this.getMemberNames(entry.entity),
          firstLine: entry.entity.propertyName,
          secondLine: this.getMoveInDateOrRange(entry.entity),
          date: this.getFormattedDate(entry.date),
          score: getLeadScore(entry.entity.score),
          scoreIcon: getLeadScoreIcon(entry.entity.score),
          defaultGuestName: this.getDefaultGuestName(entry.entity),
          isClosed: !!entry.entity.endDate,
          qualificationQuestions: entry.qualificationQuestions,
          partyMembers: entry.partyMembers,
          onClick: () => leasingNavigator.navigateToParty(entry.entity.id),
        };
      case DALTypes.NavigationHistoryType.PERSON:
        return {
          title: getDisplayName(entry.entity),
          date: this.getFormattedDate(entry.date),
          defaultGuestName: getDisplayName(entry.entity), // why is this value the same as the value above?
          onClick: () => leasingNavigator.navigateToPerson(entry.entity.id),
        };
      case DALTypes.NavigationHistoryType.UNIT:
        return {
          title: this.getUnitName(entry.entity),
          firstLine: this.getUnitDetails(entry.entity),
          secondLine: t(entry.entity.state),
          date: this.getFormattedDate(entry.date),
          onClick: () => leasingNavigator.navigateToInventory(entry.entity.id),
        };
      default:
        return {};
    }
  };

  getViewModels = navigationHistoryList => navigationHistoryList.map(item => this.getViewModel(item));

  renderHeader = items =>
    items.length ? (
      <div className={cf('header')}>
        <Caption secondary>{t('RECENT')}</Caption>
      </div>
    ) : (
      <div />
    );

  renderHistoryList = items => (items.length ? <div className={cf('historyList')}>{items}</div> : <div />);

  renderFooter = (items, isLoading) => {
    if (items.length) {
      return (
        <div className={cf('footer')}>
          <Text secondary>{t('USE_SEARCH')}</Text>
          <Button label={t('SEARCH_LINK')} onClick={this.handleSearch} type="flat" />
        </div>
      );
    }
    return (
      <div className={cf('footerContainer', { onLoad: isLoading, historyReady: !isLoading })}>
        <Text secondary>{t('EMPTY_HISTORY')}</Text>
        <div className={cf('footerContainerForEmptyHistory')}>
          <Text secondary>{t('USE')}</Text>
          <Button label={t('SEARCH_LINK')} onClick={this.handleSearch} type="flat" />
        </div>
      </div>
    );
  };

  render({ navigationHistory, isLoading } = this.props) {
    const viewModels = this.getViewModels(navigationHistory);
    const items = viewModels.map((entry, index) => <NavigationHistoryCard key={entry.key} entity={{ ...entry, index }} />);
    return (
      <div className={cf('container')}>
        {isLoading && <PreloaderBlock />}
        {!isLoading && this.renderHeader(items)}
        {!isLoading && this.renderHistoryList(items)}
        {this.renderFooter(items, isLoading)}
      </div>
    );
  }
}
