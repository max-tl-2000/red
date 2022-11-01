/*
 * Copyright (c) 2022 Reva Technology Inc., all rights reserved.
 * Unauthorized copying of this file, via any medium is strictly prohibited
 * Licensed under the Elastic License 2.0; you may not use this file except
 * in compliance with the Elastic License 2.0.
 */

import React from 'react';
import { toHumanReadableString } from '../../common/helpers/strings';
import { toSentenceCase } from '../../client/helpers/capitalize';
import { getActiveRecurringChargesForQuote } from '../../common/helpers/quotes';
import { excludeExternalChargeCodes } from '../../client/helpers/quotes';

const splitListInHalf = items => {
  if (!items || !items.length) return { left: [], right: [] };

  const size = items.length;
  const half = size % 2 === 0 ? size / 2 : size / 2 + 1;
  const left = items.reverse().slice(0, half);
  const right = items.slice(half);
  return { left, right };
};

const renderInventoryOverviewAndCTA = ({ quote, primaryPropertyTeam, styles, party } = {}) => {
  const emailHref = party.inReplyToEmail || primaryPropertyTeam.email.displayFormat;

  return (
    <mj-section>
      <mj-column padding-bottom="8px">
        <mj-text font-family="Roboto" color="#333333" line-height="18px" font-size="20px" padding-top="4px" padding-bottom="4px">
          {toSentenceCase(quote.inventory.type)} {quote.inventory.displayName}
        </mj-text>
        <mj-text font-family="Roboto" color="#333333" line-height="20px" font-size="13px" padding-top="4px">
          {quote.flattenedInventory.layoutInf}
        </mj-text>
      </mj-column>
      <mj-column vertical-align="top">
        <mj-button
          background-color={styles.primaryButtonBackgroundColor}
          color={styles.primaryButtonTextColor}
          border-radius="2px 2px 2px 2px"
          font-size="14px"
          font-weight="500"
          padding-bottom="8px"
          font-family="Roboto"
          padding-top="0px"
          padding-left="16px"
          padding-right="16px"
          width="94%"
          href={`mailto:${emailHref}?subject=Re:Renew your lease at ${quote.flattenedInventory.propertyName} today!`}
          text-transform="uppercase">
          Email now
        </mj-button>
        <mj-text font-family="Roboto" color="#757575" line-height="20px" font-size="13px" padding-top="4px">
          Or call or text{' '}
          <a target="_blank" href="{primaryPropertyTeam.phone.href}}">
            {primaryPropertyTeam.phone.displayFormat}
          </a>
        </mj-text>
      </mj-column>
    </mj-section>
  );
};

const renderAmmountLine = ({ description, amount }, index, zebraStripped = true) => {
  const styles = {
    padding: '.5rem',
  };
  return (
    <tr style={zebraStripped && index % 2 === 0 ? { backgroundColor: '#eeeeee' } : {}}>
      <td style={styles}>{description}</td>
      <td style={{ textAlign: 'right', whiteSpace: 'nowrap', ...styles }}>{amount}</td>
    </tr>
  );
};

const renderPriceTableSection = (prices, mapFunction, zebraStripped = true) => (
  <mj-table font-family="Roboto" color="#333333" font-size="13px" line-height="150%">
    {prices.map((price, index) => renderAmmountLine(mapFunction(price), index, zebraStripped))}
  </mj-table>
);

const renderRenewalPricingTable = ({ flattenedLeaseTerms }) => {
  const { left, right } = splitListInHalf(flattenedLeaseTerms);
  return (
    <mj-section>
      <mj-column vertical-align="top">
        {renderPriceTableSection(left, price => ({
          description: price.renewalPeriod,
          amount: price.baseRent,
        }))}
      </mj-column>
      <mj-column vertical-align="top">
        {renderPriceTableSection(right, price => ({
          description: price.renewalPeriod,
          amount: price.baseRent,
        }))}
      </mj-column>
    </mj-section>
  );
};

const renderFeesOnActiveLeases = ({ activeLease }) => {
  const recurringCharges = excludeExternalChargeCodes(activeLease.recurringCharges);
  const activeRecurringCharges = recurringCharges?.length && getActiveRecurringChargesForQuote(recurringCharges);

  if (!activeRecurringCharges || !activeRecurringCharges.length) return '';
  return `Your current lease reflects the following additional monthly charges: ${toHumanReadableString(
    activeRecurringCharges.map(it => `${it.quantity} x ${it.displayName} for a total of ${it.totalAmount}`),
  )}. `;
};

const renderFees = ({ renewalLeaseFees }) => {
  const { left, right } = splitListInHalf(renewalLeaseFees);
  return (
    <mj-section>
      <mj-column vertical-align="top">
        {renderPriceTableSection(
          left,
          price => ({
            description: price.displayName,
            amount: price.amount,
          }),
          false,
        )}
      </mj-column>
      <mj-column vertical-align="top">
        {renderPriceTableSection(
          right,
          price => ({
            description: price.displayName,
            amount: price.amount,
          }),
          false,
        )}
      </mj-column>
    </mj-section>
  );
};

export default ({ party, quote, primaryPropertyTeam, styles }) => {
  const { leaseStartDate } = quote;
  return (
    <mj-container>
      {renderInventoryOverviewAndCTA({ quote, primaryPropertyTeam, styles, party })}
      {renderRenewalPricingTable(quote)}
      <mj-section padding-top="0px" padding-bottom="0px" background-color="#ffffff">
        <mj-column>
          <mj-text font-family="Roboto, Arial" color="#212121" line-height="20px" font-size="13px">
            {renderFeesOnActiveLeases(party)}Please see below for applicable updated monthly charges effective {leaseStartDate}. If you would like to add any
            additional services below, please let us know.
          </mj-text>
        </mj-column>
      </mj-section>
      {renderFees(quote)}
    </mj-container>
  );
};
