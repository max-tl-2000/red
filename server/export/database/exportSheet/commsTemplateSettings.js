/*
 * Copyright (c) 2022 Reva Technology Inc., all rights reserved.
 * Unauthorized copying of this file, via any medium is strictly prohibited
 * Licensed under the Elastic License 2.0; you may not use this file except
 * in compliance with the Elastic License 2.0.
 */

import { getCommsTemplateSettingsToExport } from '../../../dal/commsTemplateRepo';
import { buildDataPumpFormat } from '../../helpers/export';

export const exportCommsTemplateSettings = async (ctx, { columnHeaders: columnHeadersOrdered }) => {
  const commsTemplateSettings = await getCommsTemplateSettingsToExport(ctx);

  const formattedCommsTemplateSettings = commsTemplateSettings.reduce((acc, ct) => {
    const index = acc.findIndex(x => x.property === ct.property);
    if (index > -1) {
      const currentObj = acc[index];
      acc[index] = { ...currentObj, [`${ct.section}\n${ct.action}`]: ct.template };
      return acc;
    }

    acc.push({ property: ct.property, [`${ct.section}\n${ct.action}`]: ct.template });
    return acc;
  }, []);

  return buildDataPumpFormat(formattedCommsTemplateSettings, columnHeadersOrdered);
};
