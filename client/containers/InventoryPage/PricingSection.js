/*
 * Copyright (c) 2022 Reva Technology Inc., all rights reserved.
 * Unauthorized copying of this file, via any medium is strictly prohibited
 * Licensed under the Elastic License 2.0; you may not use this file except
 * in compliance with the Elastic License 2.0.
 */

import React from 'react';
import { Typography, FormattedMarkdown } from 'components';
import { t } from 'i18next';
import { cf } from './InventoryPage.scss';
import { formatMoney } from '../../../common/money-formatter';
import { USD } from '../../../common/currency';

const { Title } = Typography;

export const PricingSection = ({ inventory }) => {
  const getFormattedPrice = price => {
    if (!price) return null;

    const { integerPart } = formatMoney({
      amount: price,
      currency: USD.code,
    });
    return integerPart;
  };

  const marketRent = getFormattedPrice(inventory.marketRent);
  const renewalMarketRent = getFormattedPrice(inventory.renewalMarketRent);
  const priceNotAvailable = !marketRent && !renewalMarketRent;

  return (
    <div className={cf('sub-block')}>
      {!priceNotAvailable && (
        <Title inline id="pricing">
          {marketRent && (
            <FormattedMarkdown inline className={cf('starting-at')}>
              {t('LEASE_STARTING_AT', { leaseType: t('NEW'), price: marketRent })}
            </FormattedMarkdown>
          )}
          {inventory.specials && (
            <Title inline highlight lighter>
              {t('SPECIALS')}
            </Title>
          )}
          {renewalMarketRent && (
            <FormattedMarkdown className={cf('starting-at')}>{t('LEASE_STARTING_AT', { leaseType: t('RENEWAL'), price: renewalMarketRent })}</FormattedMarkdown>
          )}
        </Title>
      )}
      {priceNotAvailable && (
        <Title inline id="pricing">
          <FormattedMarkdown inline className={cf('starting-at')}>
            {t('PRICE_NOT_AVAILABLE')}
          </FormattedMarkdown>
        </Title>
      )}
    </div>
  );
};
