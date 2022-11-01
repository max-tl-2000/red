/*
 * Copyright (c) 2022 Reva Technology Inc., all rights reserved.
 * Unauthorized copying of this file, via any medium is strictly prohibited
 * Licensed under the Elastic License 2.0; you may not use this file except
 * in compliance with the Elastic License 2.0.
 */

import React from 'react';
import { SubHeader } from 'components/Typography/Typography';

export const renderFullQualifiedName = (fullQualifiedName, prefixInSecondary = true) => {
  const lastDash = fullQualifiedName.lastIndexOf('-');
  const prefix = fullQualifiedName.substr(0, lastDash);
  const inventoryName = fullQualifiedName.substr(lastDash + 1);
  return (
    <span key={`propertyName-${Date.now()}`} data-id="qualifiedName">
      {prefix && <SubHeader data-id={`${inventoryName}_unitNamePrefixText`} key="propertyName" inline secondary={prefixInSecondary}>{`${prefix}-`}</SubHeader>}
      <span key="unit" data-id="unitName">
        {inventoryName}
      </span>
    </span>
  );
};

export const renderFullQualifiedNameForMobileCard = fullQualifiedName => {
  const lastDash = fullQualifiedName.lastIndexOf('-');
  const prefix = fullQualifiedName.substr(0, lastDash);
  const inventoryName = fullQualifiedName.substr(lastDash + 1);
  return (
    <span data-id="qualifiedName">
      {prefix && <SubHeader inline lighter secondary>{`${prefix}-`}</SubHeader>}
      {inventoryName}
    </span>
  );
};
