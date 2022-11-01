/*
 * Copyright (c) 2022 Reva Technology Inc., all rights reserved.
 * Unauthorized copying of this file, via any medium is strictly prohibited
 * Licensed under the Elastic License 2.0; you may not use this file except
 * in compliance with the Elastic License 2.0.
 */

import newUUID from 'uuid/v4';
import { renderEmailTpl, getReactTemplate } from '../../common/helpers/render-email-tpl';
import { addNewCommunication } from './communication';
import logger from '../../common/helpers/logger';
import { DALTypes } from '../../common/enums/DALTypes';
import { parseTemplateVariables } from '../../common/helpers/emailParser';

const emailPropertiesToParse = ['footerNotice', 'footerCopyright'];

export const processEmailSettings = (emailProps, singlePropertyVariablesToReplace) => {
  const emailVariablesToReplace = {
    propertyName: emailProps.propertyName,
    propertyAddress: emailProps.propertyAddress,
  };

  if (emailProps.tenantCommSettings) {
    emailPropertiesToParse.map(emailProperty => {
      emailProps.tenantCommSettings[emailProperty] = parseTemplateVariables(emailProps.tenantCommSettings[emailProperty], emailVariablesToReplace);
      return emailProperty;
    });
    return emailProps.tenantCommSettings;
  }

  return singlePropertyVariablesToReplace ? parseTemplateVariables(emailProps, singlePropertyVariablesToReplace) : '';
};

export const applyInvitationEmailTemplate = async (ctx, data) => {
  logger.trace({ ctx, data }, 'Applying InviteMailTemplate email template.');
  const tpl = getReactTemplate('InviteMailTemplate');

  if (!tpl) {
    logger.error({ ctx }, 'No template of type InviteMailTemplate was found');
  }

  const { userId } = data.ctx;
  const url = data.url;
  const html = renderEmailTpl(tpl, {
    url,
    appInvitation: data.appInvitation,
    shortAppDescription: data.shortAppDescription,
  });

  const addressOverrideTemplate = data.communicationOverrides && data.communicationOverrides.employeeEmails;

  const { from, to, subject } = data.message;
  const emailMessage = { subject, from, to, html, text: '' };
  const messageEntity = {
    message: emailMessage,
    unread: false,
    type: DALTypes.CommunicationMessageType.EMAIL,
    direction: DALTypes.CommunicationDirection.OUT,
    status: {
      status: [{ address: to, status: DALTypes.CommunicationStatus.PENDING }],
    },
    threadId: newUUID(),
    category: DALTypes.CommunicationCategory.AGENT_ACCOUNT_REGISTRATION,
  };
  if (userId) {
    messageEntity.userId = userId;
  }

  const newComm = await addNewCommunication(ctx, messageEntity);
  return {
    html,
    addressOverrideTemplate,
    from,
    to,
    subject,
    newCommId: newComm.id,
    tenantId: ctx.tenantId,
    message: data.message,
  };
};
