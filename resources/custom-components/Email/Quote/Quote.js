/*
 * Copyright (c) 2022 Reva Technology Inc., all rights reserved.
 * Unauthorized copying of this file, via any medium is strictly prohibited
 * Licensed under the Elastic License 2.0; you may not use this file except
 * in compliance with the Elastic License 2.0.
 */

import React from 'react';
import { t } from 'i18next';
import Button from '../Button/Button';
import Image from '../Image/Image';
import TopBar from '../TopBar/TopBar';
import Card from '../Card/Card';
import * as Typography from '../Typography/Typography';
import { Box } from '../../../../common/react-html-email-wrapper';
import SubHeaderAgentInfo from '../SubHeaderAgentInfo/SubHeaderAgentInfo';
import { getStyleFor } from './Styles';
import Container from '../Container/Container';
import { bodyMailBorder } from '../../../react-email-template/commonStyles';

const { Headline, Title, SubHeader, Caption, Text } = Typography;

const positionCenterMargin = { margin: '0 auto' };
const fontFamily = 'Roboto,sans-serif';

const AmountLine = ({ estimated, description, amount, header }) => (
  <Box style={{ width: '100%' }}>
    {header && (
      <tr>
        <td style={{ padding: '10px 0' }} colSpan={2}>
          {header}
        </td>
      </tr>
    )}
    <tr>
      <td style={{ width: '50%', padding: '10px 0' }}>
        {description} {estimated && <Text secondary>({t('ESTIMATED')})</Text>}
      </td>
      <td style={{ width: '50%', padding: '10px 0', textAlign: 'right' }}>{amount}</td>
    </tr>
  </Box>
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

const Quote = ({ quoteData, invitationText }) => {
  const {
    contact,
    applyNowUrl,
    leaseStartDate,
    quoteExpirationDate,
    contentForEmailCard,
    flattenedInventory,
    flattenedLeaseTerms,
    paymentSchedule,
    confirmationNumber,
    policy,
    avatarUrl,
    hideApplicationLink = false,
  } = quoteData;

  const termPayments = getTermPayments(paymentSchedule);
  const subHeaderSection = contact && (
    <SubHeaderAgentInfo fullName={contact.fullName} title={contact.title} phone={contact.phone} email={contact.email} avatarUrl={avatarUrl} />
  );

  const renderComplimentaryItem = complimentaryItem => (
    <Text inline class="body-text">
      {complimentaryItem.name}
      {complimentaryItem.secondaryName && (
        <Caption inline secondary>
          {' '}
          ({complimentaryItem.secondaryName})
        </Caption>
      )}
    </Text>
  );

  const renderConcessionItem = concession => (
    <AmountLine description={<Text>{concession.concessionName}</Text>} amount={<Text highlight>Save: {concession.concessionValue}</Text>} />
  );

  const renderPeriodPaymentDetails = periodDetails => (
    <AmountLine description={<Text>{periodDetails.timeFrame}</Text>} amount={<Text>{periodDetails.amount}</Text>} />
  );

  const renderOneTimeChargeBox = oneTimeCharge => (
    <AmountLine estimated={oneTimeCharge.estimated} description={<Text>{oneTimeCharge.displayName}</Text>} amount={<Text>{oneTimeCharge.amount}</Text>} />
  );

  const renderLeaseTermBox = leaseTerm => (
    <tr>
      <td style={getStyleFor('leaseItemTopBorderStyle')}>
        <AmountLine
          description={<Text>Base rent</Text>}
          amount={<Text>{leaseTerm.baseRent}</Text>}
          header={
            <SubHeader inline>
              {leaseTerm.period}{' '}
              <Caption inline secondary>
                {leaseTerm.endDate}
              </Caption>
            </SubHeader>
          }
        />
        {leaseTerm && leaseTerm.concessions && leaseTerm.concessions && leaseTerm.concessions.map(concession => renderConcessionItem(concession))}
      </td>
    </tr>
  );

  const renderAdditionalCharges = ({ formattedAdditionalCharges, fromTag }) => {
    const getAmmount = ({ amount, isMinAndMaxRentDiff }) => (
      <Text>
        {isMinAndMaxRentDiff && (
          <Caption inline secondary style={{ marginRight: 6 }}>
            {fromTag}
          </Caption>
        )}
        {amount}
      </Text>
    );

    return formattedAdditionalCharges.map(additionalCharge => (
      <AmountLine
        key={additionalCharge.id}
        estimated={additionalCharge.estimated}
        description={<Text>{additionalCharge.displayName}</Text>}
        amount={getAmmount(additionalCharge)}
      />
    ));
  };

  const renderLeaseTermDetailCell = (leaseTerm, index) => (
    <td
      style={{
        borderTop: '1px solid #e6e6e6',
        borderRight: index % 2 === 0 ? '1px solid #e6e6e6' : 'none',
        width: '49.85%',
        padding: index % 2 === 0 ? '24px 24px 24px 0' : '24px 0 24px 24px',
      }}>
      <div>
        <Title>{leaseTerm.title}</Title>
        {leaseTerm.caption && <Caption secondary>{leaseTerm.caption}</Caption>}
        {leaseTerm.periodPaymentDetails.map(periodDetails => renderPeriodPaymentDetails(periodDetails))}
      </div>
      <div style={getStyleFor('leaseItemTopBorderStyle')}>
        <Caption style={getStyleFor('boxTitleStyle')}>{leaseTerm.additionalChargesTitle}</Caption>
        <AmountLine description={<Text>{leaseTerm.baseRent.title}</Text>} amount={<Text>{leaseTerm.baseRent.formattedAmount}</Text>} />
        {leaseTerm.formattedAdditionalCharges && !!leaseTerm.formattedAdditionalCharges.length && renderAdditionalCharges(leaseTerm)}
        <AmountLine
          description={<Text bold>{leaseTerm.totalCharges.title.toUpperCase()}</Text>}
          amount={<Text bold>{leaseTerm.totalCharges.formattedAmount}</Text>}
        />
      </div>
      {leaseTerm && leaseTerm.concessions && leaseTerm.concessions.info && !!leaseTerm.concessions.info.length && (
        <div style={getStyleFor('leaseItemTopBorderStyle')}>
          <Caption style={getStyleFor('boxTitleStyle')}>{leaseTerm.concessions.title}</Caption>
          {leaseTerm && leaseTerm.concessions && leaseTerm.concessions.info && leaseTerm.concessions.info.map(concession => renderConcessionItem(concession))}
          {leaseTerm && leaseTerm.concessions && leaseTerm.totalConcessions && (
            <AmountLine
              description={<Text bold>{leaseTerm.totalConcessions.title}</Text>}
              amount={
                <Text bold highlight>
                  Save: {leaseTerm.totalConcessions.formattedAmount}
                </Text>
              }
            />
          )}
        </div>
      )}
      {leaseTerm && leaseTerm.oneTimeCharges && !!leaseTerm.oneTimeCharges.length && (
        <div style={getStyleFor('leaseItemTopBorderStyle')}>
          <Caption style={getStyleFor('boxTitleStyle')}>Additional one-time charges</Caption>
          {leaseTerm && leaseTerm.oneTimeCharges && leaseTerm.oneTimeCharges.map(oneTimeCharge => renderOneTimeChargeBox(oneTimeCharge))}
        </div>
      )}
    </td>
  );

  const isOddAndNotLastItem = index => !!termPayments[index + 1] && index % 2 === 0;
  const isOddAndLastItem = index => !termPayments[index + 1] && index % 2 === 0;
  const isEvenAndLastItem = index => !termPayments[index + 1] && index % 2 === 1;

  const renderLeaseTermDetailBox = (leaseTerm, index) =>
    (isOddAndNotLastItem(index) && (
      <tr style={{ textAlign: 'left', verticalAlign: 'top' }}>
        {[leaseTerm, termPayments[index + 1]].map((leaseRowItem, leaseCellIndex) => renderLeaseTermDetailCell(leaseRowItem, leaseCellIndex))}
      </tr>
    )) ||
    (isOddAndLastItem(index) && (
      <tr>
        <td colSpan="2">
          <Box style={{ width: '100%' }}>
            <tr style={{ textAlign: 'left', verticalAlign: 'top' }}>
              {renderLeaseTermDetailCell(leaseTerm, 0)}
              <td style={getStyleFor('amenitiesBoxStyle', { padding: '24px 0 24px 24px' })}>
                <Title>Amenities</Title>
                <Text style={getStyleFor('amenitiesTextStyle')}>{flattenedInventory.highValueAmenities}</Text>
                <Text secondary style={getStyleFor('amenitiesTextStyle')}>
                  {flattenedInventory.otherAmenities}
                </Text>
              </td>
            </tr>
            {!hideApplicationLink && (
              <tr>
                <td colSpan={2} style={{ padding: '24px' }}>
                  <Button style={positionCenterMargin} align={'center'} label="APPLY NOW" href={applyNowUrl} />
                </td>
              </tr>
            )}
          </Box>
        </td>
      </tr>
    )) ||
    (isEvenAndLastItem(index) && (
      <tr>
        <td colSpan="2">
          <Box style={{ width: '100%' }}>
            {!hideApplicationLink && (
              <tr>
                <td colSpan={2} style={{ padding: '24px' }}>
                  <Button style={positionCenterMargin} align={'center'} label="APPLY NOW" href={applyNowUrl} />
                </td>
              </tr>
            )}
            <tr style={{ verticalAlign: 'top' }}>
              <td colSpan="2" style={getStyleFor('amenitiesBoxStyle')}>
                <Title>Amenities</Title>
                <Text style={getStyleFor('amenitiesTextStyle')}>{flattenedInventory.highValueAmenities}</Text>
                <Text secondary style={getStyleFor('amenitiesTextStyle')}>
                  {flattenedInventory.otherAmenities}
                </Text>
              </td>
            </tr>
          </Box>
        </td>
      </tr>
    ));

  return (
    <div>
      {contentForEmailCard && (
        <Container padding="16px 0">
          <Text className="contentForEmailCard" dangerouslySetInnerHTML={{ __html: contentForEmailCard }} />
        </Container>
      )}
      {flattenedInventory && <TopBar title={flattenedInventory.propertyName} subHeaderSection={subHeaderSection} tall rightSectionWidth={212} />}
      {invitationText && (
        <Container style={{ textAlign: 'center', paddingTop: 23, borderLeft: '1px solid #e6e6e6', borderRight: '1px solid #e6e6e6' }}>
          <Title>{invitationText}</Title>
        </Container>
      )}
      {flattenedInventory && (
        <Card style={{ borderTop: 'none', borderLeft: bodyMailBorder, borderRight: bodyMailBorder }}>
          <Box style={{ width: '100%' }} width="100%">
            <tr>
              <td style={{ width: '50%' }} valign="top">
                <div style={{ paddingRight: 16 }}>
                  <Image alt="property image" src={flattenedInventory.imageUrl} width="100%" style={{ marginBottom: 10 }} />
                  <SubHeader style={{ textAlign: 'left' }}>{flattenedInventory.propertyName}</SubHeader>
                  <Caption style={{ textAlign: 'left' }}>{flattenedInventory.address}</Caption>
                  <Caption style={{ textAlign: 'left' }}>{flattenedInventory.layoutInf}</Caption>
                  {flattenedInventory.complimentaryItems && flattenedInventory.complimentaryItems.items.length > 0 && (
                    <Box style={{ width: '100%', marginTop: 15, borderRadius: 3, background: '#e6e6e6', padding: '4.8px 8px' }}>
                      <tr>
                        <td>
                          <Caption secondary>{flattenedInventory.complimentaryItems.title}</Caption>
                          {flattenedInventory.complimentaryItems.items.map(complimentaryItem => renderComplimentaryItem(complimentaryItem))}
                        </td>
                      </tr>
                    </Box>
                  )}
                </div>
              </td>
              <td style={{ width: '50%' }} valign="top">
                <Box style={getStyleFor('leaseItemLeftBorderStyle')}>
                  <tr>
                    <td style={{ paddingBottom: 15 }}>
                      <Caption secondary>Lease start date</Caption>
                      <Headline>{leaseStartDate}</Headline>
                      <Caption secondary>Quote expires: {quoteExpirationDate}</Caption>
                    </td>
                  </tr>
                  {flattenedLeaseTerms && flattenedLeaseTerms.map(leaseTerm => renderLeaseTermBox(leaseTerm))}
                </Box>
              </td>
            </tr>
            {!hideApplicationLink && (
              <tr>
                <td colSpan={2} style={{ padding: '24px', textAlign: 'center' }}>
                  <Button style={positionCenterMargin} align={'center'} label="APPLY NOW" href={applyNowUrl} />
                </td>
              </tr>
            )}
            {termPayments.map((leaseTerm, i) => renderLeaseTermDetailBox(leaseTerm, i))}
          </Box>
        </Card>
      )}
      <Card style={{ background: '#f5f5f5', fontFamily, borderLeft: bodyMailBorder, borderRight: bodyMailBorder, borderBottom: bodyMailBorder }}>
        <Caption style={{ paddingBottom: 12 }} secondary>
          confirmation number: {confirmationNumber}
        </Caption>
        <div style={{ color: '#757575', fontSize: 13 }} dangerouslySetInnerHTML={{ __html: policy }} />
      </Card>
    </div>
  );
};

export default Quote;
