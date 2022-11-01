/*
 * Copyright (c) 2022 Reva Technology Inc., all rights reserved.
 * Unauthorized copying of this file, via any medium is strictly prohibited
 * Licensed under the Elastic License 2.0; you may not use this file except
 * in compliance with the Elastic License 2.0.
 */

import React from 'react';
import { t } from 'i18next';
import { RedTable, Typography, FlyOutAmountEditor } from 'components';
import { ICON_CELL_WIDTH } from 'helpers/tableConstants';
import clsc from 'helpers/coalescy';
import { action } from 'mobx';
import { cf } from './quote.scss';
import { QuoteSection } from '../../../../common/enums/quoteTypes';
import { convertToCamelCaseAndRemoveBrackets } from '../../../../common/helpers/strings';
import { getFeeDataId } from '../../../../common/helpers/fee';

const { Row, Cell, TextPrimary, Money, TextSecondary } = RedTable;

const { Text } = Typography;

const handleFeeAmountChange = action(({ quoteModel, fee, newAmount, currentAmount, setSelectedFee }) => {
  if (!fee.originalTotalAmount) {
    fee.originalTotalAmount = currentAmount;
  }

  fee.amount = parseFloat(newAmount);
  fee.variableAdjustmentAmount = parseFloat(newAmount);
  quoteModel.enableQuoteSaving();

  setSelectedFee && setSelectedFee(true, fee, quoteModel);
});

const getParentQuantity = quantity => (quantity > 1 ? `${quantity} ` : '');
const getRowId = (isAdditionalSectionFee, feeId) => (isAdditionalSectionFee ? `additional-fee-row-${feeId}` : `one-time-fee-row-${feeId}`);

const FeeRow = ({ quoteModel, fee, checkComp, quantityComp, amount, isAdditionalSectionFee, groupName, setSelectedFee }) => {
  amount = parseFloat(clsc(fee.amount, amount));
  const parentQuantity = getParentQuantity(fee.quantity);
  const rowId = getRowId(isAdditionalSectionFee, fee.id);
  const flyOutPrefix = '$';
  const originalTotalAmount = parseFloat(clsc(fee.originalTotalAmount, amount));
  const minAmountValue = 0;
  return (
    <Row key={rowId}>
      <Cell width={ICON_CELL_WIDTH} type="ctrlCell">
        {checkComp}
      </Cell>
      <Cell dataId={getFeeDataId(fee, groupName, 'deposit')}>
        {!isAdditionalSectionFee && (
          <TextPrimary inline>
            {fee.displayName} {fee.parentFeeDisplayName && `(${parentQuantity} ${fee.parentFeeDisplayName})`}
          </TextPrimary>
        )}
        {isAdditionalSectionFee && (
          <TextPrimary inline>
            {fee.displayName} {fee.parentFeeDisplayName && `(${fee.parentFeeDisplayName})`}
          </TextPrimary>
        )}
        {fee.estimated && <Text secondary>({t('ESTIMATED')})</Text>}
      </Cell>
      {isAdditionalSectionFee && (
        <Cell width={100} textAlign="right">
          {fee.quoteSectionName !== QuoteSection.UTILITY.toLowerCase() && quantityComp}
        </Cell>
      )}
      <Cell dataId={`${getFeeDataId(fee, groupName, 'deposit')}_amount`} width={120} textAlign="right">
        {isAdditionalSectionFee && fee.isIGFee && !fee.isMinAndMaxRentEqual && !fee.selectedInventories.length && (
          <TextSecondary inline>{t('FROM')}</TextSecondary>
        )}
        {fee.variableAdjustment && (
          <div className={cf('editable-amount')}>
            <FlyOutAmountEditor
              value={amount}
              displayValue={amount}
              invalidInputError={t('THIS_FIELD_ONLY_ALLOWS_NUMBERS')}
              greaterThanMaxError={t('THIS_AMOUNT_EXCEEDS_THE_MAX_LIMIT')}
              originalValue={originalTotalAmount}
              prefix={flyOutPrefix}
              max={fee.maxAmount}
              min={minAmountValue}
              onChange={({ value }) => handleFeeAmountChange({ quoteModel, fee, newAmount: value, currentAmount: amount, setSelectedFee })}
              dataId={convertToCamelCaseAndRemoveBrackets(fee.displayName)}
            />
          </div>
        )}
        {!fee.variableAdjustment && <Money dataId={`${getFeeDataId(fee, groupName, 'deposit')}_amount`} amount={amount} />}
      </Cell>
    </Row>
  );
};

export default FeeRow;
