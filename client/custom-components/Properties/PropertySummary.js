/*
 * Copyright (c) 2022 Reva Technology Inc., all rights reserved.
 * Unauthorized copying of this file, via any medium is strictly prohibited
 * Licensed under the Elastic License 2.0; you may not use this file except
 * in compliance with the Elastic License 2.0.
 */

import React from 'react';
import { Icon, Typography } from 'components';
import { cf, g } from './PropertySummary.scss';

const { Text } = Typography;

const getLifestyleIconFromName = (lifestylePreferences, selectedLifestylePreferences, lifestyleName) => {
  const currentLifestyle = lifestylePreferences.find(l => l.displayName === lifestyleName) || {};
  if (!currentLifestyle.infographicName) {
    return <div key={`${name}.${currentLifestyle.id}`} />;
  }

  const isMatchingLifestyle = !!selectedLifestylePreferences.find(l => l === currentLifestyle.id);
  return (
    <Icon
      name={currentLifestyle.infographicName}
      key={`${name}.${currentLifestyle.id}`}
      className={cf('propertyInfo', isMatchingLifestyle ? 'matching' : '')}
    />
  );
};

const PropertySummary = ({ property, lifestylePreferences, selectedLifestylePreferences, className }) => {
  if (!property) return <div />;

  const { name, location, lifestyles = [] } = property;

  const lifestyleIcons = !lifestylePreferences.length
    ? []
    : lifestyles.map(lifestyleName => getLifestyleIconFromName(lifestylePreferences, selectedLifestylePreferences, lifestyleName));

  return (
    <div className={cf('property', g(className))}>
      <Text id="propertyNameInfoText" className={cf('propertyInfo')}>{`${name}`}</Text>
      <Text secondary className={cf('propertyInfo')}>
        {`(${location})`}
      </Text>
      {lifestyleIcons}
    </div>
  );
};

export default PropertySummary;
