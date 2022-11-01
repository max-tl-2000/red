/*
 * Copyright (c) 2022 Reva Technology Inc., all rights reserved.
 * Unauthorized copying of this file, via any medium is strictly prohibited
 * Licensed under the Elastic License 2.0; you may not use this file except
 * in compliance with the Elastic License 2.0.
 */

import React from 'react';
import { t } from 'i18next';

const AmountLine = ({ estimated, description, amount, header, adjustmentText }) => (
  <mj-container>
    {header && (
      <mj-text font-family="Roboto, Arial" padding-top="4px" padding-bottom="4px">
        {header}
      </mj-text>
    )}

    <mj-table font-family="Roboto, Arial" color="#212121" line-height="20px" font-size="13px" padding-top="4px" padding-bottom="24px">
      <tr>
        <td>
          <mj-section>
            {description} {estimated && <span style={{ color: '#757575' }}>({t('ESTIMATED')})</span>}
          </mj-section>
          {adjustmentText && (
            <mj-section style={{ display: 'block' }}>
              <mj-text style={{ fontSize: '11px', fontWeight: 100 }}>{adjustmentText}</mj-text>
            </mj-section>
          )}
        </td>
        <td style={{ textAlign: 'right' }}>{amount}</td>
      </tr>
    </mj-table>
  </mj-container>
);

const getTermPayments = paymentSchedule =>
  paymentSchedule
    ? paymentSchedule.reduce((termPaymentsArray, paymentScheduleItem) => {
        if (!!paymentScheduleItem.termPayments && Array.isArray(paymentScheduleItem.termPayments)) {
          return termPaymentsArray.concat(paymentScheduleItem.termPayments);
        }
        if (!!paymentScheduleItem.termPayments && !Array.isArray(paymentScheduleItem.termPayments)) {
          termPaymentsArray.push(paymentScheduleItem.termPayments.termPaymentSummary);
        }
        return termPaymentsArray;
      }, [])
    : [];

const renderComplimentaryItem = (complimentaryItem, lastItem = true) => {
  const itemNameStyle = { fontSize: '13px', lineHeight: '20px', color: '#212121' };

  return (
    <mj-container>
      <span style={itemNameStyle}>{complimentaryItem.name}</span>
      {complimentaryItem.secondaryName && <span style={{ fontSize: '12px', color: '#757575' }}> ({complimentaryItem.secondaryName})</span>}
      {!lastItem && <span style={itemNameStyle}>{', '}</span>}
    </mj-container>
  );
};

const renderConcessionItem = concession => (
  <AmountLine
    description={concession.concessionName}
    adjustmentText={concession.adjustmentText}
    amount={<span style={{ color: '#D500F9' }}>Save: {concession.concessionValue}</span>}
  />
);

const renderPeriodPaymentDetails = periodDetails => <AmountLine description={periodDetails.timeFrame} amount={periodDetails.amount} />;

const renderOneTimeChargeBox = oneTimeCharge => (
  <AmountLine estimated={oneTimeCharge.estimated} description={oneTimeCharge.displayName} amount={oneTimeCharge.amount} />
);

const renderLeaseTermBox = leaseTerm => (
  <mj-container>
    <mj-divider border-width="1px" border-color="#dddddd" />
    <AmountLine
      description="Base rent"
      amount={<span data-id="leasePriceTxtId">{leaseTerm.baseRent}</span>}
      header={
        <mj-container>
          <span style={{ fontSize: '15px' }}>{`${leaseTerm.period} `}</span>
          <span style={{ fontSize: '12px', color: '#757575' }}>{leaseTerm.endDate}</span>
        </mj-container>
      }
    />
    {leaseTerm && leaseTerm.concessions && leaseTerm.concessions && leaseTerm.concessions.map(concession => renderConcessionItem(concession))}
  </mj-container>
);

const renderAdditionalCharges = ({ formattedAdditionalCharges, fromTag }) => {
  const getAmmount = ({ amount, isMinAndMaxRentDiff }) => (
    <mj-container>
      {isMinAndMaxRentDiff && <span style={{ fontSize: '12px', color: '#757575' }}>{`${fromTag} `}</span>}
      {amount}
    </mj-container>
  );

  return formattedAdditionalCharges.map(additionalCharge => (
    <AmountLine
      key={additionalCharge.id}
      estimated={additionalCharge.estimated}
      description={additionalCharge.displayName}
      amount={getAmmount(additionalCharge)}
    />
  ));
};

const isOddAndLastItem = (termPayments, index) => !termPayments[index + 1] && index % 2 === 0;
const isEvenAndLastItem = (termPayments, index) => !termPayments[index + 1] && index % 2 === 1;

const renderLeaseTermDetailBox = (leaseTerm, index, { termPayments, flattenedInventory }) => (
  <mj-container>
    <mj-column width="48%" padding-left="1%" padding-right="1%" vertical-align="top" padding-bottom="24px">
      <mj-text
        font-family="Roboto, Arial"
        color="#212121"
        line-height="28px"
        font-size="20px"
        padding-top="4px"
        padding-bottom="4px"
        css-class="leaseTermTxtId">
        {leaseTerm.title}
      </mj-text>
      {leaseTerm.caption && (
        <mj-text font-family="Roboto, Arial" color="#757575" line-height="18px" font-size="12px" padding-top="4px" padding-bottom="4px">
          {leaseTerm.caption}
        </mj-text>
      )}

      {leaseTerm.periodPaymentDetails.map(periodDetails => renderPeriodPaymentDetails(periodDetails))}

      {leaseTerm && leaseTerm.concessions && leaseTerm.concessions.info && !!leaseTerm.concessions.info.length && (
        <mj-container>
          <mj-divider border-width="1px" border-color="#dddddd" />
          <mj-text font-family="Roboto, Arial" color="#212121" line-height="18px" font-size="12px" padding-top="4px" padding-bottom="4px">
            {leaseTerm.concessions.title}
          </mj-text>
          {leaseTerm && leaseTerm.concessions && leaseTerm.concessions.info && leaseTerm.concessions.info.map(concession => renderConcessionItem(concession))}
          {leaseTerm && leaseTerm.concessions && leaseTerm.totalConcessions && (
            <AmountLine
              description={<span style={{ fontWeight: 'bold' }}>{leaseTerm.totalConcessions.title}</span>}
              amount={<span style={{ fontWeight: 'bold', color: '#D500F9' }}>Save: {leaseTerm.totalConcessions.formattedAmount}</span>}
            />
          )}
        </mj-container>
      )}

      <mj-text font-family="Roboto, Arial" color="#212121" line-height="18px" font-size="12px" padding-top="4px" padding-bottom="4px">
        {leaseTerm.additionalChargesTitle}
      </mj-text>
      <AmountLine description={leaseTerm.baseRent.title} amount={leaseTerm.baseRent.formattedAmount} />
      {leaseTerm.formattedAdditionalCharges && !!leaseTerm.formattedAdditionalCharges.length && renderAdditionalCharges(leaseTerm)}
      <AmountLine
        description={<span style={{ fontWeight: 'bold' }}>{leaseTerm.totalCharges.title.toUpperCase()}</span>}
        amount={<span style={{ fontWeight: 'bold' }}>{leaseTerm.totalCharges.formattedAmount}</span>}
      />

      {leaseTerm && leaseTerm.oneTimeCharges && !!leaseTerm.oneTimeCharges.length && (
        <mj-container>
          <mj-divider border-width="1px" border-color="#dddddd" />
          <mj-text font-family="Roboto, Arial" color="#212121" line-height="18px" font-size="12px" padding-top="4px" padding-bottom="4px">
            Additional one-time charges
          </mj-text>
          {leaseTerm && leaseTerm.oneTimeCharges && leaseTerm.oneTimeCharges.map(oneTimeCharge => renderOneTimeChargeBox(oneTimeCharge))}
        </mj-container>
      )}

      <mj-spacer height="40px" />
    </mj-column>

    {isOddAndLastItem(termPayments, index) && (
      <mj-container>
        <mj-column width="48%" padding-left="1%" padding-right="1%" vertical-align="top">
          <mj-text font-family="Roboto, Arial" color="#212121" line-height="20px" font-size="13px" padding-top="4px" padding-bottom="4px" font-weight="bold">
            Amenities
          </mj-text>
          <mj-text
            font-family="Roboto, Arial"
            color="#757575"
            line-height="20px"
            font-size="12px"
            padding-top="4px"
            padding-bottom="4px"
            css-class="leaseAmenitiesTxtId">
            {flattenedInventory.highValueAmenities}
            <br />
            <br />
            {flattenedInventory.otherAmenities}
          </mj-text>
        </mj-column>
      </mj-container>
    )}

    {isEvenAndLastItem(termPayments, index) && (
      <mj-container>
        <mj-column width="96%" padding-left="2%" padding-right="2%" vertical-align="top">
          <mj-text font-family="Roboto, Arial" color="#212121" line-height="20px" font-size="13px" padding-top="4px" padding-bottom="4px" font-weight="bold">
            Amenities
          </mj-text>
          <mj-text
            font-family="Roboto, Arial"
            color="#757575"
            line-height="20px"
            font-size="12px"
            padding-top="4px"
            padding-bottom="4px"
            css-class="leaseAmenitiesTxtId">
            {flattenedInventory.highValueAmenities}
            <br />
            <br />
            {flattenedInventory.otherAmenities}
          </mj-text>
        </mj-column>
      </mj-container>
    )}
  </mj-container>
);

const Quote = ({ quote, styles }) => {
  const { applyNowUrl, leaseStartDate, expirationDate, flattenedInventory, flattenedLeaseTerms, paymentSchedule, hideApplicationLink = false } = quote;
  const { complimentaryItems } = flattenedInventory || {};

  const termPayments = getTermPayments(paymentSchedule);

  return (
    <mj-container>
      {flattenedInventory && (
        <mj-container>
          <mj-section>
            <mj-column width="48%" padding-right="1%" padding-left="1%" padding-bottom="24px" vertical-align="top">
              <mj-image src={flattenedInventory.imageUrl} padding-top="0px" padding-bottom="4px" alt={flattenedInventory.propertyName} />
              <mj-text font-family="Roboto, Arial" color="#212121" line-height="24px" font-size="15px" padding-top="4px" padding-bottom="4px">
                {flattenedInventory.propertyName}
              </mj-text>
              <mj-text
                font-family="Roboto, Arial"
                color="#212121"
                line-height="18px"
                font-size="12px"
                padding-top="4px"
                padding-bottom="24px"
                css-class="leaseUnitDescriptionTextId">
                {flattenedInventory.address}
                <br />
                {flattenedInventory.layoutInf}
              </mj-text>
              {complimentaryItems && complimentaryItems.items.length > 0 && (
                <mj-text font-family="Roboto, Arial" line-height="18px" font-size="12px" background-color="#e6e6e6" padding-bottom="24px">
                  <span style={{ color: '#757575' }}>{complimentaryItems.title}</span>
                  <br />
                  {complimentaryItems.items.map((complimentaryItem, index) =>
                    renderComplimentaryItem(complimentaryItem, index + 1 === complimentaryItems.items.length),
                  )}
                </mj-text>
              )}
            </mj-column>

            <mj-column width="48%" padding-right="1%" padding-left="1%" vertical-align="top">
              <mj-text font-family="Roboto, Arial" color="#757575" line-height="18px" font-size="12px" padding-top="4px" padding-bottom="4px">
                Lease start date
              </mj-text>
              <mj-text font-family="Roboto, Arial" color="#212121" line-height="32px" font-size="24px" padding-top="4px" padding-bottom="4px">
                {leaseStartDate}
              </mj-text>
              <mj-text font-family="Roboto, Arial" color="#757575" line-height="18px" font-size="12px" padding-top="4px" padding-bottom="4px">
                Quote expires: {expirationDate}
              </mj-text>
              {flattenedLeaseTerms && flattenedLeaseTerms.map(leaseTerm => renderLeaseTermBox(leaseTerm))}
            </mj-column>
          </mj-section>

          {!hideApplicationLink && (
            <mj-section padding-top="16px" padding-bottom="24px" background-color="#ffffff">
              <mj-column>
                <mj-button
                  background-color={styles.primaryButtonBackgroundColor}
                  color={styles.primaryButtonTextColor}
                  border-radius="2px 2px 2px 2px"
                  font-size="14px"
                  font-weight="500"
                  padding-bottom="20px"
                  font-family="Roboto, Arial"
                  padding-top="0px"
                  padding-left="16px"
                  padding-right="16px"
                  href={applyNowUrl}
                  text-transform="uppercase">
                  Apply now
                </mj-button>
              </mj-column>
            </mj-section>
          )}

          <mj-section padding-left="5%" padding-right="5%" border-bottom="1px solid #dddddd" border-top="1px solid #dddddd">
            {termPayments.map((leaseTerm, i) => renderLeaseTermDetailBox(leaseTerm, i, { termPayments, flattenedInventory }))}
          </mj-section>

          {!hideApplicationLink && (
            <mj-section padding-top="8px" padding-bottom="16px" background-color="#ffffff">
              <mj-column>
                <mj-button
                  background-color={styles.primaryButtonBackgroundColor}
                  color={styles.primaryButtonTextColor}
                  border-radius="2px 2px 2px 2px"
                  font-size="14px"
                  font-weight="500"
                  padding-bottom="20px"
                  font-family="Roboto, Arial"
                  padding-top="0px"
                  padding-left="16px"
                  padding-right="16px"
                  href={applyNowUrl}
                  text-transform="uppercase">
                  Apply now
                </mj-button>
              </mj-column>
            </mj-section>
          )}
        </mj-container>
      )}
    </mj-container>
  );
};

export default Quote;
