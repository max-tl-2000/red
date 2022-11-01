/*
 * Copyright (c) 2022 Reva Technology Inc., all rights reserved.
 * Unauthorized copying of this file, via any medium is strictly prohibited
 * Licensed under the Elastic License 2.0; you may not use this file except
 * in compliance with the Elastic License 2.0.
 */

import React, { Component } from 'react';
import { observer, inject, Observer } from 'mobx-react';
import { t } from 'i18next';
import { Typography, CheckBox, RedTable, Button, Field, IconButton } from 'components';
import { cf } from './application-charges.scss';
import { DALTypes } from '../../../../common/enums/DALTypes';
import { formatMoney } from '../../../../common/money-formatter';
import { isNegativeFee } from '../../helpers/utils';
import { HoldDepositApplicationSettingsValues } from '../../../../common/enums/applicationTypes';
import PreloaderBlock from '../../../../client/components/PreloaderBlock/PreloaderBlock';

const { Text } = Typography;

@inject('application', 'applicationSettings')
@observer
export class ApplicationCharges extends Component {
  constructor(props) {
    super(props);
    this.state = { applicationFees: props.application.details.applicationFees };
  }

  handleChange = (feeId, value) => {
    const { applicationFees } = this.state;
    applicationFees.updateSelection(feeId, value);
  };

  reloadFees = () => {
    const { applicationFees } = this.state;
    applicationFees.fetchFees();
  };

  render() {
    const { applicationFees } = this.state;
    const { Table, Row, Cell, Money } = RedTable;

    const getUnitInfoText = (shouldNotDisplayUnitInfo, unitInfo, holdDurationInHours) =>
      shouldNotDisplayUnitInfo
        ? ''
        : t('HOLD_DEPOSIT_VALID_FOR', {
            unitInfo,
            period: holdDurationInHours,
          });

    const getSecondaryText = ({ feeType, unitInfo, holdDurationInHours, amount, payerName, isHeld }) => {
      const { holdDepositWithoutUnit } = this.props.applicationSettings;

      const shouldNotDisplayUnitInfo =
        isHeld || (!unitInfo && holdDepositWithoutUnit && holdDepositWithoutUnit !== HoldDepositApplicationSettingsValues.HIDDEN);
      if (feeType !== DALTypes.FeeType.HOLD_DEPOSIT) return '';
      const { result: formattedAmount } = formatMoney({
        amount,
        currency: 'USD',
      });

      return payerName
        ? t('HOLD_DEPOSIT_PAID_BY', { payerName, amount: formattedAmount })
        : getUnitInfoText(shouldNotDisplayUnitInfo, unitInfo, holdDurationInHours);
    };

    const renderFee = (fee, rowKey) => (
      <Row key={rowKey}>
        <Cell>
          <div className={cf('fee')}>
            {!fee.payerName &&
              (!fee.isRequired ? (
                <CheckBox leftAligned checked={fee.selected} onChange={checked => this.handleChange(fee.feeId, checked)} />
              ) : (
                <IconButton iconName="check" />
              ))}
            <Text inline data-id={`feeName${rowKey + 1}`}>
              {fee.feeName}
            </Text>
            <Text secondary inline className={cf('secondary-text')}>
              {getSecondaryText(fee)}
            </Text>
          </div>
          {fee.feeType === DALTypes.FeeType.HOLD_DEPOSIT && (
            <div className={cf('feeDisclaimer')}>
              <Text inline secondary className={cf({ disclaimerText: !fee.isRequired && !fee.payerName })}>
                {t('HOLD_DEPOSIT_DISCLAIMER', { feeDisplayName: fee.feeName })}
              </Text>
            </div>
          )}
        </Cell>
        <Cell width={90} textAlign="right" verticalAlign="top">
          <div className={cf('feeAmount', { extraPaddingTop: !fee.isRequired && !fee.payerName })}>
            {fee.payerName && <Text>––</Text>}
            {!fee.payerName && <Money dataId={`feeAmount${rowKey + 1}`} amount={(isNegativeFee(fee.feeType) ? -1 : 1) * fee.amount} />}
          </div>
        </Cell>
      </Row>
    );

    const renderCharges = ({ items: charges = [], totalAmount }) => (
      <Table>
        {charges.map((fee, feeIndex) => renderFee(fee, feeIndex))}
        <Row>
          <Cell>
            <Text bold>{t('TOTAL')}</Text>
          </Cell>
          <Cell width={90}>
            <Money bold amount={totalAmount} currency="USD" />
          </Cell>
        </Row>
      </Table>
    );

    return (
      <div style={{ paddingTop: '.5rem' }}>
        <Observer>
          {() =>
            applicationFees.error && (
              <div style={{ padding: 20, paddingBottom: 0 }}>
                <Field inline columns={9}>
                  <Text inline bold error>
                    {t('ERROR_LOADING_FEES', { errorCode: applicationFees.error })}
                  </Text>
                </Field>
                <Field inline columns={3} last style={{ textAlign: 'right' }}>
                  <Button type="flat" label={t('TRY_AGAIN')} onClick={this.reloadFees} />
                </Field>
              </div>
            )
          }
        </Observer>
        <Observer>{() => applicationFees.loading && <PreloaderBlock style={{ height: 90, minHeight: 90 }} size="small" />}</Observer>
        <Observer>{() => <div>{applicationFees.hasFees && renderCharges(applicationFees)}</div>}</Observer>
      </div>
    );
  }
}
