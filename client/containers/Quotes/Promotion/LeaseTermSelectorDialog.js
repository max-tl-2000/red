/*
 * Copyright (c) 2022 Reva Technology Inc., all rights reserved.
 * Unauthorized copying of this file, via any medium is strictly prohibited
 * Licensed under the Elastic License 2.0; you may not use this file except
 * in compliance with the Elastic License 2.0.
 */

import PropTypes from 'prop-types';
import React, { Component } from 'react';
import { t } from 'i18next';
import { Button, Dialog, DialogActions, DialogHeader, DialogOverlay, FormattedMarkdown, RedTable } from 'components';
import { termText } from 'helpers/quotes';
import { cf } from '../QuoteList.scss';
import { LeaseTermSelector } from './LeaseTermSelector';
import { isApprovedWithoutDisclosures, PromoteActionType } from '../../../helpers/screening';
import { ScreeningDecision } from '../../../../common/enums/applicationTypes';
import { getDisplayName } from '../../../../common/helpers/person-helper';

const { TextSecondary, TextPrimary } = RedTable;

export default class LeaseTermSelectorDialog extends Component {
  static propTypes = {
    user: PropTypes.object,
    open: PropTypes.bool,
    onCloseRequest: PropTypes.func,
    quote: PropTypes.object,
    selectedTerm: PropTypes.object,
    onChange: PropTypes.func,
    onAction: PropTypes.func,
    actionButtonLabel: PropTypes.string,
    applicantsWithDisclosures: PropTypes.array,
    screeningRequired: PropTypes.bool,
    atLeastTwoLeaseTermsAvailable: PropTypes.bool,
  };

  constructor(props) {
    super(props);
    this.state = {
      selectedTerm: this.props.selectedTerm,
    };
  }

  componentWillReceiveProps = nextProps => {
    const { selectedTerm } = nextProps;
    if (selectedTerm && selectedTerm.id !== this.state.selectedTerm.id) {
      this.handleLeaseTermsChange(selectedTerm);
    }
  };

  shouldNotDisplayRecommendations = applicationDecision =>
    applicationDecision === ScreeningDecision.NO_SCREENING_REQUEST ||
    applicationDecision === ScreeningDecision.NO_SCREENING_RESPONSE ||
    applicationDecision === ScreeningDecision.NO_SCREENING_RESPONSE_INTERNATIONAL_ADDRESS;

  getScreeningRecommendations = (applicationDecision, numberOfRecommendedConditions) => {
    if (this.shouldNotDisplayRecommendations(applicationDecision)) return [];

    return [
      `${t('SCREENING_RECOMMENDATION', {
        count: numberOfRecommendedConditions,
      })}:`,
      '\n',
    ];
  };

  renderApprovedInformation = (transToken, isSecondary = true) => {
    const TextComponent = isSecondary ? TextSecondary : TextPrimary;
    return (
      <div className={cf('information-text')}>
        <TextComponent className={cf('information-text')}>{t(transToken)}</TextComponent>
      </div>
    );
  };

  renderConditionallyApprovedInformation = ({ quote, selectedTerm = {}, screeningRequired, atLeastTwoLeaseTermsAvailable }) => {
    // create a bulleted list of conditions
    // TODO: Current conditions will only show the text gotten from FADV directly
    // other stories in CPM-4978 will take care of the internationalization and appplicant personalization.

    const mdContent = [];
    if (atLeastTwoLeaseTermsAvailable) {
      mdContent.push(t('REQUEST_APPROVAL_APPLICATION_REQUIRES_APPROVAL'));
    } else {
      mdContent.push(
        t('REQUEST_APPROVAL_APPLICATION_LEASE_TERM', {
          unitName: quote.inventory.name,
          adjustedMarketRent: selectedTerm.adjustedMarketRent,
          period: selectedTerm.period,
          termLength: selectedTerm.termLength,
        }),
      );
    }
    mdContent.push(t('REQUEST_APPROVAL_APPLICATION_APPROVAL_CONDITIONAL'));

    const screeningResult = (selectedTerm.screening || {}).result;
    const { applicationDecision = '', recommendedConditions = [] } = screeningResult || {};
    const conditionsMD = recommendedConditions.map(condition => `- ${condition.text}`);
    const disclosuresRecommendations = this.props.applicantsWithDisclosures.map(
      applicant =>
        `- ${t('REVIEW_DISCLOSURES', {
          applicant: getDisplayName(applicant[1].person),
        })}`,
    );

    const screeningRecommendations = recommendedConditions.length ? this.getScreeningRecommendations(applicationDecision, recommendedConditions.length) : [];

    if (screeningRequired) {
      const mdScreeningContent = ['\n', ...screeningRecommendations, ...conditionsMD, '\n', ...disclosuresRecommendations];
      mdContent.push(...mdScreeningContent);
    }

    return <FormattedMarkdown>{mdContent.join('\n')}</FormattedMarkdown>;
  };

  renderPromoteMessage = ({ selectedTerm, quote, atLeastTwoLeaseTermsAvailable, screeningRequired }) => {
    const { screening } = selectedTerm;
    if (screening && screening.result && isApprovedWithoutDisclosures(screening.result, this.props.applicantsWithDisclosures)) {
      return this.renderApprovedInformation('APPLICATION_APPROVED_INFO', atLeastTwoLeaseTermsAvailable);
    }
    return this.renderConditionallyApprovedInformation({ selectedTerm, quote, atLeastTwoLeaseTermsAvailable, screeningRequired });
  };

  handleOnAction = actionType => {
    const { quote, onAction } = this.props;
    const { selectedTerm } = this.state;
    const conditions = {
      unit: quote.inventory.fullQualifiedName,
      leaseTermsLength: termText(selectedTerm),
      deposit: selectedTerm.adjustedMarketRent,
    };
    onAction && onAction(actionType, quote.id, selectedTerm, conditions);
  };

  renderPromoteButton = (action, label, actionName = '', id = '') => (
    <Button label={label} type="flat" btnRole="primary" onClick={action} name={actionName} id={id} />
  );

  handleLeaseTermsChange = item => {
    this.setState({
      selectedTerm: item,
    });
  };

  getDialogData = screeningRequired => {
    const titleSelector = 'SELECT_A_LEASE_TERM';
    if (!screeningRequired) {
      return {
        dialogAction: () => this.handleOnAction(PromoteActionType.CREATE_LEASE),
        dialogActionButtonLabel: t('CREATE_LEASE'),
        titleSelector,
        actionName: 'btnCreateLease',
        id: 'createLeaseBtn',
      };
    }

    return {
      dialogAction: () => this.handleOnAction(PromoteActionType.REVIEW_APPLICATION),
      dialogActionButtonLabel: t('REVIEW_SCREENING'),
      titleSelector,
      actionName: 'btnReviewApplication',
    };
  };

  render({ open, onCloseRequest, quote, screeningRequired, atLeastTwoLeaseTermsAvailable, isRenewal } = this.props) {
    const { selectedTerm } = this.state;
    const { dialogAction, dialogActionButtonLabel, titleSelector, actionName, id } = this.getDialogData(screeningRequired);

    return (
      <Dialog open={open} onCloseRequest={onCloseRequest}>
        <DialogOverlay id="lease-term-selector-dialog">
          <DialogHeader
            title={t(titleSelector, {
              unitName: quote.inventory.name,
            })}
          />
          <div>
            {atLeastTwoLeaseTermsAvailable && (
              <LeaseTermSelector
                leaseTerms={quote.leaseTerms}
                onChange={this.handleLeaseTermsChange}
                selectedTerm={selectedTerm}
                renderScreeningInfo={screeningRequired}
                isRenewal={isRenewal}
              />
            )}
            {/* Dropdown internal model generation breaks the get screening so getting the value directly here */}
            {!isRenewal && this.renderPromoteMessage({ quote, selectedTerm, atLeastTwoLeaseTermsAvailable, screeningRequired })}
          </div>
          <DialogActions>
            <Button label={t('CANCEL')} type="flat" btnRole="secondary" data-action="close" />
            {/* Dropdown internal model generation breaks the get screening so getting the value directly here */}
            {this.renderPromoteButton(dialogAction, dialogActionButtonLabel, actionName, id)}
          </DialogActions>
        </DialogOverlay>
      </Dialog>
    );
  }
}
