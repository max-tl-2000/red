/*
 * Copyright (c) 2022 Reva Technology Inc., all rights reserved.
 * Unauthorized copying of this file, via any medium is strictly prohibited
 * Licensed under the Elastic License 2.0; you may not use this file except
 * in compliance with the Elastic License 2.0.
 */

import PropTypes from 'prop-types';
import React from 'react';
import { t } from 'i18next';
import { quoteSectionRepresentation, getCharges, termText, getDepositRelativeAmountForSelectedLeaseTerms } from 'helpers/quotes';
import { observer } from 'mobx-react';
import { action } from 'mobx';
import { ICON_CELL_WIDTH } from 'helpers/tableConstants';
import { RedTable, Typography, CheckBox, IconButton, Section } from 'components';
import { setVisibleAndSelected, setDepositsRelativeAmount } from '../../../../common/helpers/quotes';
import { Charges } from '../../../../common/enums/quoteTypes';

import ConcessionRow from './ConcessionRow';
import FeeRow from './FeeRow';
import { DALTypes } from '../../../../common/enums/DALTypes';
import { convertToCamelCaseAndRemoveBrackets } from '../../../../common/helpers/strings';

const { Table, Row, RowHeader, Cell, Money, GroupTitle } = RedTable;

const { Text } = Typography;

@observer
class OneTimeChargeSection extends React.Component {
  static propTypes = {
    quoteModel: PropTypes.object,
  };

  get selectedTerm() {
    return this.props.quoteModel.selectedTerm;
  }

  @action
  setSelectedFee(isVisible, fee) {
    const { quoteModel } = this.props;
    quoteModel.enableQuoteSaving();
    const fees = quoteModel.additionalAndOneTimeCharges;

    const additionalOneTimeFees = setVisibleAndSelected(fees, this.selectedTerm.period, isVisible, fee);

    quoteModel.additionalAndOneTimeCharges = setDepositsRelativeAmount({
      additionalOneTimeFees,
      leaseTermsIds: quoteModel.selectedLeaseTermIds,
      selectedFee: fee,
      changeAll: isVisible,
    });
  }

  @action
  setSelectedStateOfLeaseTerm(isSelected, fee, leaseTerm, isAnyLeaseTermSelected) {
    const { quoteModel } = this.props;

    quoteModel.enableQuoteSaving();
    const fees = quoteModel.additionalAndOneTimeCharges;
    if (!isAnyLeaseTermSelected) {
      quoteModel.additionalAndOneTimeCharges = setVisibleAndSelected(fees, this.selectedTerm.period, isSelected, fee);
    }
    quoteModel.additionalAndOneTimeCharges = setDepositsRelativeAmount({
      additionalOneTimeFees: fees,
      leaseTermsIds: quoteModel.selectedLeaseTermIds,
      selectedFee: fee,
      selectedLeaseTerm: leaseTerm,
    });
  }

  renderLeaseTermsRows(fee, leaseTerms) {
    return leaseTerms.map((leaseTerm, i) => {
      const periodTxt = termText(leaseTerm);
      const isAnyLeaseTermSelected = leaseTerms.some(
        lt => lt.relativeAmountByLeaseTerm.selected === true && lt.relativeAmountByLeaseTerm.leaseTermId !== leaseTerm.id,
      );
      if (isAnyLeaseTermSelected || leaseTerm.relativeAmountByLeaseTerm.selected) {
        // TODO: why is the index needed here?
        // eslint-disable-next-line react/no-array-index-key
        const key = `${leaseTerm.id}-${i}`;
        return (
          <Row key={key} indentLevel={1}>
            <Cell width={ICON_CELL_WIDTH} type="ctrlCell">
              {fee.isAdditional && <IconButton iconName="check" />}
              {!fee.isAdditional && (
                <CheckBox
                  checked={leaseTerm.relativeAmountByLeaseTerm.selected}
                  onChange={isSelected => this.setSelectedStateOfLeaseTerm(isSelected, fee, leaseTerm, isAnyLeaseTermSelected)}
                />
              )}
            </Cell>
            <Cell dataId={convertToCamelCaseAndRemoveBrackets(periodTxt)}>
              <Text>{`${t('LENGTH_LEASE_TERM_TITLE', {
                period: periodTxt,
              })}`}</Text>
            </Cell>
            <Cell dataId={`${convertToCamelCaseAndRemoveBrackets(periodTxt)}_amount`} width={150} textAlign="right">
              <Money amount={leaseTerm.depositAmount} />
            </Cell>
          </Row>
        );
      }
      return <div />;
    });
  }

  renderRows(fees, groupName) {
    const { quoteModel } = this.props;

    let depositAmount = 0;
    return fees.map(fee => {
      depositAmount = fee.amount;
      let checkComp;
      const parentQuantity = fee.quantity > 1 ? `${fee.quantity} ` : '';
      if (fee.isAdditional) {
        checkComp = <IconButton iconName="check" />;
      } else {
        checkComp = (
          <CheckBox
            id={`${convertToCamelCaseAndRemoveBrackets(fee.displayName)}_oneTimeFeeCheckComp`}
            checked={fee.selected}
            onChange={value => this.setSelectedFee(value, fee)}
          />
        );
      }
      if (fee.feeType === DALTypes.FeeType.DEPOSIT && fee.relativeAmountsByLeaseTerm) {
        if (fee.parentFeeAmount) {
          depositAmount = fee.relativeAmountsByLeaseTerm[0].amount;
        } else {
          const leaseTermsInfo = getDepositRelativeAmountForSelectedLeaseTerms(fee, quoteModel.selectedLeaseTermIds);
          if (leaseTermsInfo.leaseTerms) {
            return (
              <div data-id={convertToCamelCaseAndRemoveBrackets(fee.displayName)} key={`div-fee-deposit-${fee.id}`}>
                <Row dataId={convertToCamelCaseAndRemoveBrackets(fee.displayName)} noDivider key={`fee-deposit-${fee.id}`}>
                  <Cell width={ICON_CELL_WIDTH} type="ctrlCell">
                    {checkComp}
                  </Cell>
                  <Cell>
                    <Text inline>
                      {fee.displayName} {fee.parentFeeDisplayName && `(${parentQuantity} ${fee.parentFeeDisplayName})`}
                    </Text>
                  </Cell>
                </Row>
                {this.renderLeaseTermsRows(fee, leaseTermsInfo.leaseTerms)}
              </div>
            );
          }
          depositAmount = leaseTermsInfo.depositAmount;
        }
      }

      if (fee.variableAdjustmentAmount) {
        depositAmount = fee.variableAdjustmentAmount;
      }

      return (
        <div key={`div-fee-${fee.id}`}>
          <FeeRow quoteModel={quoteModel} fee={fee} checkComp={checkComp} amount={depositAmount} isAdditionalSectionFee={false} groupName={groupName} />
          {fee.concessions && <ConcessionRow quoteModel={quoteModel} fee={fee} />}
        </div>
      );
    });
  }

  renderOnTimeCharges = charge => {
    const visibleFees = charge.fees.filter(f => f.visible).length;
    return (
      charge &&
      !!visibleFees && (
        <div key={charge.name} data-id={charge.name}>
          <GroupTitle>{quoteSectionRepresentation(charge.name)}</GroupTitle>
          {this.renderRows(
            charge.fees.filter(fee => fee.visible),
            charge.name,
          )}
        </div>
      )
    );
  };

  renderRowHeader = () => (
    <RowHeader>
      <Cell>{t('QUOTE_DRAFT_ON_TIME_CHARGE_DESCRIPTION')}</Cell>
      <Cell width={120} textAlign="right">
        {t('AMOUNT')}
      </Cell>
    </RowHeader>
  );

  render() {
    const { additionalAndOneTimeCharges } = this.props.quoteModel;
    const additionalAndOneTimeFees = additionalAndOneTimeCharges.find(periodType => periodType.name === this.selectedTerm.period);
    const oneTimeCharges = additionalAndOneTimeFees ? getCharges(additionalAndOneTimeFees.fees, Charges.ONETIME) : [];

    return (
      !!oneTimeCharges.length && (
        <Section data-id="oneTimeChargesSection" title={t('QUOTE_ONE_TIME_CHARGE_SECTION_TITLE')} padContent={false}>
          <Table dataId="oneTimeChargesTable">
            {this.renderRowHeader()}
            {oneTimeCharges && oneTimeCharges.map(this.renderOnTimeCharges)}
          </Table>
        </Section>
      )
    );
  }
}

export default OneTimeChargeSection;
