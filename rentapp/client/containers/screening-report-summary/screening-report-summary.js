/*
 * Copyright (c) 2022 Reva Technology Inc., all rights reserved.
 * Unauthorized copying of this file, via any medium is strictly prohibited
 * Licensed under the Elastic License 2.0; you may not use this file except
 * in compliance with the Elastic License 2.0.
 */

import PropTypes from 'prop-types';
import React, { Component } from 'react';
import { observer, inject } from 'mobx-react';
import { Typography, Section, Button } from 'components';
import { t } from 'i18next';
import { windowOpen } from 'helpers/win-open';
import { DALTypes } from 'enums/DALTypes';
import { cf } from './screening-report-summary.scss';
import { ScreeningReportCard } from './screening-report-card';
import { createViewScreeningReportSummaryUrl, getBaseRentappUrl } from '../../../common/generate-api-url-helper';

const { Caption } = Typography;

@inject('auth')
@observer
export class ScreeningReportSummary extends Component {
  static propTypes = {
    completedApplications: PropTypes.array,
    notStartedApplications: PropTypes.array,
    incompleteRecommendation: PropTypes.object,
    screeningSummary: PropTypes.object,
    canSeeCreditReport: PropTypes.string,
    partyId: PropTypes.string,
    leaseTermId: PropTypes.string,
  };

  handleViewFullReport = () => {
    const { partyId, quoteId, leaseTermId } = this.props;
    const baseUrl = getBaseRentappUrl();
    const viewScreeningSummaryReportURL = createViewScreeningReportSummaryUrl(baseUrl, { partyId, quoteId, leaseTermId }, this.props.auth.authInfo.token);
    windowOpen(viewScreeningSummaryReportURL);
  };

  hasFullReport = (screeningCriterias, screeningCriteriaResults) =>
    !!Object.keys(screeningCriteriaResults).length &&
    !screeningCriterias.some(screeningCriteria => screeningCriteria.criteriaDescription === DALTypes.ScreeningCriteriaResult.SCREENING_NOT_COMPLETED);

  isScreeningIncomplete = screeningCriterias =>
    screeningCriterias.some(screeningCriteria => screeningCriteria.criteriaDescription === DALTypes.ScreeningCriteriaResult.AWAITING_SCREENING_FOR_APPLICANT);

  getPendingPartyMemberPerType = (partyMmbers = [], type) => partyMmbers.filter(partyMember => partyMember.memberType === type) || [];

  getMembersWithIncompleteApplicationByType = (isCompleteApplicationData, membersWithIncompleteApplications, memberType) =>
    isCompleteApplicationData ? this.getPendingPartyMemberPerType(membersWithIncompleteApplications, memberType) : [];

  agentHasRightsToViewReport = () => this.props.canSeeCreditReport;

  renderActionItem = (screeningCriterias, isBackgroundReportEmpty, screeningCriteriaResults) => {
    const viewFullReportButtonVisible = this.agentHasRightsToViewReport();
    const viewFullReportEnabled = !isBackgroundReportEmpty && this.hasFullReport(screeningCriterias, screeningCriteriaResults);
    const fullReportButtonStyle = viewFullReportEnabled ? {} : { cursor: 'not-allowed' };
    const fullReportLabel = this.isScreeningIncomplete(screeningCriterias) ? t('VIEW_INCOMPLETE_REPORT') : t('VIEW_FULL_REPORT');

    return viewFullReportButtonVisible ? (
      <Button
        type="flat"
        btnRole="primary"
        id="viewFullReportBtn"
        label={fullReportLabel}
        onClick={this.handleViewFullReport}
        disabled={!viewFullReportEnabled}
        style={fullReportButtonStyle}
      />
    ) : (
      <div />
    );
  };

  render() {
    const { screeningSummary = {}, notStartedApplications, completedApplications, incompleteRecommendation = {} } = this.props;
    const {
      residents = [],
      occupants = [],
      guarantors = [],
      screeningCriterias = [],
      screeningCriteriaResults = {},
      isBackgroundReportEmpty,
      allApplicantsHaveMatchInCriteriaResult = true,
    } = screeningSummary;
    const { isCompleteApplicationData, membersWithIncompleteApplications = [] } = incompleteRecommendation;
    const getScreeningReportCardList = (members, isOccupant) =>
      members.map((member, rowKey) => {
        // TODO: We need to find a proper id here
        // eslint-disable-next-line react/no-array-index-key
        const key = rowKey;
        return (
          <ScreeningReportCard
            key={key}
            member={member}
            rowIndex={rowKey}
            isOccupant={isOccupant}
            screeningCriterias={screeningCriterias}
            screeningCriteriaResults={screeningCriteriaResults}
            notStartedApplications={notStartedApplications}
            completedApplications={completedApplications}
            allApplicantsHaveMatchInCriteriaResult={allApplicantsHaveMatchInCriteriaResult}
          />
        );
      });

    const pendingResidentsApplications = this.getMembersWithIncompleteApplicationByType(
      isCompleteApplicationData,
      membersWithIncompleteApplications,
      DALTypes.MemberType.RESIDENT,
    );
    const pendingOccupantsApplications = this.getMembersWithIncompleteApplicationByType(
      isCompleteApplicationData,
      membersWithIncompleteApplications,
      DALTypes.MemberType.OCCUPANT,
    );
    const pendingGuarantorsApplications = this.getMembersWithIncompleteApplicationByType(
      isCompleteApplicationData,
      membersWithIncompleteApplications,
      DALTypes.MemberType.GUARANTOR,
    );

    const totalResidents = residents.concat(pendingResidentsApplications);
    const totalOccupants = occupants.concat(pendingOccupantsApplications);
    const totalGuarantors = guarantors.concat(pendingGuarantorsApplications);

    return (
      <Section
        data-id="screeningReportSummarySection"
        title={t('APPROVAL_PROCESS_SUMMARY_SCREENING_REPORT')}
        actionItems={this.renderActionItem(screeningCriterias, isBackgroundReportEmpty, screeningCriteriaResults)}>
        {totalResidents && !!totalResidents.length && (
          <div>
            <Caption secondary className={cf('title')} bold>
              {t('RESIDENTS')}
            </Caption>
            {getScreeningReportCardList(totalResidents)}
          </div>
        )}
        {totalOccupants && !!totalOccupants.length && (
          <div>
            <Caption secondary className={cf('title')} bold>
              {t('OCCUPANTS')}
            </Caption>
            {getScreeningReportCardList(totalOccupants, true)}
          </div>
        )}
        {totalGuarantors && !!totalGuarantors.length && (
          <div>
            <Caption secondary className={cf('title')} bold>
              {t('GUARANTORS')}
            </Caption>
            {getScreeningReportCardList(totalGuarantors)}
          </div>
        )}
      </Section>
    );
  }
}
