/*
 * Copyright (c) 2022 Reva Technology Inc., all rights reserved.
 * Unauthorized copying of this file, via any medium is strictly prohibited
 * Licensed under the Elastic License 2.0; you may not use this file except
 * in compliance with the Elastic License 2.0.
 */

import PropTypes from 'prop-types';
import React, { Component } from 'react';
import { Card, Avatar, Typography as T, Icon } from 'components';
import rand from 'helpers/rand';
import { t } from 'i18next';
import { partyFromRaw, isCorporateParty } from '../../../common/helpers/party-utils.js';
import { cf } from './PartyCard.scss';
import { DALTypes } from '../../../common/enums/DALTypes';
import { getShortFormatRentableItem } from '../../../common/helpers/quotes';
import { _highlightMatches } from '../../helpers/highlightMatches';

import { getMoveInDateSummary } from '../../helpers/unitsUtils';
import { getPartyStateToDisplay, partyIsNotActive, partyIsRenewalOrActiveLease } from '../../helpers/party';

import { toMoment } from '../../../common/helpers/moment-utils';

export default class PartyCard extends Component {
  static propTypes = {
    party: PropTypes.object,
    currentPersonId: PropTypes.string,
    teams: PropTypes.object,
    disabled: PropTypes.bool,
    onClick: PropTypes.func.isRequired,
  };

  getMembersByType = (partyMembers, type) => partyMembers.filter(member => member.memberType === type);

  getMoveInRange = party => {
    const unitFilters = party.storedUnitsFilters;
    const moveInDates = unitFilters && unitFilters.moveInDate;
    return moveInDates;
  };

  getRandomUnits = units => {
    const getRandomSlice = (arr = [], count = 1) => {
      const index = rand(0, arr.length);
      return arr.slice(index, index + count);
    };

    return getRandomSlice(units, rand(0, 3));
  };

  constructor(props) {
    super(props);

    const allPartyMembers = props.members.toArray();

    const residentsAndOccupants = [
      ...this.getMembersByType(allPartyMembers, DALTypes.MemberType.RESIDENT),
      ...this.getMembersByType(allPartyMembers, DALTypes.MemberType.OCCUPANT),
    ];

    const guarantors = this.getMembersByType(allPartyMembers, DALTypes.MemberType.GUARANTOR);
    const party = partyFromRaw(residentsAndOccupants);

    this.state = {
      residentsAndOccupants: partyFromRaw(residentsAndOccupants).orderedGuests,
      guarantors: guarantors.length ? partyFromRaw(guarantors).orderedGuests : undefined,
      defaultMember: party.defaultGuestFullName,
      moveInRange: this.getMoveInRange(props.party),
      units: [], // TODO: is this used?
    };
  }

  getTeamName = teamId => {
    const { teams } = this.props;
    const team = teams.find(item => item.id === teamId);
    return (team && team.displayName) || '';
  };

  handleClick = () => {
    const { onClick, party, disabled } = this.props;
    !disabled && onClick && onClick(party);
  };

  getHighlightMatches = (members, query, secondary) => _highlightMatches(members.join(', '), query, { Component: T.SubHeader, inline: true, secondary });

  getPartyTeams = party =>
    party.teams.map((teamId, index) => (
      <T.Caption secondary={false} inline key={teamId}>
        {this.getTeamName(teamId)}
        {do {
          if (index !== party.teams.length - 1) {
            <span>, </span>;
          }
        }}
      </T.Caption>
    ));

  partyStateToDisplay = party => {
    const { workflowName, state } = party || {};

    if (workflowName === DALTypes.WorkflowName.NEW_LEASE && state === DALTypes.PartyStateType.RESIDENT) return t('LEASED');

    const workFlowNameMap = {
      [DALTypes.WorkflowName.ACTIVE_LEASE]: 'RESIDENT',
      [DALTypes.WorkflowName.RENEWAL]: 'RENEWAL',
    };
    const trToken = workFlowNameMap[workflowName];

    return trToken ? t(trToken) : getPartyStateToDisplay(state);
  };

  renderCardTitle = party => (
    <div style={{ borderBottom: '1px solid #eee', paddingBottom: '.6rem' }}>
      <T.Caption inline>{this.partyStateToDisplay(party)} </T.Caption>
      <T.Caption inline secondary={true}>
        {t('WITH')}{' '}
      </T.Caption>
      {this.getPartyTeams(party)}
    </div>
  );

  renderMembers = (members, TagElement, currentPersonId) => {
    if (isCorporateParty(this.props.party)) {
      const companyName = members.length ? members[0].corporateCompanyName : '';
      const memberNames = members.map(member => member.safeTextName).join(', ');
      return (
        <div className={cf('itemMainText')}>
          {companyName && <T.SubHeader>{`${companyName}, `}</T.SubHeader>}
          {
            <T.SubHeader disabled={!!companyName} secondary={!!companyName} inline>
              {memberNames}
            </T.SubHeader>
          }
        </div>
      );
    }

    return members.map((pm, index) => {
      const highlighted = pm.personId === currentPersonId;
      return (
        <TagElement className={cf((highlighted && 'highlighted') || '')} inline key={pm.personId}>
          {pm.safeTextName}
          {do {
            if (index !== members.length - 1) {
              <span>, </span>;
            }
          }}
        </TagElement>
      );
    });
  };

  renderGuarantors = (guarantors, currentPersonId) => (
    <div className={cf('guarantorsList')}>
      <T.Caption secondary>{t('GUARANTORS')}</T.Caption>
      {this.renderMembers(guarantors, T.Caption, currentPersonId)}
    </div>
  );

  renderMoveIn = (isLeaseOrFutureResident, moveInRange) => {
    if (isLeaseOrFutureResident) {
      return (
        <T.Caption secondary inline>
          {toMoment(moveInRange.min).format('MMM DD, YYYY')}
        </T.Caption>
      );
    }
    return (
      <T.Caption secondary inline>
        {getMoveInDateSummary(moveInRange)}
      </T.Caption>
    );
  };

  renderUnits = (units, moveInRange) => (
    <T.Caption secondary inline className={cf((moveInRange && 'unitsList') || '')}>
      {units.map(item => item.name).join(', ')}
    </T.Caption>
  );

  getClosedDate = endDate => toMoment(endDate).format('dddd, MMM D');

  getCloseReason = closeReasonId => t(DALTypes.ClosePartyReasons[closeReasonId]);

  getArchiveDate = archiveDate => toMoment(archiveDate).format('dddd, MMM D');

  getArchiveReason = archiveReasonId => t(DALTypes.ArchivePartyReasons[archiveReasonId]);

  shouldDisplayMoveInTime = party => party?.workflowName === DALTypes.WorkflowName.NEW_LEASE;

  shouldDisplayFavoriteUnits = party => party?.workflowName === DALTypes.WorkflowName.NEW_LEASE;

  shouldDisplayWatermarkIcon = party => party?.workflowName === DALTypes.WorkflowName.RENEWAL;

  render = () => {
    const { party, currentPersonId, disabled, noMargin, agent = {} } = this.props;
    const { defaultMember, residentsAndOccupants, guarantors, moveInRange, units } = this.state;
    const isLeaseOrFutureResident = party.state === DALTypes.PartyStateType.LEASE || party.state === DALTypes.PartyStateType.FUTURERESIDENT;

    const isClosed = !!(party && party.workflowState === DALTypes.WorkflowState.CLOSED);
    const isArchived = !!(party && party.workflowState === DALTypes.WorkflowState.ARCHIVED);
    const partyNotActive = partyIsNotActive(party);
    const isRenewalOrActiveLease = partyIsRenewalOrActiveLease(party);
    const inventory = party?.activeLeaseWorkflowData?.leaseData?.inventory;

    let avatarStyle;

    if (partyNotActive) {
      avatarStyle = { visibility: 'hidden' };
    }

    return (
      <div
        className={cf({
          disabledCardBody: disabled,
          enabledCardBody: !disabled,
        })}>
        <Card style={{ paddingTop: '.5rem' }} className={cf('card', { noMargin })} onClick={this.handleClick}>
          <div>
            <div>{this.renderCardTitle(party)}</div>
            <div className={cf('cardBody')}>
              <div style={{ position: 'relative' }}>
                <Avatar lighter userName={defaultMember} style={avatarStyle} isRenewalOrActiveLease={isRenewalOrActiveLease} />
                {partyNotActive && <Avatar src="/closed-party.svg" style={{ position: 'absolute', top: 0, left: 0 }} />}
              </div>
              <div className={cf('cardDetails')}>
                {this.renderMembers(residentsAndOccupants, T.SubHeader, currentPersonId)}
                {isClosed && (
                  <div>
                    <T.Text>
                      {t('CLOSE_PARTY_SUMMARY', {
                        name: agent.preferredName || agent.fullName,
                        date: this.getClosedDate(party.endDate),
                      })}
                    </T.Text>
                    <T.Text>{t('CLOSE_PARTY_REASON', { closeReason: this.getCloseReason(party.metadata.closeReasonId) })}</T.Text>
                  </div>
                )}
                {isArchived && (
                  <div>
                    <T.Text>
                      {t('CLOSE_PARTY_SUMMARY', {
                        name: agent.preferredName || agent.fullName,
                        date: this.getArchiveDate(party.archiveDate),
                      })}
                    </T.Text>
                    <T.Text>{t('CLOSE_PARTY_REASON', { closeReason: this.getArchiveReason(party.metadata.archiveReasonId) })}</T.Text>
                  </div>
                )}
                {guarantors && this.renderGuarantors(guarantors, currentPersonId)}
                <div className={cf('moveIn')}>
                  {moveInRange && this.shouldDisplayMoveInTime(party) && this.renderMoveIn(isLeaseOrFutureResident, moveInRange)}
                  {this.shouldDisplayFavoriteUnits(party) && this.renderUnits(units, moveInRange)}
                  {!!inventory && (
                    <T.Caption secondary inline>
                      {getShortFormatRentableItem(inventory)}
                    </T.Caption>
                  )}
                </div>
              </div>
              {this.shouldDisplayWatermarkIcon(party) && <Icon name="watermark-grey" className={cf('renewalPartyIcon')} />}
            </div>
          </div>
        </Card>
      </div>
    );
  };
}
