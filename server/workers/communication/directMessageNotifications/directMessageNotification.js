/*
 * Copyright (c) 2022 Reva Technology Inc., all rights reserved.
 * Unauthorized copying of this file, via any medium is strictly prohibited
 * Licensed under the Elastic License 2.0; you may not use this file except
 * in compliance with the Elastic License 2.0.
 */

import logger from '../../../../common/helpers/logger';
import config from '../../../config';

import { TemplateTypes, TemplateSections, TemplateActions } from '../../../../common/enums/templateTypes';
import { renderTemplate } from '../../../services/templates';
import { getCommsTemplateByPropertyIdAndTemplateSetting } from '../../../dal/commsTemplateRepo';
import { DALTypes } from '../../../../common/enums/DALTypes';
import { replaceSendGridPopulatedValues } from '../../bulkEmails/bulkEmailsUtils';
import { createSubstitutionsBasedOnTemplateTokens } from '../../bulkEmails/sendBulkEmailsHandler';
import { getTokensFromTemplate } from '../../helpers/templateTokens';

const retrieveDirectMessageTemplate = async (ctx, directMessageNotification) => {
  logger.trace({ ctx, directMessageNotification }, 'retrieveDirectMessageTemplate');

  const { propertyId } = directMessageNotification;

  const template = await getCommsTemplateByPropertyIdAndTemplateSetting(ctx, propertyId, {
    section: TemplateSections.NOTIFICATION,
    action: TemplateActions.RXP_DIRECT_MESSAGE,
  });

  if (!template) {
    logger.error({ ctx, directMessageNotification }, 'The template does not exist');
    throw new Error('Template not defined for property');
  }

  const templateWithReplacedSendGridValues = replaceSendGridPopulatedValues(template);

  const { subject, body: messageBody, missingTokens } = await renderTemplate(ctx, {
    bulkEmailTemplate: templateWithReplacedSendGridValues,
    partyId: directMessageNotification.partyId,
    context: TemplateTypes.EMAIL,
    templateArgs: {
      propertyId: directMessageNotification.propertyId,
      personId: directMessageNotification.personId,
      commonUserId: directMessageNotification.commonUserId,
    },
  });

  missingTokens.length && logger.warn({ ctx, directMessageNotification, templateId: template.id, missingTokens }, 'missingTokens for Template');

  return {
    commsTemplateSettingsId: template.commsTemplateSettingsId,
    renderedTemplateSubject: subject,
    renderedTemplateBody: messageBody,
  };
};

export const createSendGridDirectMessage = async (data, notificationToSendId) => {
  const { msgCtx, directMessageNotification } = data;
  logger.info({ ctx: msgCtx, directMessageNotification }, 'createSendGridDirectMessage');

  const { commsTemplateSettingsId, renderedTemplateSubject, renderedTemplateBody } = await retrieveDirectMessageTemplate(msgCtx, directMessageNotification);

  const templateTokens = getTokensFromTemplate({ subject: renderedTemplateSubject, body: renderedTemplateBody });
  const substitutions = await createSubstitutionsBasedOnTemplateTokens(msgCtx, {
    recipient: { fullName: directMessageNotification.fullName },
    directMessageNotificationId: notificationToSendId,
    templateTokens,
    commsTemplateSettingsId,
  });

  return {
    commsTemplateSettingsId,
    from: config.sendGrid.fromEmailAddress,
    personalizations: [
      {
        to: directMessageNotification.emailAddress,
        subject: renderedTemplateSubject,
        substitutions,
        // eslint-disable-next-line camelcase
        custom_args: {
          messageType: DALTypes.CommunicationMessageType.DIRECT_MESSAGE,
          revaDomain: config.domain,
          tenantName: msgCtx.tenantName,
          tenantId: msgCtx.tenantId,
          cloudEnv: config.cloudEnv,
          notificationToSendId,
        },
      },
    ],
    // eslint-disable-next-line camelcase
    content: [{ type: 'text/html', value: renderedTemplateBody }],
  };
};
