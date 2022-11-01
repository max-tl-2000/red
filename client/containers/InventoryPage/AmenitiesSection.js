/*
 * Copyright (c) 2022 Reva Technology Inc., all rights reserved.
 * Unauthorized copying of this file, via any medium is strictly prohibited
 * Licensed under the Elastic License 2.0; you may not use this file except
 * in compliance with the Elastic License 2.0.
 */

import React from 'react';
import { Typography } from 'components';
import { t } from 'i18next';
import { getHighValueAmenityNames } from '../../helpers/inventory';
import { cf } from './InventoryPage.scss';

const { Text, Title } = Typography;

export const AmenitiesSection = ({ inventory }) => {
  const amenities = getHighValueAmenityNames(inventory, false);
  const highValueAmenities = getHighValueAmenityNames(inventory, true);

  const renderSection = amenities || highValueAmenities;

  if (!renderSection) return <div />;

  return (
    <div className={cf('amenities-block')}>
      <Title bold>{t('LABEL_AMENITIES')}</Title>
      <div className={cf('sub-block')}>
        <Text className={cf('first-paragraph')}> {highValueAmenities}</Text>
        <Text secondary>{amenities}</Text>
      </div>
    </div>
  );
};
