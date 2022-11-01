/*
 * Copyright (c) 2022 Reva Technology Inc., all rights reserved.
 * Unauthorized copying of this file, via any medium is strictly prohibited
 * Licensed under the Elastic License 2.0; you may not use this file except
 * in compliance with the Elastic License 2.0.
 */

import React from 'react';
import { t } from 'i18next';
import { Typography, Truncate } from 'components';

import { getHighValueAmenityNames } from 'helpers/inventory';
import { cf } from './AmenitySection.scss';

const { Text } = Typography;

const AmenitySection = ({ inventory, isBlockStyle }) => {
  const amenities = getHighValueAmenityNames(inventory, false);
  return (
    <div className={isBlockStyle ? cf('block') : cf('section-content')}>
      <Text bold>{t('AMENITIES')}</Text>
      <Text id="highValueAmenitiesTxt"> {getHighValueAmenityNames(inventory, true)}</Text>
      <Truncate direction="vertical" maxHeight={60} collapsible>
        <Text id="propertyAmenitiesTxt" secondary>
          {amenities}
        </Text>
      </Truncate>
    </div>
  );
};

export default AmenitySection;
