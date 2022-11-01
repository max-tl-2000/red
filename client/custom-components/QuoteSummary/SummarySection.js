/*
 * Copyright (c) 2022 Reva Technology Inc., all rights reserved.
 * Unauthorized copying of this file, via any medium is strictly prohibited
 * Licensed under the Elastic License 2.0; you may not use this file except
 * in compliance with the Elastic License 2.0.
 */

import React from 'react';
import { Table, Header, Row, Cell, Money } from 'components/Table/RedTable';
import { SubHeader, Text, Headline } from 'components/Typography/Typography';
import { t } from 'i18next';
import { termText } from 'helpers/quoteTextHelpers';
import { cf } from './SummarySection.scss';
import ConcessionsBlock from './ConcessionsBlock';
import { MONTH_DATE_YEAR_FORMAT, MONTH_DATE_YEAR_LONG_FORMAT } from '../../../common/date-constants';
import { formatMoment } from '../../../common/helpers/moment-utils';
import { convertToCamelCaseAndRemoveBrackets } from '../../../common/helpers/strings';

const renderSummary = (term, i, timezone) => {
  const termLength = termText(term);
  return (
    <Table dataId={convertToCamelCaseAndRemoveBrackets(termLength)} className={cf('simple-table')} key={i}>
      <Header className={cf('simple-table-header')}>
        <SubHeader inline>
          {t('QUOTE_LEASE_LENGTH_TITLE', {
            length: termLength,
          })}
        </SubHeader>
        <Text inline secondary>
          {t('QUOTE_ENDS_ON', {
            date: formatMoment(term.endDate, { format: MONTH_DATE_YEAR_FORMAT, timezone, includeZone: false }),
          })}
        </Text>
      </Header>
      <Row className={cf('simple-row')}>
        <Cell noSidePadding>
          <Text>{t('BASE_RENT')}</Text>
        </Cell>
        <Cell dataId={`${convertToCamelCaseAndRemoveBrackets(termLength)}_baseRentAmount`} width="40%" noSidePadding textAlign="right">
          <Money amount={term.adjustedMarketRent} />
        </Cell>
      </Row>
      {term.concessions && term.concessions.length > 0 && <ConcessionsBlock concessions={term.concessions} term={term} />}
    </Table>
  );
};

const SummarySection = ({ quote, className, renderLeaseTerms = true }) => {
  const { leaseTerms, leaseStartDate, expirationDate, propertyTimezone: timezone } = quote;

  return (
    <div className={className}>
      <div className={cf('quote-info')}>
        <Text secondary>{t('LEASE_START_DATE')}</Text>
        <Headline id="summaryLeaseStartDateTxt">{formatMoment(leaseStartDate, { format: MONTH_DATE_YEAR_LONG_FORMAT, timezone, includeZone: false })}</Headline>
        <Text secondary id="summaryLeaseEndDateTxt">{`${t('QUOTE_EXPIRES')}${formatMoment(expirationDate, {
          format: MONTH_DATE_YEAR_LONG_FORMAT,
          timezone: quote.propertyTimezone,
          includeZone: false,
        })}`}</Text>
      </div>
      {renderLeaseTerms && leaseTerms && leaseTerms.map((lt, index) => renderSummary(lt, index, timezone))}
    </div>
  );
};

export default SummarySection;
