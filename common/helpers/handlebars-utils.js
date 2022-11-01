/*
 * Copyright (c) 2022 Reva Technology Inc., all rights reserved.
 * Unauthorized copying of this file, via any medium is strictly prohibited
 * Licensed under the Elastic License 2.0; you may not use this file except
 * in compliance with the Elastic License 2.0.
 */

import Handlebars from 'handlebars';
import fs from 'fs';
import juice from 'juice';

const registerHandlebarsHelper = (helperName, fn) => Handlebars.registerHelper(helperName, fn);

export const fillHandlebarsTemplate = (templateHtml, data, helpers = {}) => {
  Object.entries(helpers).forEach(([helperName, helperFn]) => registerHandlebarsHelper(helperName, helperFn));
  const compiled = Handlebars.compile(templateHtml);
  return compiled(data);
};

export const inlineEmail = emailHtml => {
  const inlineProperties = {
    preserveImportant: true,
    applyAttributesTableElements: false,
    applyWidthAttributes: false,
    applyHeightAttributes: false,
  };

  return new Promise((resolve, reject) => {
    juice.juiceResources(emailHtml, inlineProperties, (error, html) => {
      if (error) {
        return reject(error);
      }
      return resolve(html);
    });
  });
};

export const getTemplate = templatePath =>
  new Promise((resolve, reject) => {
    fs.realpath(templatePath, (pathErr, resolvedPath) => {
      if (pathErr) {
        return reject(pathErr);
      }
      return fs.readFile(resolvedPath, (readErr, data) => {
        if (readErr) {
          return reject(readErr);
        }
        return resolve(data);
      });
    });
  });

const renderEmail = (templateHtml, data) => {
  registerHandlebarsHelper('unlessLastItem', (index, array, options) => {
    index < array.length - 1 ? options.fn(this) : options.inverse(this);
  });
  return fillHandlebarsTemplate(templateHtml, data);
};

export const getInlinedEmailHtml = async data => {
  const templateHtml = await getTemplate(data.templatePath);
  const emailHtml = await renderEmail(templateHtml.toString(), data);
  const inlinedEmailHtml = await inlineEmail(emailHtml);
  return inlinedEmailHtml;
};
