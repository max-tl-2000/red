/*
 * Copyright (c) 2022 Reva Technology Inc., all rights reserved.
 * Unauthorized copying of this file, via any medium is strictly prohibited
 * Licensed under the Elastic License 2.0; you may not use this file except
 * in compliance with the Elastic License 2.0.
 */

import React, { Component } from 'react';
import { observer } from 'mobx-react';
import { Typography, Icon, Card, RedTable } from 'components';
import { t } from 'i18next';
import { ApplicantInformationStepper } from '../approval-process-summary-page/applicant-information-stepper';

import { cf } from './screening-report-card.scss';
const { Caption, Text, SubHeader, TextHeavy } = Typography;
const { Table, Row, Cell } = RedTable;
const CRITERIA_FAIL = 'F';

@observer
export class ScreeningReportCard extends Component {
  constructor(props, context) {
    super(props, context);

    this.state = {
      displayFullReport: false,
    };
  }

  toggleFullReport = () => {
    this.setState({
      displayFullReport: !this.state.displayFullReport,
    });
  };

  isFailCriteria = criteriaResult => criteriaResult === CRITERIA_FAIL;

  getSummaryInfo = ({ criterias }) => {
    const missingResults = criterias.every(item => !item.criteriaResult);
    if (missingResults) {
      return (
        <Caption data-id="couldNotFindApplicantMatchCaption" secondary className={cf('item', 'red-text')}>
          {t('APPROVAL_PROCESS_SUMMARY_ERROR_COULD_NOT_FIND_APPLICANT_MATCH')}
        </Caption>
      );
    }

    const list = criterias.filter(item => this.isFailCriteria(item.criteriaResult));
    if (list.length === 0) {
      return (
        <Caption data-id={`criminalAndCreditCheckCaption_${t('APPROVAL_PROCESS_SUMMARY_ALL_GOOD')}`} secondary className={cf('item')}>
          {t('APPROVAL_PROCESS_SUMMARY_ALL_GOOD')}
        </Caption>
      );
    }
    return list.map((warning, rowKey) => (
      // TODO: We need to find a proper id here
      // eslint-disable-next-line react/no-array-index-key
      <Caption data-id={`warningCaption_${warning.criteriaName}`} key={rowKey} className={cf('item', 'red-text')}>
        {warning.criteriaDescription}
      </Caption>
    ));
  };

  getSummaryInfoIcon = ({ missingApplicantMatch, criterias }) => {
    const failsCount = criterias.filter(item => this.isFailCriteria(item.criteriaResult)).length;
    const displayAlert = missingApplicantMatch || failsCount > 0;
    return <Icon name={displayAlert ? 'alert' : 'check'} className={cf({ 'red-icon': displayAlert })} />;
  };

  getChecks = ({ missingApplicantMatch, criterias }) => {
    if (missingApplicantMatch) return <Row />;

    return criterias.map((check, rowKey) => (
      // TODO: We need to find a proper id here
      // eslint-disable-next-line react/no-array-index-key
      <Row key={rowKey} noDivider>
        <Cell width={48} textAlign="center">
          <Icon
            name={this.isFailCriteria(check.criteriaResult) ? 'alert' : 'check'}
            className={cf({ 'red-icon': this.isFailCriteria(check.criteriaResult) }, 'check-icon')}
          />
        </Cell>
        <Cell noSidePadding>
          <Text
            className={cf('check-item', {
              'red-text': this.isFailCriteria(check.criteriaResult),
            })}>
            {check.criteriaDescription}
          </Text>
        </Cell>
      </Row>
    ));
  };

  render() {
    const { displayFullReport } = this.state;
    const {
      member,
      isOccupant,
      screeningCriterias = [],
      screeningCriteriaResults = {},
      notStartedApplications,
      completedApplications,
      allApplicantsHaveMatchInCriteriaResult,
      rowIndex,
    } = this.props;
    const { applicantInformation, applicantName, personId } = member;
    const messageCriminalCreditCheck = isOccupant ? t('APPROVAL_PROCESS_SUMMARY_CRIMINAL_CHECK') : t('APPROVAL_PROCESS_SUMMARY_CRIMINAL_CREDIT_CHECK');
    const showNotStartedWarning = notStartedApplications.some(application => application.personId === personId);
    const showIncompleteApplicantInformation = !completedApplications.some(application => application.personId === personId);
    const incompleteApplicantInformationLabel = showIncompleteApplicantInformation
      ? t('INCOMPLETE_APPLICANT_INFORMATION_WARNING')
      : t('COMPLETE_APPLICANT_INFORMATION_WARNING');

    const criterias = screeningCriterias.map(screeningCriteria => ({
      key: screeningCriteria.criteriaId,
      criteriaDescription: screeningCriteria.criteriaDescription,
      criteriaName: `${screeningCriteria.criteriaType}${screeningCriteria.criteriaId}`,
      criteriaResult: screeningCriteriaResults[screeningCriteria.criteriaId] && screeningCriteriaResults[screeningCriteria.criteriaId][personId],
    }));
    const missingApplicantMatch = !allApplicantsHaveMatchInCriteriaResult;
    const screeningReportCardId = `resident${rowIndex}_screeningSummary`;
    const screeningReportExpandButtonId = `resident${rowIndex}_expandButton`;
    const residentNumber = `resident${rowIndex}`;
    return (
      <Card className={cf('card')} container={false} data-id={screeningReportCardId}>
        <div className={cf('resume')}>
          <div className={cf('warning-icon')}>{this.getSummaryInfoIcon({ criterias, missingApplicantMatch })}</div>
          <div className={cf('warning-section')}>
            <SubHeader className={cf('title')}>{applicantName}</SubHeader>
            <Caption data-id="criminalAndCreditCheckCaption">{messageCriminalCreditCheck}</Caption>
            {showNotStartedWarning && (
              <div className={cf('warnings')}>
                <Caption className={cf('item', 'red-text')}>{t('NOT_STARTED_WARNING')}</Caption>
              </div>
            )}
            <div className={cf('warnings')}>{this.getSummaryInfo({ criterias, missingApplicantMatch })}</div>
            <Caption data-id="applicantInformationCaption">{t('APPROVAL_PROCESS_SUMMARY_APPLICANT_INFORMATION')}</Caption>
            <div className={cf('warnings')}>
              <Caption
                secondary={!showIncompleteApplicantInformation}
                className={cf('item', {
                  'red-text': showIncompleteApplicantInformation,
                })}>
                {incompleteApplicantInformationLabel}
              </Caption>
            </div>
          </div>
          <div className={cf('collapse-trigger')} onClick={this.toggleFullReport} data-id={screeningReportExpandButtonId}>
            <div>
              <Icon name={displayFullReport ? 'chevron-up' : 'chevron-down'} />
            </div>
          </div>
        </div>
        <div className={cf('full-report')}>
          {displayFullReport && (
            <div className={cf('checks')}>
              <TextHeavy className={cf('title-border')}>{messageCriminalCreditCheck}</TextHeavy>
              {showNotStartedWarning && (
                <div className={cf('warnings', 'subtitle-padding')}>
                  <Caption className={cf('item', 'red-text')}>{t('NOT_STARTED_WARNING')}</Caption>
                </div>
              )}
              <Table type="readOnly">{this.getChecks({ criterias, missingApplicantMatch })}</Table>
              <TextHeavy className={cf('title-border')}>{t('APPROVAL_PROCESS_SUMMARY_APPLICANT_INFORMATION')}</TextHeavy>
              <div className={cf('warnings', 'subtitle-padding')}>
                <Caption
                  secondary={!showIncompleteApplicantInformation}
                  className={cf('item', {
                    'red-text': showIncompleteApplicantInformation,
                  })}>
                  {incompleteApplicantInformationLabel}
                </Caption>
              </div>
              <ApplicantInformationStepper residentNumber={residentNumber} applicantInformation={applicantInformation} />
            </div>
          )}
        </div>
      </Card>
    );
  }
}
