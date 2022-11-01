/*
 * Copyright (c) 2022 Reva Technology Inc., all rights reserved.
 * Unauthorized copying of this file, via any medium is strictly prohibited
 * Licensed under the Elastic License 2.0; you may not use this file except
 * in compliance with the Elastic License 2.0.
 */

import React from 'react';
import { RedTable, Typography } from 'components';
import { t } from 'i18next';
import { termText, getAdjFormOfPeriod, getTotalConcessions, flattenedChargeInfo } from 'helpers/quotes';
import { ConcessionsBlock } from 'custom-components/QuoteSummary/QuoteSummary';
import { cf } from './QuoteResult.scss';
import { convertToCamelCaseAndRemoveBrackets } from '../../../../common/helpers/strings';

const { Title, Caption, Text } = Typography;

const { Table, Header, Row, Cell, TextPrimary, Money, TextSecondary } = RedTable;

const renderPaymentRows = paymentSchedule =>
  paymentSchedule.map((period, rowKey) => (
    // TODO: We need to find a proper id here
    // eslint-disable-next-line react/no-array-index-key
    <Row className={cf('simple-row')} key={rowKey}>
      <Cell noSidePadding textAlign="left">
        {period.timeframe}
      </Cell>
      <Cell noSidePadding width="35%" textAlign="right">
        <Money amount={period.amount} />
      </Cell>
    </Row>
  ));

const renderRow = (charge, rowKey) => {
  const idPrefix = charge.displayName.replace(/(\s)|(\()|(\))/g, '_').toLowerCase();
  return (
    <Row className={cf('simple-row')} key={rowKey}>
      <Cell noSidePadding>
        <TextPrimary dataId={`${idPrefix}_fee`}>{charge.displayName}</TextPrimary>
        {charge.estimated && <Text secondary>({t('ESTIMATED')})</Text>}
      </Cell>
      <Cell dataId={`${convertToCamelCaseAndRemoveBrackets(charge.displayName)}_amount`} noSidePadding width="35%" textAlign="right">
        {charge.isMinAndMaxRentDiff && <TextSecondary inline>{t('FROM')}</TextSecondary>}
        <Money dataId={`${idPrefix}_feeAmount`} amount={charge.amount ? charge.amount : 0} />
      </Cell>
    </Row>
  );
};

const renderTable = (title, charges, term, period, showBaseRentAndTotal = false) => (
  <Table dataId={`${convertToCamelCaseAndRemoveBrackets(title)}_table`} className={cf('simple-table')}>
    <Header className={cf('simple-table-header')}>
      <Caption>{title}</Caption>
    </Header>
    {showBaseRentAndTotal && (
      <Row className={cf('simple-row')}>
        <Cell noSidePadding>
          <TextPrimary>{t('BASE_RENT')}</TextPrimary>
        </Cell>
        <Cell dataId="baseRent_amount" width="35%" noSidePadding textAlign="right">
          <Money amount={term.adjustedMarketRent} />
        </Cell>
      </Row>
    )}
    {charges.map((charge, chargeIndex) => renderRow(charge, chargeIndex))}
    {showBaseRentAndTotal && (
      <Row className={cf('simple-row')}>
        <Cell noSidePadding>
          <Text className={cf('total-label')}>{`${period} ${t('TOTAL')}`}</Text>
        </Cell>
        <Cell dataId="totalMonthlyChargesAmount" width="35%" noSidePadding textAlign="right">
          <Money dataId="feesTotal" amount={term.totalMonthlyCharges} noFormat currency="USD" className={cf('total-label')} />
        </Cell>
      </Row>
    )}
  </Table>
);

const renderSpecialsTable = (title, term) => (
  <Table dataId="specialConcessionTable" className={cf('simple-table')}>
    <Header className={cf('simple-table-header')}>
      <Caption>{title}</Caption>
    </Header>
    <ConcessionsBlock concessions={term.chargeConcessions ? [...term.concessions, ...term.chargeConcessions] : term.concessions} term={term} />
    <Row className={cf('simple-row')}>
      <Cell noSidePadding>
        <Text className={cf('total-label')}>{t('TOTAL')}</Text>
      </Cell>
      <Cell dataId="totalSpecialConcessionAmount" width="35%" noSidePadding textAlign="right">
        <Text highlight={true} className={cf('bold')}>
          {t('SAVE')}
          <Money
            dataId="concessionsTotal"
            amount={getTotalConcessions(term.chargeConcessions ? [...term.concessions, ...term.chargeConcessions] : term.concessions)}
            noFormat
            currency="USD"
            className={cf('total-label')}
          />
        </Text>
      </Cell>
    </Row>
  </Table>
);

const areConcessionsSelected = leaseTerm => {
  const concessions = leaseTerm.chargeConcessions ? [...leaseTerm.concessions, ...leaseTerm.chargeConcessions] : leaseTerm.concessions;

  if (!concessions || !concessions.length) return false;

  return concessions.some(c => c.selected);
};

const ChargesBlock = ({ additionalAndOneTimeCharges, leaseTerm }) => {
  const termLength = termText(leaseTerm);
  const period = getAdjFormOfPeriod(leaseTerm);
  const oneTimeCharges =
    additionalAndOneTimeCharges && additionalAndOneTimeCharges.oneTimeCharges
      ? flattenedChargeInfo(additionalAndOneTimeCharges.oneTimeCharges, leaseTerm.id, false)
      : [];

  return (
    <div className={cf('block')}>
      <Table className={cf('simple-table')}>
        <Header className={cf('simple-table-header')}>
          <Title>
            {' '}
            {t('PAYMENT_SCHEDULE_CARD_TITLE', {
              length: termLength,
            })}{' '}
          </Title>
          <Caption>{t('DETAILED_CHARGES_EXCLUDING_ONE_TIME')}</Caption>
        </Header>
        {leaseTerm.paymentSchedule && renderPaymentRows(leaseTerm.paymentSchedule)}
      </Table>
      {renderTable(
        t('DETAILS_PERIOD_CHARGES', { period }),
        flattenedChargeInfo(additionalAndOneTimeCharges.additionalCharges, null, false),
        leaseTerm,
        period,
        true,
      )}
      {areConcessionsSelected(leaseTerm) && renderSpecialsTable(t('SPECIALS'), leaseTerm)}
      {oneTimeCharges.length > 0 && renderTable(t('DETAILS_ONE_TIME_CHARGES'), oneTimeCharges, leaseTerm)}
    </div>
  );
};

export default ChargesBlock;
