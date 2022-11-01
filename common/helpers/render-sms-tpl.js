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

export const getSmsTemplate = templateName => {
  const templatePath = path.join(__dirname, `${config.smsTemplateBasePath}${templateName}`);
  return readFile(templatePath);
};

export const fillSmsTemplate = async templateData => {
  const template = await getSmsTemplate(templateData.templateName);
  return replaceTemplatedValues(template, templateData.data);
};
