/*
 * Copyright (c) 2022 Reva Technology Inc., all rights reserved.
 * Unauthorized copying of this file, via any medium is strictly prohibited
 * Licensed under the Elastic License 2.0; you may not use this file except
 * in compliance with the Elastic License 2.0.
 */

import { getAppSettings, updateAppSetting, updateMultipleAppSettings } from '../../services/appSettings';
import loggerModule from '../../../common/helpers/logger';

const logger = loggerModule.child({ subType: 'appSettings' });

export const fetchAppSettings = async req => {
  logger.trace({ ctx: req }, 'fetchAppSettings');
  return await getAppSettings(req);
};

export const updateAppSettings = async req => {
  logger.trace({ ctx: req }, 'updateAppSettings');

  const { settings } = req.body;
  if (!settings || !settings.length) return [];

  const keyValuePairs = settings.map(s => ({ key: s.key, value: s.newValue }));

  return keyValuePairs.length === 1
    ? await updateAppSetting(req, keyValuePairs[0].key, keyValuePairs[0].value)
    : await updateMultipleAppSettings(req, keyValuePairs);
};
