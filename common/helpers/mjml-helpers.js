/*
 * Copyright (c) 2022 Reva Technology Inc., all rights reserved.
 * Unauthorized copying of this file, via any medium is strictly prohibited
 * Licensed under the Elastic License 2.0; you may not use this file except
 * in compliance with the Elastic License 2.0.
 */

import get from 'lodash/get';
import uniq from 'lodash/uniq';
import difference from 'lodash/difference';
import { createRegexToSearchBetween } from '../regex';
import config from '../../server/config';
import { renderEmailTpl, getReactMjmlTemplate } from './render-email-tpl';
import nullish from './nullish';
import { sendCommsTemplateDataBindingErrorEmail } from '../../server/services/mails';
import loggerModule from './logger';

const { mail } = config;
const alertLogger = loggerModule.child({ subType: 'mjml' });

const getComponentKeys = template => template.match(createRegexToSearchBetween('{', '}', '(?!{)'));

export const getTokensToExpand = (template, { includeDynamicKeys = false, dynamicComponentTokens = {} } = {}) => {
  const tokensToExpand = template.match(createRegexToSearchBetween('{{', '}}')) || [];
  if (!includeDynamicKeys) return tokensToExpand;

  const componentKeys = getComponentKeys(template) || [];
  const uniqueDynamicTokens = difference(componentKeys, tokensToExpand);
  return uniqueDynamicTokens.reduce((acc, componentKey) => {
    const key = componentKey.split('.').slice(1).join('');
    const dynamicTokens = get(dynamicComponentTokens, key, []);
    acc.push(...dynamicTokens);
    return acc;
  }, tokensToExpand);
};

export const bindStaticDataToTemplate = (template, data) => {
  const result = { missingTokens: [], mjml: template };
  const tokensToExpand = getTokensToExpand(template);
  if (!tokensToExpand.length) return result;

  return tokensToExpand.reduce((acc, key) => {
    const variableValue = get(data, key);
    if (nullish(variableValue)) {
      acc.missingTokens.push(key);
      return acc;
    }

    acc.mjml = acc.mjml.replace(`{{${key}}}`, variableValue);
    return acc;
  }, result);
};

export const bindDynamicDataToTemplate = (template, data, missingTokens) => {
  const componentKeys = getComponentKeys(template);
  const result = { missingTokens: [], mjml: template };
  if (!componentKeys) return result;

  return componentKeys
    .filter(key => !missingTokens.includes(key))
    .reduce((acc, componentKey) => {
      const templateName = get(mail, componentKey);
      if (nullish(templateName)) {
        acc.missingTokens.push(componentKey);
        return acc;
      }
      const component = getReactMjmlTemplate(templateName);
      const staticReactMjml = renderEmailTpl(component, data, { useDoctype: false });

      acc.mjml = acc.mjml.replace(`{${componentKey}}`, staticReactMjml);

      return acc;
    }, result);
};

export const bindDataToTemplate = (template, data) => {
  const templateWithStaticData = bindStaticDataToTemplate(template, data);
  const templateWithDynamicData = bindDynamicDataToTemplate(templateWithStaticData.mjml, data, templateWithStaticData.missingTokens);
  return { missingTokens: [...templateWithStaticData.missingTokens, ...templateWithDynamicData.missingTokens], renderedTemplate: templateWithDynamicData.mjml };
};

export const isMjmlTemplate = template => !!template.match(new RegExp('<mjml>|<mj-.*', 'gm'));

/*
  The mj-container tag has been deleted in MJML4 and there is a bug in the library,
  because is having issues converting the MJML3 sintax to MJML4,
  that's why the next parser was created.
*/
const mjmlOldSyntaxMapping = {
  '<mj-container>': '',
  '</mj-container>': '',
};

export const replaceOldMjmlSyntax = template =>
  Object.keys(mjmlOldSyntaxMapping).reduce((acc, key) => {
    acc = acc.replace(new RegExp(key, 'g'), mjmlOldSyntaxMapping[key]);
    return acc;
  }, template);

const logDataBindingErrorsAlert = (ctx, { missingTokens, templateName, partyId, channels, recipients }) =>
  missingTokens.length &&
  alertLogger.error(
    {
      ctx,
      commsTemplateName: templateName,
      channels: channels.join(', '),
      commsRecipients: recipients.join(', '),
      missingTokens: missingTokens.join(', '),
      partyId,
    },
    'comms template contains binding errors',
  );

export const handleCommsTemplateDataBindingErrors = async (ctx, partyId, commResults = []) => {
  const commResultsHaveErrors = commResults.some(result => result.error);
  if (!commResultsHaveErrors) return;

  const templateBindingErrors = { channels: [], recipients: [], missingTokens: [], partyId };

  const bindingErrors = commResults.reduce((acc, { errors = [] }) => {
    const errorsResult = errors.reduce((accum, { channel, recipientName, missingTokens, templateName }) => {
      if (!accum.channels.includes(channel)) accum.channels.push(channel);
      if (!accum.recipients.includes(recipientName)) accum.recipients.push(recipientName);
      if (!accum.templateName) accum.templateName = templateName;

      accum.missingTokens = uniq([...accum.missingTokens, ...missingTokens]);

      return accum;
    }, templateBindingErrors);

    return { ...acc, ...errorsResult };
  }, templateBindingErrors);

  logDataBindingErrorsAlert(ctx, bindingErrors);

  await sendCommsTemplateDataBindingErrorEmail({ tenantId: ctx.tenantId }, bindingErrors);
};
