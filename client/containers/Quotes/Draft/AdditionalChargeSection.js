/*
 * Copyright (c) 2022 Reva Technology Inc., all rights reserved.
 * Unauthorized copying of this file, via any medium is strictly prohibited
 * Licensed under the Elastic License 2.0; you may not use this file except
 * in compliance with the Elastic License 2.0.
 */

import PropTypes from 'prop-types';
import React from 'react';
import { t } from 'i18next';
import {
  getAdjFormOfPeriod,
  getPeriodName,
  quoteSectionRepresentation,
  setSelectedStateOfFeesForPeriod,
  getCharges,
  setSelectedInventories,
} from 'helpers/quotes';
import { observer } from 'mobx-react';
import { action } from 'mobx';
import { RedTable, Typography, CheckBox, Dropdown, IconButton, Section } from 'components';
import { ICON_CELL_WIDTH } from 'helpers/tableConstants';
import { setVisibleAndSelected, setQuantityAdditional, setDepositsRelativeAmount } from '../../../../common/helpers/quotes';
import { Charges } from '../../../../common/enums/quoteTypes';
import { convertToCamelCaseAndRemoveBrackets } from '../../../../common/helpers/strings';

import { cf } from './quote.scss';
import ConcessionRow from './ConcessionRow';
import FeeRow from './FeeRow';

const { Table, RowHeader, Cell, GroupTitle } = RedTable;

const { Text } = Typography;

@observer
class AdditionalChargeSection extends React.Component {
  static propTypes = {
    quoteModel: PropTypes.object,
  };

  get selectedTerm() {
    const { quoteModel } = this.props;
    return quoteModel.selectedTerm;
  }

  // set fee amount and their children quantity if it has.
  @action
  setDataFromQuantity(newQuantity, fee) {
    const { quoteModel } = this.props;
    quoteModel.enableQuoteSaving();

    const fees = quoteModel.additionalAndOneTimeCharges;
    quoteModel.additionalAndOneTimeCharges = setQuantityAdditional(fees, this.selectedTerm.period, newQuantity, fee);
    quoteModel.additionalAndOneTimeCharges = setDepositsRelativeAmount({
      additionalOneTimeFees: fees,
      leaseTermsIds: quoteModel.selectedLeaseTermIds,
    });
    this.setSelectedFee(true, fee);
  }

  // set visible and selected properties for children fees which parents are selected before.
  @action
  setSelectedFee(isVisible, fee, feeQuoteModel) {
    const { quoteModel } = this?.props || { quoteModel: feeQuoteModel };
    const fees = quoteModel.additionalAndOneTimeCharges;
    quoteModel.additionalAndOneTimeCharges = setVisibleAndSelected(fees, quoteModel.selectedTerm.period, isVisible, fee);
    quoteModel.enableQuoteSaving();
  }

  @action
  setAndUnsetChecks(value) {
    const { quoteModel } = this.props;
    value ? this.checkAll() : this.unCheckAll();
    quoteModel.enableQuoteSaving();
  }

  checkAll() {
    const { quoteModel } = this.props;
    const fees = quoteModel.additionalAndOneTimeCharges;
    quoteModel.additionalAndOneTimeCharges = setSelectedStateOfFeesForPeriod(fees, this.selectedTerm.period, true);
  }

  unCheckAll() {
    const { quoteModel } = this.props;
    const fees = quoteModel.additionalAndOneTimeCharges;
    quoteModel.additionalAndOneTimeCharges = setSelectedStateOfFeesForPeriod(fees, this.selectedTerm.period, false);
  }

  @action
  selectedInventories = (fee, selectedInventories, somethingChanged) => {
    const { quoteModel } = this.props;

    if (somethingChanged) {
      quoteModel.enableQuoteSaving();
    }

    const fees = quoteModel.additionalAndOneTimeCharges;

    // TODO: technically the next line IS changing the additionalAndOneTimeCharges
    // so that means we should always enable the quoteModel.canSave???
    // regardless of the somethingChanged flag used avobe?
    quoteModel.additionalAndOneTimeCharges = setSelectedInventories(fees, this.selectedTerm.period, fee, selectedInventories);
  };

  renderRows(fees, groupName) {
    return fees.map(fee => {
      let quantityComp;
      let checkComp;
      if (fee.selectedInventories && fee.selectedInventories.length) {
        quantityComp = <Text className={cf('table-quantity')}>{fee.selectedInventories.length}</Text>;
      } else if (fee.maxQuantityInQuote > 1) {
        const quantityData = [...Array(fee.maxQuantityInQuote).keys()].map(i => ({ value: i + 1, content: i + 1 }));
        quantityComp = (
          <Dropdown
            items={quantityData}
            selectedValue={fee.quantity}
            positionArgs={{ my: 'right top', at: 'right top' }}
            textField="content"
            styled={false}
            valueField="value"
            onChange={args => this.setDataFromQuantity(args.item.value, fee)}
          />
        );
      } else {
        quantityComp = <Text className={cf('table-quantity')}>{fee.maxQuantityInQuote}</Text>;
      }

      if (fee.isAdditional) {
        checkComp = <IconButton id={`fee_${convertToCamelCaseAndRemoveBrackets(fee.displayName)}_checkComp`} iconName="check" />;
      } else {
        checkComp = (
          <CheckBox
            id={`fee_${convertToCamelCaseAndRemoveBrackets(fee.displayName)}_checkComp`}
            checked={fee.selected}
            onChange={value => this.setSelectedFee(value, fee)}
          />
        );
      }

      const { quoteModel } = this.props;

      return (
        <div key={`div-fee-${fee.id}`}>
          <FeeRow
            quoteModel={quoteModel}
            fee={fee}
            checkComp={checkComp}
            amount={fee.amount}
            quantityComp={quantityComp}
            isAdditionalSectionFee={true}
            selectedInventories={this.selectedInventories}
            groupName={groupName}
            setSelectedFee={this.setSelectedFee}
          />
          {fee.concessions && <ConcessionRow quoteModel={quoteModel} fee={fee} />}
        </div>
      );
    });
  }

  renderAdditionalCharges = charge => {
    const visibleFees = charge.fees.filter(f => f.visible).length;
    return (
      charge &&
      !!visibleFees && (
        <div data-id={charge.name} key={charge.name}>
          <GroupTitle>{quoteSectionRepresentation(charge.name)}</GroupTitle>
          {this.renderRows(
            charge.fees.filter(fee => fee.visible),
            charge.name,
          )}
        </div>
      )
    );
  };

  renderRowHeader = chargePeriod => (
    <RowHeader>
      <Cell width={ICON_CELL_WIDTH} type="ctrlCell">
        <CheckBox
          id="selectAllFeesCheckBox"
          type="checkAll"
          checked={this.props.quoteModel.areAllFeesSelected}
          onChange={value => this.setAndUnsetChecks(value)}
        />
      </Cell>
      <Cell>
        {t('QUOTE_DRAFT_ADDITIONAL_CHARGE_DESCRIPTION', {
          period: chargePeriod,
        })}
      </Cell>
      <Cell width={100} textAlign="right">
        {t('QUANTITY')}
      </Cell>
      <Cell width={120} textAlign="right">
        {t('AMOUNT')}
      </Cell>
    </RowHeader>
  );

  render() {
    const { additionalAndOneTimeCharges } = this.props.quoteModel;
    const periodName = getPeriodName(this.selectedTerm);
    const adjPeriod = getAdjFormOfPeriod(this.selectedTerm);
    const additionalAndOneTimeFees = additionalAndOneTimeCharges.find(periodType => periodType.name === this.selectedTerm.period);
    const additionalCharges = additionalAndOneTimeFees ? getCharges(additionalAndOneTimeFees.fees, Charges.ADDITIONAL) : [];
    return (
      !!additionalCharges.length && (
        <Section
          data-id="additionalChargesSection"
          padContent={false}
          title={t('QUOTE_ADDITIONAL_CHARGE_SECTION_TITLE', {
            period: adjPeriod,
          })}>
          <Table dataId="additionalChargesTable">
            {this.renderRowHeader(periodName)}
            {additionalCharges && additionalCharges.map(charge => this.renderAdditionalCharges(charge))}
          </Table>
        </Section>
      )
    );
  }
}

export default AdditionalChargeSection;
