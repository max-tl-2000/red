/*
 * Copyright (c) 2022 Reva Technology Inc., all rights reserved.
 * Unauthorized copying of this file, via any medium is strictly prohibited
 * Licensed under the Elastic License 2.0; you may not use this file except
 * in compliance with the Elastic License 2.0.
 */

import * as service from '../../services/templates';
import { ServiceError } from '../../common/errors';
import { uuid, defined } from '../helpers/validators';

export const mjmlToHtml = req => {
  const { mjml, options } = req.body;
  defined(mjml, 'MJML_PARAM_NOT_DEFINED');

  return service.mjmlToHtml(req, { mjml, options });
};

export const mjmlComponentToHtml = async req => {
  const { component } = req.body;
  defined(component, 'COMPONENT_PARAM_NOT_DEFINED');

  return await service.mjmlComponentToHtml(req, component);
};

export const getTemplatesShortCodes = async req => {
  const { propertyId } = req.params;
  if (!propertyId) throw new ServiceError({ token: 'PROPERTY_NOT_DEFINED', status: 412 });

  return await service.getTemplatesShortCodes(req, propertyId);
};

export const renderTemplate = async req => {
  const { context, partyId, templateDataOverride, templateArgs } = req.body;
  const { templateId } = req.params;

  uuid(partyId, 'INVALID_PARTY_ID');
  uuid(templateId, 'INVALID_TEMPLATE_ID');

  return await service.renderTemplate(req, { templateId, context, partyId, templateDataOverride, templateArgs });
};

export const renderTemplateByName = async req => {
  const { context, partyId, templateDataOverride, templateArgs } = req.body;
  const { templateName } = req.params;

  uuid(partyId, 'INVALID_PARTY_ID');
  defined(templateName, 'TEMPLATE_NAME_NOT_DEFINED');

  return await service.renderTemplate(req, { templateName, context, partyId, templateDataOverride, templateArgs });
};
