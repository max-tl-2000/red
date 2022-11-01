/*
 * Copyright (c) 2022 Reva Technology Inc., all rights reserved.
 * Unauthorized copying of this file, via any medium is strictly prohibited
 * Licensed under the Elastic License 2.0; you may not use this file except
 * in compliance with the Elastic License 2.0.
 */

import PropTypes from 'prop-types';
import React, { Component } from 'react';
import { RedTable, Typography as T, Icon, Button } from 'components';
import { t } from 'i18next';
import sortBy from 'lodash/sortBy';
import { cf } from './ChargeStepperSection.scss';
import { DATE_ONLY_FORMAT } from '../../../common/date-constants';
import { toMoment } from '../../../common/helpers/moment-utils';

const { Table, Row, Cell, TextPrimary, Money, SubTitle, RowHeader } = RedTable;

export default class ChargeStepperSection extends Component {
  constructor() {
    super();

    this.state = {
      isExpanded: false,
    };
  }

  static propTypes = {
    charges: PropTypes.array,
    checked: PropTypes.bool,
    checkedFunc: PropTypes.func,
  };

  handleExpandSection = () => this.setState({ isExpanded: true });

  renderChargesTable = charges => (
    <Table className={cf('charge-table')} wide>
      <RowHeader className={cf('row')}>
        <Cell width="15%">
          <SubTitle>{t('CHARGE_CODE')}</SubTitle>
        </Cell>
        <Cell width="25%">
          <SubTitle>{t('DESCRIPTION')}</SubTitle>
        </Cell>
        <Cell width="12%" textAlign="center">
          <SubTitle>{t('EFFECTIVE_DATE')}</SubTitle>
        </Cell>
        <Cell width="12%" textAlign="center">
          <SubTitle>{t('END_DATE')}</SubTitle>
        </Cell>
        <Cell textAlign="right">
          <SubTitle>{t('AMOUNT')}</SubTitle>
        </Cell>
      </RowHeader>
      {this.renderChargesRows(charges)}
    </Table>
  );

  renderChargesRows = charges =>
    sortBy(charges, charge => [charge.code, +toMoment(charge.endDate).format('YYYYMMDD')]).map((charge, index) => (
      // eslint-disable-next-line react/no-array-index-key
      <Row key={`charge_${index}`} className={cf('row')}>
        <Cell width="15%">
          <TextPrimary>{charge?.code.toUpperCase()}</TextPrimary>
        </Cell>
        <Cell width="25%">
          <TextPrimary>{charge?.displayName || charge?.description}</TextPrimary>
        </Cell>
        <Cell width="12%" textAlign="center">
          <TextPrimary>{toMoment(charge.startDate, { timezone: this.props.timezone }).format(DATE_ONLY_FORMAT)}</TextPrimary>
        </Cell>
        <Cell width="12%" textAlign="center">
          <TextPrimary>{charge?.endDate ? toMoment(charge.endDate, { timezone: this.props.timezone }).format(DATE_ONLY_FORMAT) : ''}</TextPrimary>
        </Cell>
        <Cell textAlign="right">
          <Money amount={charge?.amount} currency="USD" />
        </Cell>
      </Row>
    ));

  renderUncheckedSection = () => {
    const { charges, message, checked, btnTxt, checkFunc, btnDataId } = this.props;

    return (
      <div className={cf('charge-section-unchecked', { unchecked: !checked })}>
        <Icon name="alert" className={cf('alert-icon')} />
        <div className={cf('charge-content')}>
          <T.Text>{message}</T.Text>
          {charges && charges.length && this.renderChargesTable(charges)}
          {!checked && (
            <div className={cf('button-wrapper')}>
              <Button data-id={btnDataId} type="raised" btnRole="secondary" label={btnTxt} onClick={() => checkFunc(false)} />
            </div>
          )}
        </div>
      </div>
    );
  };

  renderCheckedSection = () => {
    const { checkedMessage } = this.props;
    const { isExpanded } = this.state;

    return (
      <div className={cf('charge-section', { isNotExpanded: !isExpanded })} onClick={this.handleExpandSection} disabled={isExpanded}>
        {isExpanded && this.renderUncheckedSection()}
        <div className={cf('charge-section-checked')}>
          <div className={cf('charge-section-checked-text')}>
            <Icon name="check" className={cf('check-icon')} />
            <T.Text> {checkedMessage} </T.Text>
          </div>
          {!isExpanded && <Icon name="chevron-down" />}
        </div>
      </div>
    );
  };

  render = () => {
    const { checked } = this.props;

    return checked ? this.renderCheckedSection() : this.renderUncheckedSection();
  };
}
