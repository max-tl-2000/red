/*
 * Copyright (c) 2022 Reva Technology Inc., all rights reserved.
 * Unauthorized copying of this file, via any medium is strictly prohibited
 * Licensed under the Elastic License 2.0; you may not use this file except
 * in compliance with the Elastic License 2.0.
 */

import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import path from 'path';
import logger from './logger';
import config from '../../server/config';

const TemplateType = {
  MJML: 'MJML',
  REACT: 'REACT',
};

const templatePathByType = {
  [TemplateType.MJML]: config.mail.reactMjmlTemplatesPath,
  [TemplateType.REACT]: config.mail.reactTemplatesPath,
};

const getTemplate = (templateName, templateType) => {
  const pathToModule = path.join(__dirname, `${templatePathByType[templateType]}${templateName}`);
  logger.trace({ pathToModule }, `attempt to load the ${templateType} template`);
  if (process.env.NODE_ENV === 'development') {
    logger.debug('deleting module from cache');
    delete require.cache[require.resolve(pathToModule)];
  }
  const tpl = require(pathToModule); // eslint-disable-line global-require
  return tpl.default ? tpl.default : tpl;
};

export const getReactTemplate = templateName => getTemplate(templateName, TemplateType.REACT);

export const getReactMjmlTemplate = templateName => getTemplate(templateName, TemplateType.MJML);

export const renderEmailTpl = (Component, props, options = {}) => {
  const docType = options.useDoctype ? '<!doctype html>' : '';
  return `${docType}\n${renderToStaticMarkup(<Component {...props} />)}`;
};

export const getEmailHtmlWithReact = templateData => {
  const tpl = getReactTemplate(templateData.templatePath);
  return renderEmailTpl(tpl, templateData.data || templateData);
};
