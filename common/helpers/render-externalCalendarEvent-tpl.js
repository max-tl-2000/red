/*
 * Copyright (c) 2022 Reva Technology Inc., all rights reserved.
 * Unauthorized copying of this file, via any medium is strictly prohibited
 * Licensed under the Elastic License 2.0; you may not use this file except
 * in compliance with the Elastic License 2.0.
 */

import path from 'path';
import readFile from '../../server/helpers/read-file';
import config from '../../server/config';
import { replaceTemplatedValues } from './utils';

export const getExternalCalendarEventTemplate = () => {
  const templatePath = path.join(__dirname, `${config.externalCalendars.calendarEventTemplate}`);
  return readFile(templatePath);
};

export const fillExternalCalendarEventTemplate = async templateData => {
  const template = await getExternalCalendarEventTemplate();
  return replaceTemplatedValues(template, templateData);
};
