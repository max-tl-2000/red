/*
 * Copyright (c) 2022 Reva Technology Inc., all rights reserved.
 * Unauthorized copying of this file, via any medium is strictly prohibited
 * Licensed under the Elastic License 2.0; you may not use this file except
 * in compliance with the Elastic License 2.0.
 */

import React from 'react';
import { t } from 'i18next';
import { Icon, Typography, Truncate } from 'components';
import { cf } from './PropertyCard.scss';

const { Caption, Text } = Typography;

const PropertyCard = ({ id, imageUrl, location, name, matches, selected, onPropertyHover }) => (
  <div
    data-property-card-name={name}
    className={cf('mainContent', { selected })}
    onMouseEnter={() => onPropertyHover && onPropertyHover(id, true)}
    onMouseLeave={() => onPropertyHover && onPropertyHover(id, false)}>
    <div
      className={cf('image', { selected })}
      style={{
        backgroundImage: imageUrl && `url('${imageUrl}')`,
        backgroundSize: 'cover',
      }}
    />
    <div className={cf('imageGradient')} />
    <div className={cf('matchDetails')}>
      <Caption className={cf('noImageFound')}>{!imageUrl && t('IMAGE_NOT_AVAILABLE')} </Caption>
      <Caption className={cf('matchCount')}>{matches}</Caption>
      <div className={cf('checked', { selected })}>
        {selected ? <Icon key="chk-marked" name="checkbox-marked" /> : <Icon key="chk-blank" name="checkbox-blank-outline" />}
      </div>
    </div>
    <div className={cf('details')}>
      <Text secondary className={cf('location')}>
        {location}
      </Text>
      <Truncate direction="horizontal">
        <Text>{name}</Text>
      </Truncate>
    </div>
  </div>
);

export default PropertyCard;
