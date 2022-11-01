/*
 * Copyright (c) 2022 Reva Technology Inc., all rights reserved.
 * Unauthorized copying of this file, via any medium is strictly prohibited
 * Licensed under the Elastic License 2.0; you may not use this file except
 * in compliance with the Elastic License 2.0.
 */

import realTestPropertiesIntegrationIds from './resources/real-test-properties-integration-ids.json';

const propertiesIntegrationIds = realTestPropertiesIntegrationIds;

export const generateExternalId = (propertyName, usedExternalIds = []) => {
  const propertyIntegrationIds = propertiesIntegrationIds[propertyName];

  // There isn't integration ids for the property requested
  if (!propertyIntegrationIds) return null;

  return propertyIntegrationIds.find(i => usedExternalIds.indexOf(i) === -1);
};
