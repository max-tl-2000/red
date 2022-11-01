/*
 * Copyright (c) 2022 Reva Technology Inc., all rights reserved.
 * Unauthorized copying of this file, via any medium is strictly prohibited
 * Licensed under the Elastic License 2.0; you may not use this file except
 * in compliance with the Elastic License 2.0.
 */

import React from 'react';
import { t } from 'i18next';
import { Card, Typography } from 'components';
import LeaseLength from 'custom-components/LeaseLength/LeaseLength';
import { ComplimentaryItems } from 'custom-components/QuoteSummary/QuoteSummary';
import { inventoryStateRepresentation, shouldDisplayInventoryState } from '../../../../common/inventory-helper';
import { cf } from './LeasingQuoteTitleSection.scss';
import { formatNumBedrooms } from '../../../../common/helpers/inventory';
import { getBigLayoutImage } from '../../../../common/helpers/cloudinary';
import DateSelector from '../../../components/DateSelector/DateSelector';

const { Text } = Typography;
const inventoryState = state => (
  <Text data-id="inventoryStateTxt" inline secondary>
    {state}
  </Text>
);

const formatLayout = layout => {
  if (!layout || !Object.keys(layout)) {
    return '';
  }

  return [
    formatNumBedrooms(layout.numBedrooms),
    t('QUOTE_DRAFT_NUM_BATHS', { count: layout.numBathrooms }),
    t('QUOTE_DRAFT_AREA', { count: layout.surfaceArea }),
    layout.displayName,
  ].join(', ');
};

const LeasingQuoteTitleSection = ({ inventory, leases, quoteModel, isInventoryAvailable, handleDateChange, handleDropdownChange }) => {
  const shouldDisplayState = shouldDisplayInventoryState(inventory);
  const state = shouldDisplayState && inventoryStateRepresentation(inventory, leases);
  const { leaseStartDate, minLeaseDate, formatInventoryName, propertyTimezone } = quoteModel;
  const errorMsg = isInventoryAvailable ? t('LEASE_START_PRECEDES_UNIT_AVAILABILITY_WARNING') : null;

  const renderDropdown = () => {
    const { leaseTerms, theSelectedTermsIds } = quoteModel;
    return (
      <LeaseLength
        leaseTerms={Array.from(leaseTerms)}
        leaseTermsSelected={theSelectedTermsIds}
        onChange={handleDropdownChange}
        placeholder={t('QUOTE_DRAFT_LEASE_TERMS')}
      />
    );
  };

  return (
    <Card>
      <div className={cf('section-content')}>
        <div>
          <div className={cf('info')}>
            {shouldDisplayState && <div className={cf('caption', 'textSecondary')}>{inventoryState(state)}</div>}
            <div data-id="inventoryNameTxt" className={cf('subHeader')}>
              {formatInventoryName(inventory)}
            </div>
            <div data-id="inventoryLayoutTxt" className={cf('body')}>
              {formatLayout(inventory.layout)}
            </div>
          </div>
          <img alt="" className={cf('image')} src={getBigLayoutImage(inventory.imageUrl)} />
        </div>
        <div>
          <div data-id="quoteExpirationLabelTxt" className={cf('body', 'textSecondary')}>
            {t('QUOTE_DRAFT_EXIRES_AT_TEXT', {
              number: 'two',
              period: 'days',
            })}
          </div>
          <div className={cf('field')} data-id="leaseStartDate">
            <DateSelector
              wide
              id="leaseStartDateTxt"
              appendToBody={false}
              selectedDate={leaseStartDate}
              placeholder={t('LEASE_START_DATE')}
              min={minLeaseDate}
              tz={propertyTimezone}
              format={'MMMM DD, YYYY'}
              onChange={handleDateChange}
              errorMessage={errorMsg}
            />
          </div>
          <div className={cf('field')} data-id="leaseTermsSelector">
            {renderDropdown()}
          </div>
        </div>
      </div>
      {!!inventory && !!inventory.complimentaryItems.length && (
        <div className={cf('complimentaryItems')}>
          <div>
            <Text data-id="includesComplimentaryItemTxt" secondary>
              {t('QUOTE_DRAFT_INCLUDES_COMPLIMENTARY')}
            </Text>
          </div>
          <ComplimentaryItems inventory={inventory} />
        </div>
      )}
    </Card>
  );
};

export default LeasingQuoteTitleSection;
