/*
 * Copyright (c) 2022 Reva Technology Inc., all rights reserved.
 * Unauthorized copying of this file, via any medium is strictly prohibited
 * Licensed under the Elastic License 2.0; you may not use this file except
 * in compliance with the Elastic License 2.0.
 */

import PropTypes from 'prop-types';
import React, { Component } from 'react';

import { t } from 'i18next';
import get from 'lodash/get';
import { UnitBlock } from 'custom-components/QuoteSummary/QuoteSummary';
import { TwoPanelPage, LeftPanel, RightPanel, Section, RedTable } from 'components';
import Caption from '../../../components/Typography/Caption';
import Text from '../../../components/Typography/Text';
import { cf } from './quote.scss';
import TitleSection from './TitleSection';
import { LeaseStartWarning } from '../../../custom-components/SummaryWarnings/LeaseStartWarning';
import { getActiveRecurringChargesForQuote } from '../../../../common/helpers/quotes';
import { excludeExternalChargeCodes } from '../../../helpers/quotes';

const { Row, Cell, TextPrimary, Money } = RedTable;

export default class RenewalQuote extends Component {
  static propTypes = {
    inventoryIsUnavailable: PropTypes.bool,
    inventory: PropTypes.object,
    availableOn: PropTypes.string,
    shouldDisplayQuoteSections: PropTypes.bool,
    isLeaseStartDateInThePast: PropTypes.bool,
    activeLeaseWorkflowData: PropTypes.object,
    timezone: PropTypes.string,
    isExistingQuote: PropTypes.bool,
  };

  renderChargeRow = charges =>
    charges.length && (
      <div className={cf('charges-section')}>
        <Caption secondary className={cf('charges-title')}>
          {t('CURRENT_ADDITIONAL_CHARGES')}
        </Caption>
        {charges.map((charge, index) => (
          // eslint-disable-next-line react/no-array-index-key
          <Row key={index} noDivider className={cf('charges-row')}>
            <Cell type="ctrlCell">
              <TextPrimary>{charge.displayName}</TextPrimary>
            </Cell>
            <Cell noPaddingLeft textAlign="right">
              <Money amount={charge.amount} currency="USD" />
            </Cell>
          </Row>
        ))}
      </div>
    );

  render() {
    const {
      inventoryIsUnavailable,
      inventory,
      availableOn,
      shouldDisplayQuoteSections,
      quoteModel,
      isLeaseStartDateInThePast,
      activeLeaseWorkflowData,
      isExistingQuote,
    } = this.props;
    const { leaseData } = activeLeaseWorkflowData;
    const recurringCharges = excludeExternalChargeCodes(activeLeaseWorkflowData.recurringCharges);
    const activeRecurringCharges = recurringCharges?.length && getActiveRecurringChargesForQuote(recurringCharges);

    return (
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
                leaseEndDate={leaseData?.leaseEndDate}
                isExistingQuote={isExistingQuote}
              />
            </Section>
          )}
        </LeftPanel>
        <RightPanel>
          <UnitBlock hideStatus inventory={inventory} reflow leftPadding />
          {!!activeRecurringCharges?.length && this.renderChargeRow(activeRecurringCharges)}
          <Text className={cf('renewal-message')}>{t('RENEWAL_LETTER_INFO_MESSAGE')}</Text>
        </RightPanel>
      </TwoPanelPage>
    );
  }
}
