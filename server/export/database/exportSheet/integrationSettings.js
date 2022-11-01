/*
 * Copyright (c) 2022 Reva Technology Inc., all rights reserved.
 * Unauthorized copying of this file, via any medium is strictly prohibited
 * Licensed under the Elastic License 2.0; you may not use this file except
 * in compliance with the Elastic License 2.0.
 */

import { getPropertySettingsToExport } from '../../../dal/propertyRepo';
import { buildDataPumpFormat } from '../../helpers/export';

const buildIntegrationSettings = properties =>
  properties.map(property => {
    const { integration = {} } = property.settings;
    return {
      property: property.name,
      'import\ninventoryState': (integration.import || {}).inventoryState,
      'import\ninventoryAvailabilityDate': (integration.import || {}).inventoryAvailabilityDate,
      'import\nresidentData': (integration.import || {}).residentData,
      'import\nunitPricing': (integration.import || {}).unitPricing,
      'export\nnewLease': (integration.export || {}).newLease,
      'export\nrenewalLease': (integration.export || {}).renewalLease,
      'lease\nbmAutoESignatureRequest': (integration.lease || {}).bmAutoESignatureRequest,
    };
  });

export const exportIntegrationSettings = async (ctx, { propertyIdsToExport, columnHeaders: columnHeadersOrdered }) => {
  const properties = await getPropertySettingsToExport(ctx, propertyIdsToExport);

  const integrationSettings = buildIntegrationSettings(properties);

  return buildDataPumpFormat(integrationSettings, columnHeadersOrdered);
};
