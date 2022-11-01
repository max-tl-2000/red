/*
 * Copyright (c) 2022 Reva Technology Inc., all rights reserved.
 * Unauthorized copying of this file, via any medium is strictly prohibited
 * Licensed under the Elastic License 2.0; you may not use this file except
 * in compliance with the Elastic License 2.0.
 */

import PropTypes from 'prop-types';
import React, { Component } from 'react';
import { t } from 'i18next';
import { sortByOptionalAndAlphabetically, getMaxAmountLimit, adjustmentText } from 'helpers/quotes';

import { observer } from 'mobx-react';
import { action } from 'mobx';
import { ICON_CELL_WIDTH } from 'helpers/tableConstants';
import { RedTable, CheckBox, IconButton, FlyOutAmountEditor } from 'components';
import { cf } from './quote.scss';
import { getConcessionValue } from '../../../../common/helpers/quotes';
import { getFixedAmount } from '../../../../common/helpers/number';

const { Row, Cell, TextPrimary, TextSecondary, Money } = RedTable;

@observer
class ConcessionRow extends Component {
  static propTypes = {
    quoteModel: PropTypes.object,
    fee: PropTypes.object,
  };

  get selectedTerm() {
    return this.props.quoteModel.selectedTerm;
  }

  @action
  checkConcession(concession, value) {
    const { quoteModel } = this.props;

    concession.selected = value;
    quoteModel.enableQuoteSaving();

    if (concession.variableAdjustment && !concession.amountVariableAdjustment) {
      concession.shouldShowAmountEditor = true;
    }
  }

  renderCheckConcession = concession => {
    if (concession.optional) {
      return <CheckBox checked={concession.selected} onChange={value => this.checkConcession(concession, value)} />;
    }
    return <IconButton iconName="check" />;
  };

  @action
  handleAmountChange({ value, concession }) {
    const valueAsNum = +value;
    const { amountVariableAdjustment } = concession;

    concession.amountVariableAdjustment = getFixedAmount(valueAsNum, 2);
    concession.selected = valueAsNum > 0;

    const { quoteModel } = this.props;
    if (valueAsNum !== +amountVariableAdjustment) {
      quoteModel.enableQuoteSaving();
    }
  }

  renderConcessionRows = fee => {
    const { concessions, selected: isFeeSelected, price: feePrice, id: feeId } = fee;

    return (
      isFeeSelected &&
      concessions.sort(sortByOptionalAndAlphabetically).map(concession => {
        const {
          id: concessionId,
          displayName,
          bakedIntoAppliedFeeFlag,
          shouldShowAmountEditor,
          variableAdjustment,
          amountVariableAdjustment,
          recurringCount,
          relativeAdjustment,
          absoluteAdjustment,
          recurring,
          amount,
          floorCeilingAmount,
        } = concession;

        if (bakedIntoAppliedFeeFlag) return '';

        const term = {
          adjustedMarketRent: feePrice,
          termLength: recurringCount, // TODO: CG: Why don't we have the term length from the lease term here as well?
        };

        const isNotVariable = !variableAdjustment;
        const isVariableAndSet = variableAdjustment && amountVariableAdjustment > 0;
        const isRecurringAndSet = recurring && (isNotVariable || isVariableAndSet);
        const adjustmentCaption = adjustmentText(concession, this.selectedTerm);

        const maxAmountLimit = getMaxAmountLimit(feePrice, Math.abs(relativeAdjustment), Math.abs(absoluteAdjustment), floorCeilingAmount);
        const minAmountValue = 0;
        const flyOutPrefix = recurring ? `$/${this.selectedTerm.period}` : '$';

        return (
          <Row key={`${feeId}-${concessionId}`} indentLevel={1}>
            <Cell width={ICON_CELL_WIDTH} type="ctrlCell">
              {this.renderCheckConcession(concession)}
            </Cell>
            <Cell>
              <TextPrimary inline={true}>{displayName}</TextPrimary>
              {isRecurringAndSet && <TextSecondary>{adjustmentCaption}</TextSecondary>}
            </Cell>
            <Cell textAlign="right">
              <TextSecondary inline={true}>
                {t('SAVE')}
                {variableAdjustment && (
                  <div className={cf('editable-amount')}>
                    <FlyOutAmountEditor
                      value={amountVariableAdjustment}
                      open={shouldShowAmountEditor}
                      displayValue={getConcessionValue(concession, {
                        amount: term.adjustedMarketRent,
                        length: term.termLength,
                      })}
                      invalidInputError={t('THIS_FIELD_ONLY_ALLOWS_NUMBERS')}
                      greaterThanMaxError={t('THIS_AMOUNT_EXCEEDS_THE_MAX_LIMIT')}
                      periodic={recurring}
                      period={recurringCount || this.selectedTerm.termLength}
                      prefix={flyOutPrefix}
                      max={maxAmountLimit}
                      min={minAmountValue}
                      onLabelClick={() => {
                        concession.shouldShowAmountEditor = true;
                      }}
                      onCloseRequest={() => {
                        concession.shouldShowAmountEditor = false;
                      }}
                      onChange={({ value }) => this.handleAmountChange({ value, concession })}
                    />
                  </div>
                )}
                {!variableAdjustment && <Money amount={amount} />}
              </TextSecondary>
            </Cell>
          </Row>
        );
      })
    );
  };

  render() {
    return <div>{this.renderConcessionRows(this.props.fee)}</div>;
  }
}

export default ConcessionRow;
