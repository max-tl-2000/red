/*
 * Copyright (c) 2022 Reva Technology Inc., all rights reserved.
 * Unauthorized copying of this file, via any medium is strictly prohibited
 * Licensed under the Elastic License 2.0; you may not use this file except
 * in compliance with the Elastic License 2.0.
 */

import PropTypes from 'prop-types';
import React, { Component } from 'react';
import { t } from 'i18next';
import { Card, Typography as T, Avatar, Icon } from 'components';
import trim from 'helpers/trim';
import { getPartyStateToDisplay, partyIsNotActive, partyIsRenewalOrActiveLease } from 'helpers/party';
import { _highlightMatches } from '../../helpers/highlightMatches';
import { cf } from './PartyCard.scss';
import injectProps from '../../helpers/injectProps';
import { formatAsPhoneIfDigitsOnly } from '../../../common/helpers/phone-utils';
import { getShortFormatRentableItem } from '../../../common/helpers/quotes';
import { DALTypes } from '../../../common/enums/DALTypes';
import { toMoment } from '../../../common/helpers/moment-utils';
import { isCorporateParty } from '../../../common/helpers/party-utils';

export default class PartyCard extends Component { // eslint-disable-line
  static propTypes = {
    party: PropTypes.object,
    onClick: PropTypes.func,
    query: PropTypes.object,
  };

  renderAvatar = mainGuestName => {
    const { party } = this.props;
    const partyNotActive = partyIsNotActive(party);
    const isRenewalOrActiveLease = partyIsRenewalOrActiveLease(party);

    if (partyNotActive) {
      return <Avatar className={cf('avatar')} src="/closed-party.svg" />;
    }

    return <Avatar className={cf('avatar')} lighter bgColor="rgb(216, 216, 216)" userName={mainGuestName} isRenewalOrActiveLease={isRenewalOrActiveLease} />;
  };

  getFormattedDate = dateToFormat => toMoment(dateToFormat).format('dddd, MMM D');

  getArchiveReason = archiveReasonId => t(DALTypes.ArchivePartyReasons[archiveReasonId]);

  shouldDisplayMoveInTime = party => party?.workflowName === DALTypes.WorkflowName.NEW_LEASE;

  shouldDisplayFavoriteUnits = party => party?.workflowName === DALTypes.WorkflowName.NEW_LEASE;

  shouldDisplayWatermarkIcon = party => party?.workflowName === DALTypes.WorkflowName.RENEWAL;

  isPartyArchived = party => party?.workflowState === DALTypes.WorkflowState.ARCHIVED;

  shouldDisplayPropertyDisplayName = party =>
    party?.workflowName === DALTypes.WorkflowName.RENEWAL || party?.workflowName === DALTypes.WorkflowName.ACTIVE_LEASE;

  partyStateToDisplay = party => (party?.workflowName === DALTypes.WorkflowName.ACTIVE_LEASE ? t('RESIDENT') : getPartyStateToDisplay(party.partyState));

  getHighlightMatches = (members, query, secondary) => _highlightMatches(members.join(', '), query, { Component: T.SubHeader, inline: true, secondary });

  @injectProps
  render({ party }) {
    const memberNames = party.partyMembersFullNames.split(', ').map(item => formatAsPhoneIfDigitsOnly(item));
    const mainGuestName = trim(memberNames[0]);
    const companyName = isCorporateParty(party) ? party.companyName : null;
    const mainText = this.getHighlightMatches(memberNames, this.props.query.name) || <T.SubHeader>{memberNames}</T.SubHeader>;
    return (
      <Card className={cf('card')} container={false}>
        <div className={cf('cardHeader')}>
          <T.Caption secondary>{party.partyOwner}</T.Caption>
          <T.Caption secondary>{this.partyStateToDisplay(party)}</T.Caption>
        </div>
        <div className={cf('cardBody')}>
          {this.renderAvatar(mainGuestName)}
          <div className={cf('details')}>
            <div className={cf('itemMainText')}>
              {companyName && <T.SubHeader>{`${companyName}, `}</T.SubHeader>}
              {companyName ? (
                <T.Caption disabled secondary inline>
                  {this.getHighlightMatches(memberNames, this.props.query.name, true)}
                </T.Caption>
              ) : (
                mainText
              )}
            </div>
            {this.shouldDisplayMoveInTime(party) && party.moveInTime && (
              <T.Caption style={{ marginTop: '.25rem' }}>
                <span>{`${t('MOVEIN')}: `}</span>
                <span>{t(`${party.moveInTime}`)}</span>
              </T.Caption>
            )}
            {this.shouldDisplayFavoriteUnits(party) && party.favoriteUnits && <T.Caption secondary>{party.favoriteUnits}</T.Caption>}
            {this.shouldDisplayPropertyDisplayName(party) && party.propertyDisplayName && <T.Caption secondary>{party.propertyDisplayName}</T.Caption>}
            {party.inventory && <T.Caption secondary>{getShortFormatRentableItem(party.inventory)}</T.Caption>}
            {this.isPartyArchived(party) && (
              <T.Caption secondary>
                {t('CLOSE_PARTY_SIMPLE_SUMMARY', {
                  date: party.vacateDate ? this.getFormattedDate(party.archiveDate) : this.getFormattedDate(party.vacateDate),
                })}
              </T.Caption>
            )}
            {this.isPartyArchived(party) && (
              <T.Caption secondary>{t('CLOSE_PARTY_REASON', { closeReason: this.getArchiveReason(party.archiveReason) })}</T.Caption>
            )}
            {this.shouldDisplayWatermarkIcon(party) && <Icon name="watermark-grey" className={cf('renewalPartyIcon')} />}
          </div>
        </div>
      </Card>
    );
  }
}
