/*
 * Copyright (c) 2022 Reva Technology Inc., all rights reserved.
 * Unauthorized copying of this file, via any medium is strictly prohibited
 * Licensed under the Elastic License 2.0; you may not use this file except
 * in compliance with the Elastic License 2.0.
 */

import PropTypes from 'prop-types';
import React from 'react';
import { connect } from 'react-redux';
import { t } from 'i18next';
import { termText, getAdjFormOfPeriod, adjustmentText, sortByOptionalAndAlphabetically, getMaxAmountLimit } from 'helpers/quotes';

import { observer } from 'mobx-react';
import { action } from 'mobx';
import { ICON_CELL_WIDTH } from 'helpers/tableConstants';

import { RedTable, IconButton, CheckBox, FlyOutAmountEditor, Button, Section } from 'components';
import { cf } from './quote.scss';
import { getConcessionValue, getLimitValuesForBaseRent, isNotSetTheAllowBaseRentAdjustmentForTerm } from '../../../../common/helpers/quotes';
import { convertToCamelCaseAndRemoveBrackets } from '../../../../common/helpers/strings';
import { MONTH_DATE_YEAR_FORMAT } from '../../../../common/date-constants';

const { Table, Row, Cell, TextPrimary, Money, GroupTitle, TextSecondary } = RedTable;

@connect(state => ({ currentUserId: (state.auth.user || {}).id }))
@observer
class BaseChargeSection extends React.Component {
  static propTypes = {
    quoteModel: PropTypes.object,
    collapse: PropTypes.bool,
  };

  get selectedTerm() {
    return this.props.quoteModel.selectedTerm;
  }

  constructor(props, context) {
    super(props, context);
    this.state = {
      collapse: false,
      isThereAnyHideInSelfServiceConcession: false,
    };
  }

  setIsThereAnyHideInSelfServiceConcession = props => {
    const { leaseTerms, selectedLeaseTermIds } = props.quoteModel;
    const isThereAnyHideInSelfServiceConcession = leaseTerms.some(
      x => selectedLeaseTermIds.some(s => s === x.id) && x.concessions.some(c => c.hideInSelfService && !c.bakedIntoAppliedFeeFlag),
    );
    this.setState({ isThereAnyHideInSelfServiceConcession });
  };

  componentWillReceiveProps(nextProps) {
    if (nextProps.quoteModel !== this.props.quoteModel) {
      this.setIsThereAnyHideInSelfServiceConcession(nextProps);
    }
  }

  componentDidMount() {
    this.setIsThereAnyHideInSelfServiceConcession(this.props);
  }

  @action
  handleBaseRentAmountChange({ value, term, originalBaseRent }) {
    const overwrittenBaseRent = (term.adjustedMarketRent = parseFloat(value));
    const { quoteModel } = this.props;

    quoteModel.overwriteBaseRent(term.id, { originalBaseRent: parseFloat(originalBaseRent), overwrittenBaseRent });
    quoteModel.updateConcessionsAmountAndDepositsRelativeAmount(term);
    quoteModel.setDefaultVariableAmount({ setAmount: true, updateOnlyRelativeFees: true });
    quoteModel.enableQuoteSaving();
  }

  renderBaseRentRows = term => {
    const { quoteModel } = this.props;
    const allowBaseRentAdjustment = quoteModel.allowBaseRentAdjustment;
    const allowBaseRentAdjustmentForTerm = term.allowBaseRentAdjustment;
    const flyOutPrefix = '$';

    /*
     * 'term.overwrittenBaseRent': is the new base rent set by the agent, with the below FlyOutAmountEditor.
     * This new base rent value is used as a replacement of the adjustedMarketRent from the database.
     * 'term.originalBaseRent': is the initial adjustedMarketRent(base rent) value from the database.
     * Its used as the minimun amount that the agent can input, the purpose of this property is to save the
     * the original adjustedMarketRent value in case it changes after the quote was created.
     */
    const baseRent = term.overwrittenBaseRent || term.adjustedMarketRent;
    const originalBaseRent = term.originalBaseRent || term.adjustedMarketRent;
    let flyoutMinMaxProps = getLimitValuesForBaseRent(term, allowBaseRentAdjustment, originalBaseRent);
    const shouldSetFlyoutMinLimit = flyoutMinMaxProps.min && !flyoutMinMaxProps.max;
    const shouldSetFlyoutMaxLimit = !flyoutMinMaxProps.min && flyoutMinMaxProps.max;

    if (shouldSetFlyoutMinLimit) {
      flyoutMinMaxProps = { min: flyoutMinMaxProps.min };
    }

    if (shouldSetFlyoutMaxLimit) {
      flyoutMinMaxProps = { max: flyoutMinMaxProps.max };
    }
    const displayBaseRentEditor = allowBaseRentAdjustment || allowBaseRentAdjustmentForTerm;

    let originalValueProp = {};
    if (!isNotSetTheAllowBaseRentAdjustmentForTerm(allowBaseRentAdjustment, allowBaseRentAdjustmentForTerm)) {
      originalValueProp = { originalValue: originalBaseRent };
    }

    return (
      <Row>
        <Cell width={ICON_CELL_WIDTH} type="ctrlCell">
          <IconButton iconName="check" />
        </Cell>
        <Cell>
          <TextPrimary inline={true}>{t('BASE_RENT')}</TextPrimary>
        </Cell>
        <Cell width={120} textAlign="right">
          <TextSecondary inline={true}>
            {displayBaseRentEditor && (
              <div className={cf('editable-amount')}>
                <FlyOutAmountEditor
                  dataId={`baseRentLeaseTerm_${term.termLength}`}
                  value={baseRent}
                  displayValue={baseRent}
                  showPercentage
                  invalidInputError={t('THIS_FIELD_ONLY_ALLOWS_NUMBERS')}
                  lowerThanMinError={t('THIS_AMOUNT_LOWER_THAN_MIN_LIMIT')}
                  originalValue={originalBaseRent}
                  prefix={flyOutPrefix}
                  min={0}
                  {...flyoutMinMaxProps}
                  {...originalValueProp}
                  onChange={({ value }) =>
                    this.handleBaseRentAmountChange({
                      value,
                      term,
                      originalBaseRent,
                    })
                  }
                />
              </div>
            )}
            {!displayBaseRentEditor && <Money data-id={`baseRentLeaseTerm_${term.termLength}`} amount={term.adjustedMarketRent} />}
          </TextSecondary>
        </Cell>
      </Row>
    );
  };

  @action
  checkConcession(concession, value) {
    concession.selected = value;
    const { quoteModel } = this.props;
    quoteModel.enableQuoteSaving();
    // open FlyOutAmountEditor
    if (concession.variableAdjustment && !parseInt(concession.amountVariableAdjustment, 10)) {
      concession.shouldShowAmountEditor = true;
    }
  }

  renderCheckElement = concession => {
    if (concession.optional) {
      return (
        <CheckBox
          id={`concession${convertToCamelCaseAndRemoveBrackets(concession.displayName)}_checkBox`}
          checked={concession.selected}
          onChange={value => this.checkConcession(concession, value)}
        />
      );
    }
    return <IconButton iconName="check" />;
  };

  @action
  handleConcessionAmountChange({ value, concession, term }) {
    const valueAsNum = +value;
    const { amountVariableAdjustment } = concession;

    concession.amountVariableAdjustment = value;
    concession.variableAmountUpdatedByAgent = this.props.currentUserId;
    concession.selected = valueAsNum > 0;

    const { quoteModel } = this.props;

    if (valueAsNum !== +amountVariableAdjustment) {
      quoteModel.enableQuoteSaving();
    }

    getConcessionValue(concession, {
      amount: term.adjustedMarketRent,
      length: term.termLength,
    });
  }

  renderConcessionRows = term => {
    let { concessions } = term;

    if (this.state.collapse) {
      concessions = concessions.filter(c => !c.hideInSelfService || c.selected);
    }

    return concessions.sort(sortByOptionalAndAlphabetically).map(concession => {
      if (concession.bakedIntoAppliedFeeFlag) return '';

      const relativeAdjustment = Math.abs(concession.relativeAdjustment);
      const absoluteAdjustment = Math.abs(concession.absoluteAdjustment);
      const { variableAdjustment } = concession;
      const isNotVariable = !variableAdjustment;
      const isVariableAndSet = variableAdjustment && concession.amountVariableAdjustment > 0;
      const isRecurringAndSet = concession.recurring && (isNotVariable || isVariableAndSet);
      const adjustmentCaption = adjustmentText(concession, term);
      const { adjustedMarketRent } = term;
      const maxAmountLimit = getMaxAmountLimit(adjustedMarketRent, relativeAdjustment, absoluteAdjustment, concession.floorCeilingAmount);

      const flyOutPrefix = concession.recurring ? `$/${term.period}` : '$';

      return (
        <Row key={`${term.id}-${concession.id}`}>
          <Cell width={ICON_CELL_WIDTH} type="ctrlCell">
            {this.renderCheckElement(concession)}
          </Cell>
          <Cell>
            <TextPrimary inline={true}>{concession.displayName}</TextPrimary>
            {isRecurringAndSet && <TextSecondary>{adjustmentCaption}</TextSecondary>}
          </Cell>
          <Cell textAlign="right">
            <TextSecondary inline={true} data-id={`leaseTerms${term.termLength}_${convertToCamelCaseAndRemoveBrackets(concession.displayName)}`}>
              {t('SAVE')}
              {variableAdjustment && (
                <div className={cf('editable-amount')}>
                  <FlyOutAmountEditor
                    dataId={convertToCamelCaseAndRemoveBrackets(concession.displayName)}
                    value={concession.amountVariableAdjustment}
                    open={concession.shouldShowAmountEditor}
                    displayValue={getConcessionValue(concession, {
                      amount: adjustedMarketRent,
                      length: term.termLength,
                    })}
                    invalidInputError={t('THIS_FIELD_ONLY_ALLOWS_NUMBERS')}
                    greaterThanMaxError={t('THIS_AMOUNT_EXCEEDS_THE_MAX_LIMIT')}
                    lowerThanMinError={t('THIS_AMOUNT_LOWER_THAN_MIN_LIMIT')}
                    periodic={concession.recurring}
                    period={concession.recurringCount || term.termLength}
                    prefix={flyOutPrefix}
                    max={maxAmountLimit}
                    min={0}
                    onLabelClick={() => {
                      concession.shouldShowAmountEditor = true;
                    }}
                    onCloseRequest={() => {
                      concession.shouldShowAmountEditor = false;
                      // unselected concession
                      if (!parseInt(concession.amountVariableAdjustment, 10)) {
                        concession.selected = false;
                      }
                    }}
                    onChange={({ value }) =>
                      this.handleConcessionAmountChange({
                        value,
                        concession,
                        term,
                      })
                    }
                  />
                </div>
              )}
              {!variableAdjustment && (
                <Money amount={concession.amount} data-id={`leaseTerms${term.termLength}_${convertToCamelCaseAndRemoveBrackets(concession.displayName)}`} />
              )}
            </TextSecondary>
          </Cell>
        </Row>
      );
    });
  };

  renderBaseCharges = term => {
    const { selectedLeaseTermIds } = this.props.quoteModel;
    const isSelected = selectedLeaseTermIds.some(termId => termId === term.id);

    if (isSelected) {
      const termLength = termText(term);
      return (
        <div key={term.id}>
          <GroupTitle>
            {`${t('QUOTE_LEASE_LENGTH_TITLE', {
              length: termLength,
            })} ${t('QUOTE_ENDS_ON', {
              date: term.endDate.format(MONTH_DATE_YEAR_FORMAT),
            })}`}
          </GroupTitle>
          {this.renderBaseRentRows(term)}
          {this.renderConcessionRows(term)}
        </div>
      );
    }

    return '';
  };

  collapseExpand = () => this.setState({ collapse: !this.state.collapse });

  render() {
    const { leaseTerms } = this.props.quoteModel;
    const adjPeriod = getAdjFormOfPeriod(this.selectedTerm);
    const { isThereAnyHideInSelfServiceConcession, collapse } = this.state;
    const collapseExpandLabel = collapse ? t('EXPAND') : t('COLLAPSE');

    return (
      <Section
        data-id="baseMonthlyChargesSection"
        padContent={false}
        title={t('QUOTE_BASE_CHARGE_SECTION_TITLE', { period: adjPeriod })}
        actionItems={
          isThereAnyHideInSelfServiceConcession && (
            <Button data-id="expandButton" type="flat" btnRole="primary" label={collapseExpandLabel} onClick={this.collapseExpand} />
          )
        }>
        <Table>{leaseTerms && leaseTerms.map(this.renderBaseCharges)}</Table>
      </Section>
    );
  }
}

export default BaseChargeSection;
