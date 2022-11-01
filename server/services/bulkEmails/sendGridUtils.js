/*
 * Copyright (c) 2022 Reva Technology Inc., all rights reserved.
 * Unauthorized copying of this file, via any medium is strictly prohibited
 * Licensed under the Elastic License 2.0; you may not use this file except
 * in compliance with the Elastic License 2.0.
 */

import SendGridClient from '@sendgrid/client';
import SendGridMail from '@sendgrid/mail';

import loggerModule from '../../../common/helpers/logger';
import config from '../../config';

const logger = loggerModule.child({ subType: 'sendGridUtilities' });

export const sendEmail = async (ctx, message) => {
  logger.trace({ ctx, message }, 'sendEmail - send bulk email with sendGrid');

  SendGridMail.setApiKey(config.sendGrid.apiKey);
  SendGridMail.setSubstitutionWrappers('[[', ']]');

  await SendGridMail.send(message)
    .then(([response]) => {
      logger.info({ ctx, message, statusCode: response.statusCode }, 'SendGrid email message delivered');
    })
    .catch(error => {
      throw error;
    });
};

const makeSendGridRequest = async (ctx, method, url, data) => {
  logger.trace({ ctx, method, url, data }, 'makeSendGridRequest');

  SendGridClient.setApiKey(config.sendGrid.apiKey);

  const requestData = {
    method,
    url,
    body: JSON.stringify(data),
  };

  let responseData;

  await SendGridClient.request(requestData)
    .then(([response]) => {
      logger.info({ ctx, response: response.statusCode }, 'SendGrid API call success');
      responseData = response.body;
    })
    .catch(error => {
      throw error;
    });

  return responseData;
};

export const deleteSendGridTemplate = async (ctx, templateId) => {
  logger.trace({ ctx, templateId }, 'deleteSendGridTemplate');

  await makeSendGridRequest(ctx, 'DELETE', `v3/templates/${templateId}`, {});
};

const createSendGridTemplate = async (ctx, property, templateName) => {
  const data = { name: templateName };
  const templateCreationResponse = await makeSendGridRequest(ctx, 'POST', '/v3/templates', data);
  logger.trace({ ctx, property, templateCreationResponse }, 'Template created successfully');

  return templateCreationResponse.id;
};

const createSendGridTemplateVersion = async (ctx, templateId, templateName, subject, body) => {
  const templateVersionData = {
    active: 1,
    // eslint-disable-next-line camelcase
    html_content: body,
    name: `${templateName}-version`,
    subject,
    // eslint-disable-next-line camelcase
    template_id: templateId,
  };

  const templateVersionResponse = await makeSendGridRequest(ctx, 'POST', `v3/templates/${templateId}/versions`, templateVersionData);
  logger.trace({ ctx, templateName, templateVersionResponse }, 'Template version created successfully');
};

export const pushPropertyTemplateToSendGrid = async (ctx, property, subject, body) => {
  logger.trace({ ctx, property }, 'pushPropertyTemplateToSendGrid');

  const templateName = `template-${property}`;

  const templateId = await createSendGridTemplate(ctx, property, templateName);
  await createSendGridTemplateVersion(ctx, templateId, templateName, subject, body);

  return templateId;
};
