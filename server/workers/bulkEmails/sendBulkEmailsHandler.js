/*
 * Copyright (c) 2022 Reva Technology Inc., all rights reserved.
 * Unauthorized copying of this file, via any medium is strictly prohibited
 * Licensed under the Elastic License 2.0; you may not use this file except
 * in compliance with the Elastic License 2.0.
 */

import { mapSeries } from 'bluebird';
import partition from 'lodash/partition';

import serverConfig from '../../config';
import { sendEmail, pushPropertyTemplateToSendGrid } from '../../services/bulkEmails/sendGridUtils';
import { DALTypes } from '../../../common/enums/DALTypes';
import { DELAYED_APP_EXCHANGE, DELAYED_MESSAGE_TYPE } from '../../helpers/message-constants';
import { sendMessage } from '../../services/pubsub';
import { renderTemplate } from '../../services/templates';
import { getCommsTemplateByPropertyIdAndTemplateSetting } from '../../dal/commsTemplateRepo';
import { getPostRecipientsBySessionId, updateNotificationStatus, updateNotificationTemplate, bulkUpdateNotificationParams } from '../../dal/cohortCommsRepo';
import { TemplateTypes, TemplateSections, TemplateActions } from '../../../common/enums/templateTypes';
import { replaceSendGridPopulatedValues } from './bulkEmailsUtils';
import { getTenant } from '../../services/tenantService';
import loggerModule from '../../../common/helpers/logger';
import { createPostUrl, createUnsubscribeUrl } from '../../services/textExpansionContext/helpers/posts';
import { getTokensFromTemplate } from '../helpers/templateTokens';

const logger = loggerModule.child({ subType: 'sendBulkEmailsHandler' });

const deleteSendGridTemplate = async (ctx, templateId) => {
  logger.trace({ ctx, templateId }, 'Sending delayed message to delete the sendGrid template');

  await sendMessage({
    exchange: DELAYED_APP_EXCHANGE,
    key: DELAYED_MESSAGE_TYPE.DELETE_SENDGRID_TEMPLATE,
    message: {
      ctx,
      templateId,
    },
    ctx: {
      ...ctx,
      delay: Number(serverConfig.sendGrid.deleteTemplateDelay),
    },
  });
};

const retrieveRenderedTemplateForProperty = async (ctx, propertyId, partyId, template) => {
  logger.trace({ ctx, propertyId, partyId }, 'retrieveRenderedTemplateForProperty');

  const templateWithReplacedSendGridValues = replaceSendGridPopulatedValues(template);

  const { subject, body: messageBody, missingTokens } = await renderTemplate(ctx, {
    bulkEmailTemplate: templateWithReplacedSendGridValues,
    partyId,
    context: TemplateTypes.EMAIL,
    templateArgs: {
      propertyId,
    },
  });

  missingTokens.length && logger.warn({ ctx, propertyId, partyId, templateId: template.id, missingTokens }, 'missingTokens for Template');

  return {
    renderedTemplateSubject: subject,
    renderedTemplateBody: messageBody,
    commTemplateSettingsId: template.commTemplateSettingsId,
  };
};

const getLinkToPostForTemplate = async (ctx, { recipient }) => {
  const { userEmail, commonUserId, personId, propertyId, postId } = recipient;

  return await createPostUrl(ctx, serverConfig, { email: userEmail, personId, commonUserId, propertyId, postId });
};

const getUnsubscribeLink = async (ctx, { recipient, commsTemplateSettingsId, directMessageNotificationId }) =>
  await createUnsubscribeUrl(ctx, serverConfig, { recipientId: recipient?.id, commsTemplateSettingsId, directMessageNotificationId });

const tokensMapping = {
  recipientName: (ctx, { recipient }) => recipient.fullName,
  residentNotificationPostUrl: getLinkToPostForTemplate,
  recipientUnsubscribeUrl: getUnsubscribeLink,
};

export const createSubstitutionsBasedOnTemplateTokens = async (ctx, { templateTokens, ...rest }) => {
  const substitutions = {};

  for (const templateToken of templateTokens) {
    const tokenWithoutSurroundingBrackets = templateToken.substring(2, templateToken.length - 2);

    const fn = tokensMapping[tokenWithoutSurroundingBrackets];

    if (!fn) {
      throw new Error(`createSubstitutionsBasedOnTemplateTokens failed. Token "${tokenWithoutSurroundingBrackets}" is not found in the mapping functions`);
    }

    try {
      const value = await fn(ctx, rest);
      substitutions[tokenWithoutSurroundingBrackets] = value;
    } catch (error) {
      const err = Error(`createSubstitutionsBasedOnTemplateTokens failed. Mapping function for token "${tokenWithoutSurroundingBrackets}" failed.`);

      err.originalError = error;

      throw err;
    }
  }

  return substitutions;
};

const createRecipientEntry = async (ctx, { recipient, tenantName, tenantId, templateTokens, commsTemplateSettingsId } = {}) => {
  const substitutions = await createSubstitutionsBasedOnTemplateTokens(ctx, { recipient, tenantName, tenantId, templateTokens, commsTemplateSettingsId });
  return {
    to: recipient.userEmail,
    substitutions,
    // eslint-disable-next-line camelcase
    custom_args: {
      revaDomain: serverConfig.domain,
      tenantName,
      tenantId,
      cloudEnv: serverConfig.cloudEnv,
      recipientId: recipient.id,
    },
  };
};

const isSandboxMode = tenant => tenant && tenant.metadata.sendGridSandboxEnabled;

const createSendGridMessage = async (ctx, recipients, templateId, templateTokens, commsTemplateSettingsId) => {
  const personalizations = [];
  const tenant = await getTenant(ctx);
  const notificationParams = [];

  await mapSeries(recipients, async recipient => {
    const recipientEntry = await createRecipientEntry(ctx, {
      recipient,
      tenantName: tenant.name,
      tenantId: tenant.id,
      templateTokens,
      commsTemplateSettingsId,
    });
    recipientEntry.substitutions &&
      notificationParams.push({
        recipientId: recipient.id,
        substitutions: recipientEntry.substitutions,
      });
    personalizations.push(recipientEntry);
  });

  notificationParams.length && (await bulkUpdateNotificationParams(ctx, notificationParams));

  if (isSandboxMode(tenant)) {
    logger.trace({ ctx, recipients }, 'Send Grid is in sandbox mode !');

    return {
      from: serverConfig.sendGrid.fromEmailAddress,
      personalizations,
      // eslint-disable-next-line camelcase
      template_id: templateId,
      // eslint-disable-next-line camelcase
      mail_settings: {
        // eslint-disable-next-line camelcase
        sandbox_mode: {
          enable: true,
        },
      },
    };
  }

  return {
    from: serverConfig.sendGrid.fromEmailAddress,
    personalizations,
    // eslint-disable-next-line camelcase
    template_id: templateId,
  };
};

export const processAndSendBulkEmails = async ctx => {
  logger.trace({ ctx }, 'processAndSendBulkEmails');
  const { sessionId, propertyId, postCategory } = ctx;
  let templateId;
  let allPostRecipientsIds = [];

  try {
    const action = postCategory === DALTypes.PostCategory.ANNOUNCEMENT ? TemplateActions.RXP_ANNOUNCEMENT : TemplateActions.RXP_ALERT;
    const template = await getCommsTemplateByPropertyIdAndTemplateSetting(ctx, propertyId, { section: TemplateSections.NOTIFICATION, action });

    if (!template) {
      logger.error({ ctx, propertyId, section: TemplateSections.NOTIFICATION, action }, 'The template does not exist');
      throw new Error('Template not defined for property');
    }
    const postRecipientsForProperty = await getPostRecipientsBySessionId(ctx, sessionId, template.commsTemplateSettingsId);

    if (!postRecipientsForProperty.length) {
      logger.trace({ ctx, propertyId }, 'No post recipients found for property !');
      return { processed: true };
    }

    const [validPostRecipients, invalidPostRecipients] = partition(postRecipientsForProperty, recipient => recipient.commonUserId);
    allPostRecipientsIds = postRecipientsForProperty.map(postRecipient => postRecipient.id);

    if (validPostRecipients.length) {
      const postRecipientParty = validPostRecipients[0]?.partyId;
      const { renderedTemplateSubject, renderedTemplateBody } = await retrieveRenderedTemplateForProperty(ctx, propertyId, postRecipientParty, template);

      const [unsubscribedPostRecipients, postRecipients] = partition(validPostRecipients, recipient => recipient.filtered);

      if (postRecipients.length) {
        await updateNotificationTemplate(ctx, sessionId, renderedTemplateSubject, renderedTemplateBody);
        templateId = await pushPropertyTemplateToSendGrid(ctx, propertyId, renderedTemplateSubject, renderedTemplateBody);

        const templateTokens = getTokensFromTemplate({ subject: renderedTemplateSubject, body: renderedTemplateBody });

        const message = await createSendGridMessage(ctx, postRecipients, templateId, templateTokens, template.commsTemplateSettingsId);

        await sendEmail(ctx, message);

        await updateNotificationStatus(
          ctx,
          postRecipients.map(postRecipient => postRecipient.id),
          DALTypes.CommunicationStatus.SENT,
        );
      }

      if (unsubscribedPostRecipients.length) {
        await updateNotificationStatus(
          ctx,
          unsubscribedPostRecipients.map(unsubscribedPostRecipient => unsubscribedPostRecipient.id),
          DALTypes.CommunicationStatus.FILTERED,
          'Unsubscribed recipient',
        );
      }
    }

    if (invalidPostRecipients.length) {
      await updateNotificationStatus(
        ctx,
        invalidPostRecipients.map(invalidPostRecipient => invalidPostRecipient.id),
        DALTypes.CommunicationStatus.FAILED,
        'Missing commonUser',
      );
    }
  } catch (error) {
    const errorResponse = {
      message: error?.message,
      code: error?.code,
      errors: error?.response?.body?.errors || error?.response?.body?.error,
    };

    logger.error({ ctx, errorResponse }, 'error while sending bulk email with sendGrid');
    await updateNotificationStatus(ctx, allPostRecipientsIds, DALTypes.CommunicationStatus.FAILED, JSON.stringify(errorResponse));
    return { processed: false };
  } finally {
    templateId && (await deleteSendGridTemplate(ctx, templateId));
  }

  return { processed: true };
};
