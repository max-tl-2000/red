/*
 * Copyright (c) 2022 Reva Technology Inc., all rights reserved.
 * Unauthorized copying of this file, via any medium is strictly prohibited
 * Licensed under the Elastic License 2.0; you may not use this file except
 * in compliance with the Elastic License 2.0.
 */

import React from 'react';
import { Typography, Chip } from 'components';
import { getInventoryShorthand } from 'helpers/quotes';
import { t } from 'i18next';
import { cf } from './InventoryPage.scss';

const { Text } = Typography;

const renderComplimentary = item => {
  const shorhand = getInventoryShorthand({
    buildingName: item.buildingName,
    inventoryName: item.secondaryName,
  });

  return <Chip className={cf('complimentary-item')} key={shorhand} text={`${shorhand}`} />;
};

export const ComplimentarySection = ({ complimentaryItems }) => (
  <div className={cf('section-block')}>
    <Text inline id="complimentary">
      {' '}
      {t('ASSOCIATED_INVENTORY')}{' '}
    </Text>
    {complimentaryItems && complimentaryItems.map(item => renderComplimentary(item))}
  </div>
);
