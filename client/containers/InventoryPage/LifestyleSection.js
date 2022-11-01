/*
 * Copyright (c) 2022 Reva Technology Inc., all rights reserved.
 * Unauthorized copying of this file, via any medium is strictly prohibited
 * Licensed under the Elastic License 2.0; you may not use this file except
 * in compliance with the Elastic License 2.0.
 */

import React from 'react';
import { Typography } from 'components';
import { t } from 'i18next';
import { cf } from './InventoryPage.scss';

const { Text, Title } = Typography;

export const LifestyleSection = ({ inventory }) => {
  const lifeStyles = inventory.property.lifeStyles.map(lifestyle => lifestyle).join(', ');
  if (!lifeStyles) return <div />;
  return (
    <div className={cf('amenities-block')}>
      <Title bold>{t('LIFESTYLE_PREFERENCES')}</Title>
      <div className={cf('sub-block')}>
        <Text inline className={cf('first-paragraph')}>
          {' '}
          {lifeStyles}
        </Text>
      </div>
    </div>
  );
};
