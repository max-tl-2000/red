/*
 * Copyright (c) 2022 Reva Technology Inc., all rights reserved.
 * Unauthorized copying of this file, via any medium is strictly prohibited
 * Licensed under the Elastic License 2.0; you may not use this file except
 * in compliance with the Elastic License 2.0.
 */

import React from 'react';
import { Button, Typography as T } from 'components';
import { t } from 'i18next';
import { cf, g } from './property-policies.scss';

export const PropertyPolicies = ({ className, properties, onPropertyPolicy, reflow }) => {
  const showPropertyName = properties && properties.length > 1;

  const renderProperty = property => {
    const handlePropertyPolicy = () => onPropertyPolicy && onPropertyPolicy(property);

    return (
      <li key={property.id}>
        <Button type="flat" label={t('PROPERTY_POLICIES')} onClick={handlePropertyPolicy} />
        {showPropertyName && (
          <T.Text inline secondary>
            ({property.propertyName})
          </T.Text>
        )}
      </li>
    );
  };

  return <ul className={cf('properties', g(className), { reflow })}>{properties && properties.map(property => renderProperty(property))}</ul>;
};
