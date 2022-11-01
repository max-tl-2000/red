/*
 * Copyright (c) 2022 Reva Technology Inc., all rights reserved.
 * Unauthorized copying of this file, via any medium is strictly prohibited
 * Licensed under the Elastic License 2.0; you may not use this file except
 * in compliance with the Elastic License 2.0.
 */

import { t } from 'i18next';
import get from 'lodash/get';
import React from 'react';
import { TwoPanelPage, LeftPanel, RightPanel, Section } from 'components';
import { cf } from './quote.scss';
import TitleSection from './TitleSection';
import AmenitySection from './AmenitySection';
import PaymentScheduleSection from './PaymentScheduleSection';
import BaseChargeSection from './BaseChargeSection';
import AdditionalChargeSection from './AdditionalChargeSection';
import OneTimeChargeSection from './OneTimeChargeSection';
import { LeaseStartWarning } from '../../../custom-components/SummaryWarnings/LeaseStartWarning';

const LeasingQuote = ({
  inventoryIsUnavailable,
  inventory,
  availableOn,
  shouldDisplayQuoteSections,
  quoteModel,
  isLeaseStartDateInThePast,
  isEmptyState,
  hasAdditionalCharges,
  prorationStrategy,
}) => (
  <TwoPanelPage>
    <LeftPanel paddedScrollable>
      {inventoryIsUnavailable && (
        <LeaseStartWarning content={t('UNIT_NOT_AVAILABLE_TO_LEASE_WARNING', { name: get(inventory, 'name', ''), date: availableOn })} />
      )}
      {shouldDisplayQuoteSections && (
        <Section className={cf('title')}>
          <TitleSection
            inventory={inventory}
            quoteModel={quoteModel}
            isLeaseStartDateInThePast={isLeaseStartDateInThePast}
            isInventoryAvailable={inventoryIsUnavailable}
          />
        </Section>
      )}
      {shouldDisplayQuoteSections && !isEmptyState && <BaseChargeSection quoteModel={quoteModel} />}
      {shouldDisplayQuoteSections && !isEmptyState && hasAdditionalCharges && <AdditionalChargeSection quoteModel={quoteModel} />}
      {shouldDisplayQuoteSections && !isEmptyState && hasAdditionalCharges && <OneTimeChargeSection quoteModel={quoteModel} />}
    </LeftPanel>
    <RightPanel>
      {inventory && <AmenitySection inventory={inventory} />}
      {shouldDisplayQuoteSections && !isEmptyState && <PaymentScheduleSection quoteModel={quoteModel} prorationStrategy={prorationStrategy} />}
    </RightPanel>
  </TwoPanelPage>
);

export default LeasingQuote;
