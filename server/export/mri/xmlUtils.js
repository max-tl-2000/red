/*
 * Copyright (c) 2022 Reva Technology Inc., all rights reserved.
 * Unauthorized copying of this file, via any medium is strictly prohibited
 * Licensed under the Elastic License 2.0; you may not use this file except
 * in compliance with the Elastic License 2.0.
 */

import { Builder } from 'xml2js';
import path from 'path';
import { read } from '../../../common/helpers/xfs';
import { fillHandlebarsTemplate } from '../../../common/helpers/handlebars-utils';

const buildXmlWithBuilder = (apiType, maps) => {
  const rootName = apiType;
  const builder = new Builder({ rootName });
  const entries = maps;

  return builder.buildObject(entries);
};

const buildXmlWithTemplate = async (xmlTemplate, maps) => {
  const requestTemplate = await read(path.resolve(__dirname, `./resources/${xmlTemplate}`), { encoding: 'utf8' });

  return await fillHandlebarsTemplate(requestTemplate, maps);
};

export const transformMapsToXML = async (apiType, maps, xmlTemplate = '') =>
  xmlTemplate ? await buildXmlWithTemplate(xmlTemplate, maps) : buildXmlWithBuilder(apiType, maps);

export const transformObjToXML = async (apiType, obj, xmlTemplate) => {
  const requestTemplate = await read(path.resolve(__dirname, `./resources/${xmlTemplate}`), { encoding: 'utf8' });

  return await fillHandlebarsTemplate(requestTemplate, obj);
};
