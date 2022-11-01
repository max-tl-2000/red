/*
 * Copyright (c) 2022 Reva Technology Inc., all rights reserved.
 * Unauthorized copying of this file, via any medium is strictly prohibited
 * Licensed under the Elastic License 2.0; you may not use this file except
 * in compliance with the Elastic License 2.0.
 */

import React from 'react';
import { t } from 'i18next';
import { Text, SubHeader } from 'components/Typography/Typography';
import groupBy from 'lodash/groupBy';
import { cf } from './InventoryCard.scss';
import { DALTypes } from '../../../common/enums/DALTypes';

const InventoryCardAmenities = ({ inventoryAmenities, selectedHighValueAmenities, selectedOtherAmenities }) => {
  const groupedAmenities = groupBy(
    inventoryAmenities.filter(amenity => !amenity.hidden),
    'category',
  );

  const parseAmenities = (amenitiesToFormat, selectedAmenities = [], bold = false) =>
    amenitiesToFormat
      .map(amenity => amenity.displayName)
      .sort((a, b) => a.toUpperCase().localeCompare(b.toUpperCase())) // localeCompare method is used for avoid non-ASCII characters issues.
      .map(amenity => ({
        displayName: amenity,
        highlighted: selectedAmenities.includes(amenity),
        bold,
      }));

  const sortAmenities = amenitiesToFormat => {
    if (!(amenitiesToFormat && amenitiesToFormat.length)) return [];

    const highAmenities = amenitiesToFormat.filter(amenity => amenity.highValue);
    const nonHighAmenities = amenitiesToFormat.filter(amenity => !amenity.highValue);

    return [].concat(parseAmenities(highAmenities, selectedHighValueAmenities, true), parseAmenities(nonHighAmenities, selectedOtherAmenities));
  };

  const formatAmenity = ({ highlighted, bold, displayName }, index, amenitiesToFormat) => (
    <Text key={displayName} inline highlight={highlighted} secondary={!highlighted && !bold} bold={bold}>
      {index === amenitiesToFormat.length - 1 ? displayName : `${displayName}, `}
    </Text>
  );

  const amenitiesToRender = [DALTypes.AmenityCategory.INVENTORY, DALTypes.AmenityCategory.BUILDING, DALTypes.AmenityCategory.PROPERTY].reduce(
    (acc, category) => {
      const amenitiesPerCategory = sortAmenities(groupedAmenities[category]);
      if (!(amenitiesPerCategory && amenitiesPerCategory.length)) return acc;

      acc.push(
        <Text key={`amenities_${category}`} className={cf('amenities')}>
          {amenitiesPerCategory.map(formatAmenity)}
        </Text>,
      );
      return acc;
    },
    [],
  );

  return (
    <div className={cf('amenity')}>
      <div className={cf('amenity-description')}>
        <SubHeader className={cf('amenity-title')}>{t('LABEL_AMENITIES')}</SubHeader>
        {amenitiesToRender && !!amenitiesToRender.length && amenitiesToRender}
      </div>
    </div>
  );
};

export default InventoryCardAmenities;
