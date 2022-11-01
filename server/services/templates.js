/*
 * Copyright (c) 2022 Reva Technology Inc., all rights reserved.
 * Unauthorized copying of this file, via any medium is strictly prohibited
 * Licensed under the Elastic License 2.0; you may not use this file except
 * in compliance with the Elastic License 2.0.
 */

import mjml2html from 'mjml';
import pick from 'lodash/pick';
import uniq from 'lodash/uniq';
import merge from 'lodash/merge';
import stringify from 'json-stringify-safe';
import { ServiceError } from '../common/errors';
import { renderEmailTpl } from '../../common/helpers/render-email-tpl';
import loggerModule from '../../common/helpers/logger';
import { bindDataToTemplate, isMjmlTemplate, getTokensToExpand, replaceOldMjmlSyntax } from '../../common/helpers/mjml-helpers';
import {
  getTemplatesShortCodesByProperty,
  getCommsTemplateById,
  getCommsTemplateByName,
  getCommsTemplateByPropertyIdAndTemplateSetting as getCommsTemplateByPropertyIdAndTemplateSettingRepo,
  saveCommsTemplateSetting as saveCommsTemplateSettingRepo,
  getCommsTemplateSettingByPropertyId as getCommsTemplateSettingByPropertyIdRepo,
} from '../dal/commsTemplateRepo';
import { getPropertyByName } from '../dal/propertyRepo';
import { TemplateTypes, TemplateSections, TemplateActions } from '../../common/enums/templateTypes';
import { getTextExpansionContext, getCommonTextExpansionContext, dynamicComponentTokens } from './textExpansionContext/textExpansionContext';
import { uuid as uuidValidator } from '../api/helpers/validators';
import { exists } from '../database/factory';

const logger = loggerModule.child({ subType: 'templates' });

const validateProperty = async (ctx, propertyId) => {
  uuidValidator(propertyId, 'INCORRECT_UNIT_ID');

  if (!(await exists(ctx.tenantId, 'Property', propertyId))) {
    throw new ServiceError({
      token: 'PROPERTY_NOT_FOUND',
      status: 404,
    });
  }
};

export const getCommsTemplateByPropertyIdAndTemplateSetting = async (ctx, propertyId, templateSetting) => {
  const predefinedTemplateSection = TemplateSections[templateSetting.section];
  if (!predefinedTemplateSection) {
    throw new ServiceError({ token: 'THE_PROVIDED_TEMPLATE_SECTION_DOES_NOT_EXIST', status: 412 });
  }

  const predefinedTemplateAction = TemplateActions[templateSetting.action];
  if (!predefinedTemplateAction) {
    throw new ServiceError({ token: 'THE_PROVIDED_TEMPLATE_ACTION_DOES_NOT_EXIST', status: 412 });
  }

  await validateProperty(ctx, propertyId);

  return await getCommsTemplateByPropertyIdAndTemplateSettingRepo(ctx, propertyId, { section: predefinedTemplateSection, action: predefinedTemplateAction });
};

export const mjmlToHtml = (ctx, { mjml, data, options = {}, templateDataToLog = {} }) => {
  if (typeof mjml !== 'string') throw new ServiceError({ token: 'MJML_SHOULD_BE_OF_THE_TYPE_STRING', status: 412 });

  const result = {
    errors: [],
    missingTokens: [],
  };
  try {
    const { renderedTemplate: mjmlWithBoundData, missingTokens } = bindDataToTemplate(mjml, data);
    const formattedMjmlTemplate = replaceOldMjmlSyntax(mjmlWithBoundData);
    result.missingTokens = missingTokens;

    const { errors, html } = mjml2html(formattedMjmlTemplate, options);
    result.renderedTemplate = html;
    result.errors = errors;

    if (errors.length || missingTokens.length) {
      logger.error({ ctx, errors, missingTokens, ...templateDataToLog }, 'Errors while converting from mjml to html');
    }
  } catch (error) {
    logger.error({ ctx, error, ...templateDataToLog }, 'Errors while converting from mjml to html');
    throw error;
  }

  return result;
};

export const mjmlComponentToHtml = (ctx, { mjmlComponent, props, options = { validationLevel: 'skip' } }) => {
  if (typeof mjmlComponent !== 'function') throw new ServiceError({ token: 'MJML_COMPONENT_SHOULD_BE_OF_TYPE_FUNCTION', status: 412 });

  let result;
  try {
    const staticReactMjml = renderEmailTpl(mjmlComponent, props, { useDoctype: false });
    const formattedMjmlTemplate = replaceOldMjmlSyntax(staticReactMjml);
    result = mjml2html(formattedMjmlTemplate, options);
  } catch (error) {
    logger.error({ ctx, error }, 'Errors while converting from mjml component to html');
    throw error;
  }
  return result;
};

export const getTemplatesShortCodes = async (ctx, propertyId) => {
  if (!propertyId) throw new ServiceError({ token: 'PROPERTY_NOT_DEFINED', status: 412 });

  const templatesShortCodes = await getTemplatesShortCodesByProperty(ctx, propertyId);
  if (!templatesShortCodes || !templatesShortCodes.length) return [];

  return templatesShortCodes.map(templatesShortCode => pick(templatesShortCode, ['id', 'shortCode', 'templateId', 'displayName', 'inactive']));
};

const expandTemplateTokens = async (ctx, partyId, tokensToExpand, templateArgs) => {
  if (partyId) {
    return await getTextExpansionContext(ctx, partyId, tokensToExpand, templateArgs);
  }

  return await getCommonTextExpansionContext(ctx, tokensToExpand, templateArgs);
};

const templatesTypeMapping = {
  [TemplateTypes.EMAIL]: 'emailTemplate',
  [TemplateTypes.SMS]: 'smsTemplate',
};

const render = (ctx, template, { dataToBind, options, templateDataToLog }) => {
  if (!template) return { renderedTemplate: '', missingTokens: [] };
  return isMjmlTemplate(template)
    ? mjmlToHtml(ctx, { mjml: template, data: dataToBind, options, templateDataToLog })
    : bindDataToTemplate(template, dataToBind);
};

/**
 * This function renders a template given the following arguments:
 * @param {object} commsTemplate - The commsTemplate db row
 * @param {string} context - The template type to be rendered(SMS/EMAIL).
 * @param {string} partyId - The id of the party in which the template data will be based.
 * @param {object} templateArgs - The required arguments to build the template data.
 * @param {object} templateDataOverride - The data to override inside the template.
 * @param {object} options - The MJML library rendering options.
 */
export const renderTemplateBase = async (
  ctx,
  { commsTemplate, context = TemplateTypes.EMAIL, partyId, templateArgs = {}, templateDataOverride = {}, options },
) => {
  const logMessageOnRenderTemplateIfNeeded = (assertCritiria, data, message) => {
    assertCritiria && logger.error({ ctx, ...data }, message);
  };

  const baseResult = {
    subject: '',
    body: '',
    missingTokens: [],
  };

  let templateType = context;
  let template = commsTemplate[templatesTypeMapping[context]];
  if (!template) {
    templateType = TemplateTypes.SMS;
    template = commsTemplate[templatesTypeMapping[templateType]];
  }

  const templateDataToLog = {
    templateType,
    ...pick(commsTemplate, ['id', 'name']),
  };

  if (!template) {
    logMessageOnRenderTemplateIfNeeded(true, { commsTemplate: templateDataToLog }, 'The template context does not exist');

    return baseResult;
  }
  const subjectTemplate = commsTemplate.emailSubject;

  const tokensToExpandFromTemplate = getTokensToExpand(template, { includeDynamicKeys: true, dynamicComponentTokens });
  const tokensToExpandFromSubject = subjectTemplate ? getTokensToExpand(subjectTemplate) : [];
  const tokensToExpand = uniq([...tokensToExpandFromTemplate, ...tokensToExpandFromSubject]);

  const snippetContext = tokensToExpand.length ? await expandTemplateTokens(ctx, partyId, tokensToExpand, { ...templateArgs, propertyId: null }) : {};
  const dataToBind = merge(snippetContext, templateDataOverride);

  const mainTemplateResult = render(ctx, template, { dataToBind, options, templateDataToLog });
  const subjectTemplateResult = render(ctx, subjectTemplate, { dataToBind, options, templateDataToLog });

  logMessageOnRenderTemplateIfNeeded(
    subjectTemplateResult.missingTokens.length,
    {
      missingTokens: subjectTemplateResult.missingTokens,
      commsTemplate: templateDataToLog,
    },
    'Missing tokens in the subject comms template',
  );
  logMessageOnRenderTemplateIfNeeded(
    mainTemplateResult.missingTokens.length,
    {
      missingTokens: mainTemplateResult.missingTokens,
      commsTemplate: templateDataToLog,
    },
    'Missing tokens in the comms template',
  );

  return {
    subject: subjectTemplateResult.renderedTemplate || '',
    body: mainTemplateResult.renderedTemplate,
    missingTokens: [...mainTemplateResult.missingTokens, ...subjectTemplateResult.missingTokens],
  };
};

const throwError = token => {
  throw new ServiceError({ token, status: 412 });
};

const checkIfTemplateDefined = (ctx, template, args) => {
  if (!template) {
    logger.error({ ctx, ...args }, 'The template does not exist');
    throwError('THE_TEMPLATE_DOES_NOT_EXIST');
  }
};

export const renderTemplateByPropertyTemplate = async (ctx, propertyTemplate, args) => {
  logger.info({ ctx, propertyTemplate }, 'Templates - renderTemplateByPropertyTemplate started!');
  const { propertyId, section, action } = propertyTemplate;
  const commsTemplate = await getCommsTemplateByPropertyIdAndTemplateSetting(ctx, propertyId, { section, action });

  checkIfTemplateDefined(ctx, commsTemplate, propertyTemplate);

  return await renderTemplateBase(ctx, { ...args, commsTemplate });
};

export const renderTemplateByName = async (ctx, templateName, args) => {
  logger.info({ ctx, templateName }, 'Templates - renderTemplateByName started!');

  const commsTemplate = await getCommsTemplateByName(ctx, templateName.trim());

  checkIfTemplateDefined(ctx, commsTemplate, { templateName });

  return await renderTemplateBase(ctx, { ...args, commsTemplate });
};

export const renderTemplateById = async (ctx, templateId, args) => {
  logger.info({ ctx, templateId }, 'Templates - renderTemplateById started!');
  const commsTemplate = await getCommsTemplateById(ctx, templateId);

  checkIfTemplateDefined(ctx, commsTemplate, { templateId });

  return await renderTemplateBase(ctx, { ...args, commsTemplate });
};

export const renderBulkEmailTemplate = async (ctx, commsTemplate, args) => {
  logger.info({ ctx, templateId: commsTemplate.id }, 'Templates - renderBulkEmailTemplate started!');

  return await renderTemplateBase(ctx, { ...args, commsTemplate });
};

/**
 * This function renders a template given the following arguments, we have 3 main ways to render a template: byTemplateId, byTemplateName and byPropertyTemplate
 * @param {string} templateId - The id of the template to send.
 * @param {string} templateName - The name of the template to send.
 * @param {object} propertyTemplate - An object containing propertyId, section, action
 * @param {string} partyId - The id of the party in which the template data will be based.
 */
export const renderTemplate = async (ctx, args) => {
  logger.info({ ctx, renderTemplateArgs: stringify(args) }, 'Templates - renderTemplate started!');

  const { templateId, templateName, propertyTemplate, bulkEmailTemplate } = args;

  const { propertyId, action, section } = propertyTemplate || {};
  const isPropertyTemplateDefined = propertyId && action && section;

  if (!templateId && !templateName && !isPropertyTemplateDefined && !bulkEmailTemplate) throwError('TEMPLATE_NOT_DEFINED');

  let renderedTemplate;
  if (isPropertyTemplateDefined) {
    renderedTemplate = await renderTemplateByPropertyTemplate(ctx, propertyTemplate, args);
  } else if (templateId) {
    renderedTemplate = await renderTemplateById(ctx, templateId, args);
  } else if (templateName) {
    renderedTemplate = await renderTemplateByName(ctx, templateName, args);
  } else if (bulkEmailTemplate) {
    renderedTemplate = await renderBulkEmailTemplate(ctx, bulkEmailTemplate, args);
  }

  return renderedTemplate;
};

export const saveCommsTemplateSetting = async (ctx, commsTemplateSetting) => {
  const { id: propertyId } = await getPropertyByName(ctx, commsTemplateSetting.property);
  if (!propertyId) {
    throw new ServiceError({
      token: 'PROPERTY_NOT_FOUND',
      status: 404,
    });
  }

  const section = TemplateSections[commsTemplateSetting.section];
  const action = TemplateActions[commsTemplateSetting.action];
  const { id: templateId } = await getCommsTemplateByName(ctx, commsTemplateSetting.templateName);

  if (!section || !action || !templateId) {
    logger.error({ ctx, commsTemplateSetting }, 'Missing or incorrect template setting data');
    throw new ServiceError({ token: 'MISSING_OR_INCORRECT_TEMPLATE_SETTING_DATA', status: 412 });
  }

  return await saveCommsTemplateSettingRepo(ctx, { propertyId, section, action, templateId });
};

export const getCommsTemplateSettingByPropertyId = async (ctx, propertyId) => {
  await validateProperty(ctx, propertyId);

  return await getCommsTemplateSettingByPropertyIdRepo(ctx, propertyId);
};
