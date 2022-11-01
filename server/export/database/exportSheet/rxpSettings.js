/*
 * Copyright (c) 2022 Reva Technology Inc., all rights reserved.
 * Unauthorized copying of this file, via any medium is strictly prohibited
 * Licensed under the Elastic License 2.0; you may not use this file except
 * in compliance with the Elastic License 2.0.
 */

import { getPropertySettingsToExport } from '../../../dal/propertyRepo';
import { buildDataPumpFormat } from '../../helpers/export';

const buildRxpSettings = properties =>
  properties.map(property => {
    const { rxp = {} } = property.settings;
    const { app = {}, loginFlow = {}, features } = rxp;
    return {
      property: property.name,
      'app\nid': app.id,
      'app\nname': app.name,
      'app\nscheme': app.scheme,
      'app\nappStoreUrl': app.appStoreUrl,
      'app\nplayStoreUrl': app.playStoreUrl,
      'app\nautoInvite': app.autoInvite,
      'app\nallowAccess': app.allowAccess,
      'loginFlow\nline1': loginFlow.line1,
      'loginFlow\nline2': loginFlow.line2,
      'loginFlow\nline3': loginFlow.line3,
      'loginFlow\nhideLogo': loginFlow.hideLogo,
      'features\npaymentModule': features.paymentModule,
      'features\nmaintenanceModule': features.maintenanceModule,
    };
  });

export const exportRxpSettings = async (ctx, { propertyIdsToExport, columnHeaders: columnHeadersOrdered }) => {
  const properties = await getPropertySettingsToExport(ctx, propertyIdsToExport);
  const rxpSettings = buildRxpSettings(properties);

  return buildDataPumpFormat(rxpSettings, columnHeadersOrdered);
};
