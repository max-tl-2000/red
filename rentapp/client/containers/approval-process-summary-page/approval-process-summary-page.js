/*
 * Copyright (c) 2022 Reva Technology Inc., all rights reserved.
 * Unauthorized copying of this file, via any medium is strictly prohibited
 * Licensed under the Elastic License 2.0; you may not use this file except
 * in compliance with the Elastic License 2.0.
 */

import React, { Component } from 'react';
import { observer, inject } from 'mobx-react';
import { t } from 'i18next';
import { FormattedMarkdown, Section, Typography, PreloaderBlock } from 'components';
import { ScreeningDecision } from 'enums/applicationTypes';
import { applicantsWithDisclosures, membersWithIncompleteApplicationMapReducer } from 'helpers/applicants-utils';
import { sendToParent } from 'helpers/postMessage';
import { cf } from './approval-process-summary-page.scss';
import { ScreeningReportSummary } from '../screening-report-summary/screening-report-summary';
import { toHumanReadableString } from '../../../../common/helpers/strings';
import { getUserFriendlyStatus, getCreditFreezeStatus } from '../../../../common/helpers/applicants-utils';
import { DALTypes } from '../../../../common/enums/DALTypes';
import { DefaultWarning } from '../../../../client/custom-components/SummaryWarnings/DefaultWarning';
import { UnitReservedWarning } from '../../../../client/custom-components/SummaryWarnings/UnitReservedWarning';
import { SummaryWarningTypes } from '../../../common/enums/warning-types';
import { ApprovalSummaryTypes } from '../../../../common/enums/messageTypes';
import AlertSvg from '../../../../resources/icons/alert.svg';
import CheckSvg from '../../../../resources/icons/check.svg';
import { ExpirationScreeningTypes } from '../../../../common/enums/fadvRequestTypes';

const { SubHeader } = Typography;

const CSS_CLASS_APPROVE = 'approve';
const CSS_CLASS_DECLINE = 'decline';
const CSS_CLASS_REQUIRE_GUARANTOR = 'require-guarantor';

const statusClassByDecision = {
  [ScreeningDecision.APPROVED]: CSS_CLASS_APPROVE,
  [ScreeningDecision.DECLINED]: CSS_CLASS_DECLINE,
  [ScreeningDecision.INCOMPLETE]: CSS_CLASS_DECLINE,
  [ScreeningDecision.GUARANTOR_REQUIRED]: CSS_CLASS_REQUIRE_GUARANTOR,
  [ScreeningDecision.FURTHER_REVIEW]: CSS_CLASS_REQUIRE_GUARANTOR,
  [ScreeningDecision.DISPUTED]: CSS_CLASS_REQUIRE_GUARANTOR,
  [ScreeningDecision.APPROVED_WITH_COND]: CSS_CLASS_REQUIRE_GUARANTOR,
};

@inject('approvalProcessSummary')
@observer
export class ApprovalProcessSummaryPage extends Component {
  constructor(props) {
    super(props);

    this.props.approvalProcessSummary.initializeComponents({
      partyId: props.params.partyId,
      agentToken: props.params.agentToken,
    });

    this.state = {
      screeningSummary: props.approvalProcessSummary.screeningSummary,
    };
  }

  componentWillMount() {
    const { quoteId, leaseTermId } = this.props.location.query;
    this.props.approvalProcessSummary.fetchScreeningSummary({
      partyId: this.props.params.partyId,
      quoteId,
      leaseTermId,
    });
  }

  getTitle = () => t('APPROVAL_PROCESS_SUMMARY_RECOMMENDED_ACTION');

  formatRecommendationsText = (conditions, hasCreditThinFile) =>
    conditions
      .map(({ text }) => {
        if (hasCreditThinFile && text.toLowerCase().includes('applicant has no established credit')) text = null;
        switch (text) {
          case DALTypes.ScreeningRecommendation.ERROR_ADDRESS_UNPARSABLE_RECOMMENDATION:
            text = t('ERROR_ADDRESS_UNPARSABLE_RECOMMENDATION');
            break;
          case DALTypes.ScreeningRecommendation.GENERIC_ERROR_RECOMMENDATION:
            text = t('GENERIC_ERROR_RECOMMENDATION');
            break;
          default:
        }
        return text && `- ${text}`;
      })
      .filter(c => !!c);

  getRecommendations = (conditions, disclosuresRecommendations, hasCreditThinFile) => {
    if (hasCreditThinFile && conditions.length === 1) {
      return !disclosuresRecommendations.length
        ? ''
        : [`${t('SCREENING_RECOMMENDATION', { count: disclosuresRecommendations.length })}:`, ...disclosuresRecommendations].join('\n');
    }

    return [
      `${t('SCREENING_RECOMMENDATION', { count: conditions.length })}:`,
      ...this.formatRecommendationsText(conditions, hasCreditThinFile),
      ...disclosuresRecommendations,
    ].join('\n');
  };

  // TODO: Current conditions will only show the text gotten from FADV directly
  // other stories in CPM-4978 will take care of the internationalization and appplicant personalization.
  getRecommendedConditionsMarkdown = (conditions, applicantsAndDisclosures, hasCreditThinFile) => {
    const disclosuresRecommendations = applicantsAndDisclosures.map(applicant => `- ${t('REVIEW_DISCLOSURES', { applicant: applicant.applicantName })}`);
    return conditions.length || disclosuresRecommendations.length ? this.getRecommendations(conditions, disclosuresRecommendations, hasCreditThinFile) : '';
  };

  getApplicantsWithDisclosures = applicants => {
    const applicantHasDisclosures = applicant => !!applicant.disclosures;
    return applicantsWithDisclosures({
      applicants,
      applicantHasDisclosures,
    });
  };

  getMembersWithIncompleteApplication = () => {
    const { partyMembers, completedApplications } = this.props.approvalProcessSummary;

    const incompleteDataRecommendation = this.props.approvalProcessSummary.getIncompleteApplicants(partyMembers, completedApplications);
    const incompleteApplications = (incompleteDataRecommendation || {}).membersWithIncompleteApplications || [];

    const membersWithIncompleteApplication = new Map();
    return incompleteApplications.reduce(membersWithIncompleteApplicationMapReducer, membersWithIncompleteApplication);
  };

  hasMembersWithIncompleteApplications = membersWithIncompleteApplications => membersWithIncompleteApplications && membersWithIncompleteApplications.length;

  getIncompleteRecommendationMessage = ({ membersWithIncompleteApplications, translationToken, isCompleteApplicationData }) => {
    if (!this.hasMembersWithIncompleteApplications(membersWithIncompleteApplications)) return undefined;

    let membersWithIncompleteApplication = membersWithIncompleteApplications.reduce(membersWithIncompleteApplicationMapReducer, new Map());
    if (isCompleteApplicationData) {
      membersWithIncompleteApplication = this.getMembersWithIncompleteApplication();
      if (!this.hasMembersWithIncompleteApplications(membersWithIncompleteApplications)) return undefined;
    }

    return t(translationToken, {
      applicantNames: toHumanReadableString([...membersWithIncompleteApplication.values()].sort(), t('AND')),
    });
  };

  onViewParty = partyId => sendToParent({ type: ApprovalSummaryTypes.GO_TO_PARTY, data: { partyId } });

  /* eslint-disable new-cap */
  warningComponentsMap = {
    [SummaryWarningTypes.DEFAULT]: DefaultWarning,
    [SummaryWarningTypes.UNIT_RESERVED]: warning => UnitReservedWarning({ ...warning, onViewParty: () => this.onViewParty(warning.partyId) }),
  };
  /* eslint-enable new-cap */

  renderWarnings = warnings => (
    <div className={cf('warnings')}>{warnings.map(warning => this.warningComponentsMap[warning.componentType || SummaryWarningTypes.DEFAULT](warning))}</div>
  );

  renderStatusIcon = (creditFreezeStatus, screeningDecision, isScreeningExpired) => {
    const isApproved = screeningDecision === ScreeningDecision.APPROVED;
    const isApprovedWithCondAndNoCreditFreeze = screeningDecision === ScreeningDecision.APPROVED_WITH_COND && !creditFreezeStatus;
    const isFurtherReview = screeningDecision === ScreeningDecision.FURTHER_REVIEW;

    if ((isApproved || isApprovedWithCondAndNoCreditFreeze || isFurtherReview) && !isScreeningExpired) {
      return <CheckSvg width={38} height={38} className={cf('check-icon')} />;
    }

    return <AlertSvg width={38} height={38} className={cf('alert-icon')} />;
  };

  getScreeningDecision = recommendation => getUserFriendlyStatus(recommendation);

  render() {
    const {
      screeningSummary = {},
      completedApplications,
      notStartedApplications,
      incompleteRecommendation = {},
      loadingData,
    } = this.props.approvalProcessSummary;
    if (loadingData) return <PreloaderBlock />;

    const partyId = this.props.params.partyId;
    const { leaseTermId, quoteId, canReviewApplication, canSeeCreditReport, screeningDelayedDecision } = this.props.location.query;
    const {
      recommendedConditions = [],
      recommendation = ScreeningDecision.INCOMPLETE,
      residents = [],
      warnings = [],
      screeningResult = {},
      expirationScreeningType,
      hasCreditThinFile,
    } = screeningSummary;
    const statusClass = statusClassByDecision[recommendation];
    // TODO: fix this name
    const screeningDecision = this.getScreeningDecision(screeningDelayedDecision || recommendation);
    const isScreeningExpired = expirationScreeningType === ExpirationScreeningTypes.EXPIRED;
    const incompleteRecommendationMessage = this.getIncompleteRecommendationMessage(incompleteRecommendation);
    const creditFreezeStatus = getCreditFreezeStatus(screeningResult);
    const title = this.getTitle();
    const screeningRecommendations = isScreeningExpired
      ? [].concat({ text: t('RERUN_APPLICATION_SCREENING_RECOMMENDATION') }, ...recommendedConditions)
      : recommendedConditions;

    return (
      <div className={cf('wrapper')}>
        {!!warnings.length && this.renderWarnings(warnings)}
        <Section data-id="screeningRecommendationSection" title={title} className={cf('recommended-action')}>
          <div className={cf('wrapper')}>
            <div>
              <SubHeader data-id="highLevelRecommendationSubHeader" className={cf('decision-wrapper')}>
                {!isScreeningExpired && <SubHeader className={cf('status', statusClass)}>{screeningDecision}</SubHeader>}
                {isScreeningExpired && <SubHeader className={cf('status', 'expired')}>{t('EXPIRED_STATUS')}.</SubHeader>}
                {isScreeningExpired && <SubHeader className={cf('status')}>{t('PREVIOUS_RESULT_WAS', { previousDecision: screeningDecision })}</SubHeader>}
              </SubHeader>
              {creditFreezeStatus && (
                <SubHeader data-id="creditFreezeStatusSubHeader" className={cf('status', 'decline')}>
                  {creditFreezeStatus}
                </SubHeader>
              )}
              {incompleteRecommendationMessage && (
                <SubHeader data-id="incompleteRecommendationMessageSubHeader" className={cf('status', 'decline')}>
                  {incompleteRecommendationMessage}
                </SubHeader>
              )}
              <FormattedMarkdown data-id="recommendedConditionsMarkdown">
                {this.getRecommendedConditionsMarkdown(screeningRecommendations, this.getApplicantsWithDisclosures(residents), hasCreditThinFile)}
              </FormattedMarkdown>
            </div>
            <div className={cf('status-icon-wrapper')}>{this.renderStatusIcon(creditFreezeStatus, recommendation, isScreeningExpired)}</div>
          </div>
        </Section>
        <ScreeningReportSummary
          notStartedApplications={notStartedApplications}
          completedApplications={completedApplications}
          screeningSummary={screeningSummary}
          screeningDecision={screeningDecision}
          incompleteRecommendation={incompleteRecommendation}
          partyId={partyId}
          leaseTermId={leaseTermId}
          quoteId={quoteId}
          canReviewApplication={canReviewApplication}
          canSeeCreditReport={canSeeCreditReport}
        />
      </div>
    );
  }
}
