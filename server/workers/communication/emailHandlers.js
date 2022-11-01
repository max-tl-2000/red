/*
 * Copyright (c) 2022 Reva Technology Inc., all rights reserved.
 * Unauthorized copying of this file, via any medium is strictly prohibited
 * Licensed under the Elastic License 2.0; you may not use this file except
 * in compliance with the Elastic License 2.0.
 */

import newUUID from 'uuid/v4';
import { sendMailAws } from './aws/awsUtils';
import { sendEmail } from '../../services/bulkEmails/sendGridUtils';
import { handleSendMail, handleEmailStatusChange } from './emailProcessingService';
import logger from '../../../common/helpers/logger';
import { renderEmailTpl, getReactTemplate } from '../../../common/helpers/render-email-tpl';
import { getEmailAddressWithoutDomain } from '../../../common/helpers/utils';
import { DALTypes } from '../../../common/enums/DALTypes';
import { updateMessages } from '../../dal/communicationRepo';
import { savePersonToPersonMessage, updatePersonToPersonMessages } from '../../../roommates/server/services/person-to-person-communication';
import config from '../../config';
import { getDataForInvite } from './helpers/emailHandlerHelper';
import { createApplicationToken } from '../../helpers/auth';
import { resolveSubdomainURL } from '../../../common/helpers/resolve-url';
import { processEmailSettings } from '../../services/emailTemplatingService';
import { loadPartyById } from '../../services/party';
import { getPropertyAssignedToParty } from '../../helpers/party';
import { removeToken } from '../../../common/helpers/strings';

import { sendCommsOnCreateAppointment, sendCommsOnUpdateAppointment, sendCommsOnCancelAppointment } from '../../services/appointments';
import { sendApplicationDeclinedComm } from '../../services/quotePromotions';
import { sendLeaseEmail } from '../../services/leases/leaseService';
import { sendQuoteEmail } from '../../services/quotes';
import { sendAccountCompleteRegistrationEmail } from '../../services/mjmlEmails/applicationEmails';
import { sendResidentsInviteEmail } from '../../services/mjmlEmails/residentsInviteEmails';
import { sendRegistrationInviteEmails } from '../../../rentapp/server/services/payment';
import { addNewCommunication, sendCommunication } from '../../services/communication';
import { saveDirectMessageNotification, updateDirectMessageNotificationStatus } from '../../dal/cohortCommsRepo';
import { createSendGridDirectMessage } from './directMessageNotifications/directMessageNotification';
import { isPersonUnsubscribedFromComm } from '../../dal/commsTemplateRepo';

export const overrideEmailAddresses = (to, template) => {
  if (Array.isArray(to)) {
    return to.map(address => template.replace('%NAME%', getEmailAddressWithoutDomain(address)));
  }
  return template.replace('%NAME%', getEmailAddressWithoutDomain(to));
};

export const outboundCommSent = async data => {
  const { msgCtx } = data;
  logger.trace({ ctx: msgCtx, data }, 'outboundCommSent called');

  await sendCommunication(msgCtx, data);
  return { processed: true };
};

const sendMail = async (ctx, data, html, addressOverrideTemplate) => {
  const messageToSend = {
    ...data.message,
    to: addressOverrideTemplate ? overrideEmailAddresses(data.message.to, addressOverrideTemplate) : data.message.to,
  };
  if (html) {
    messageToSend.html = html;
  }

  if (config.isIntegration) {
    return Promise.resolve({
      MessageId: newUUID(),
    });
  }
  return await sendMailAws(ctx, messageToSend);
};

export const outboundSystemRegistrationEmailSent = async data => {
  const { msgCtx, html, addressOverrideTemplate, from, to, subject, newCommId } = data;
  const res = await sendMail(msgCtx, data, html, addressOverrideTemplate);
  logger.trace({ ctx: msgCtx, from, to, subject, res }, 'Registration email queued for sending.');

  if (res.MessageId) {
    await updateMessages(msgCtx, { id: newCommId }, { messageId: res.MessageId });
  }

  return { processed: true };
};

export const outboundResetPasswordEmailSent = async data => {
  const { msgCtx, message } = data;
  const { from, to, subject } = message;

  logger.trace({ ctx: msgCtx, from, to, subject }, 'Sending outboundResetPasswordEmailSent email');

  const tpl = getReactTemplate('ResetPasswordTemplate');
  const url = data.url;
  const html = renderEmailTpl(tpl, { url });

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
    category: DALTypes.CommunicationCategory.RESET_PASSWORD,
  };
  const addressOverrideTemplate = data.communicationOverrides && data.communicationOverrides.employeeEmails;
  const newComm = await addNewCommunication(msgCtx, messageEntity);
  const res = await sendMail(msgCtx, data, html, addressOverrideTemplate);
  if (res.MessageId) {
    await updateMessages(msgCtx, { id: newComm.id }, { messageId: res.MessageId });
  }

  return { processed: true };
};

export const outboundGenericResetPasswordEmailSent = async data => {
  const { msgCtx, tenantId, communicationOverrides } = data;

  logger.trace({ ctx: msgCtx, data }, 'outboundGenericResetPasswordEmailSent called');

  const tpl = getReactTemplate('GenericResetPasswordTemplate');

  const html = renderEmailTpl(tpl, data);
  const { from, to, subject } = data.message;
  logger.trace({ ctx: msgCtx, from, to, subject }, 'Sending email');

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
    category: DALTypes.CommunicationCategory.RESET_PASSWORD,
  };
  const addressOverrideTemplate = communicationOverrides && communicationOverrides.employeeEmails;
  const res = await sendMail(msgCtx, data, html, addressOverrideTemplate);

  if (tenantId) {
    const newComm = await addNewCommunication(msgCtx, messageEntity);
    if (res.MessageId) {
      await updateMessages(msgCtx, { id: newComm.id }, { messageId: res.MessageId });
    }
  }

  return { processed: true };
};

export const outboundGenericYourPasswordChangedEmailSent = async data => {
  const { msgCtx } = data;
  logger.trace({ ctx: msgCtx, data }, 'outboundGenericYourPasswordChangedEmailSent called');

  const tpl = getReactTemplate('GenericYourPasswordChangedTemplate');
  const propertiesToReplace = {
    propertyName: data.propertyName,
    propertyAddress: data.propertyAddress,
  };
  const props = {
    emailTitle: data.emailTitle,
    appName: data.appName,
    emailText: data.emailText,
    footerText: processEmailSettings(data.footerText, propertiesToReplace),
    copyright: processEmailSettings(data.copyright, propertiesToReplace),
    footerLinks: data.footerLinks,
  };

  const html = renderEmailTpl(tpl, props);
  const { from, to, subject } = data.message;
  logger.trace({ ctx: msgCtx, from, to, subject }, 'Sending email: ');

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
    category: DALTypes.CommunicationCategory.RESET_PASSWORD,
  };
  const addressOverrideTemplate = data.communicationOverrides && data.communicationOverrides.employeeEmails;
  const newComm = await addNewCommunication(msgCtx, messageEntity);
  const res = await sendMail(msgCtx, data, html, addressOverrideTemplate);
  if (res.MessageId) {
    await updateMessages(msgCtx, { id: newComm.id }, { messageId: res.MessageId });
  }

  return { processed: true };
};

export const outboundRegistrationEmail = async data => {
  const { msgCtx } = data;
  logger.trace({ ctx: msgCtx, data }, 'outboundRegistrationEmail called');

  const { personId } = data.ctx;
  const tpl = getReactTemplate('RegisterTemplate');
  const propertiesToReplace = {
    propertyName: data.propertyName,
    propertyAddress: data.propertyAddress,
  };

  logger.trace({ ctx: msgCtx }, `tpl found: ${!!tpl}`);

  const props = {
    url: data.url,
    agentInfo: data.agentInfo,
    emailTitle: data.emailTitle,
    shortAppDescription: data.shortAppDescription,
    emailHeader: data.emailHeader,
    inviteeGreeting: data.inviteeGreeting,
    appInvitation: data.appInvitation,
    completeRegistrationButtonText: data.completeRegistrationButtonText,
    copyableLinkText: data.copyableLinkText,
    linkDurationText: data.linkDurationText,
    footerText: processEmailSettings(data.footerText, propertiesToReplace),
    copyright: processEmailSettings(data.copyright, propertiesToReplace),
    footerLinks: data.footerLinks,
  };
  const html = renderEmailTpl(tpl, props);

  logger.trace({ ctx: msgCtx }, `renderEmailTpl: ${!!html} `);

  const { from, to, subject } = data.message;

  const addressOverrideTemplate = data.communicationOverrides && data.communicationOverrides.employeeEmails;
  const emailMessage = { subject, from, to, html, text: '' };
  const { partyId } = data.ctx.body || {};
  const messageEntity = {
    message: emailMessage,
    unread: false,
    type: DALTypes.CommunicationMessageType.EMAIL,
    direction: DALTypes.CommunicationDirection.OUT,
    persons: [personId],
    status: {
      status: [{ address: to, status: DALTypes.CommunicationStatus.PENDING }],
    },
    threadId: newUUID(),
    category: DALTypes.CommunicationCategory.PERSON_ACCOUNT_REGISTRATION,
  };

  partyId && Object.assign(messageEntity, { parties: [partyId] });

  const newComm = await addNewCommunication(msgCtx, messageEntity);
  const res = await sendMail(msgCtx, data, html, addressOverrideTemplate);

  logger.trace({ ctx: msgCtx, from, to, subject }, 'about to acknowledge sendMail was called.');

  if (newComm.id) {
    await updateMessages(msgCtx, { id: newComm.id }, { messageId: res.MessageId });
  }

  return { processed: true };
};

export const outboundMailStatusUpdate = async data => {
  logger.trace({ ctx: data.msgCtx, data }, 'Mail status received');

  await handleEmailStatusChange(data);

  return { processed: true };
};

export const outboundMailSent = async (data, retryCount) => {
  const { msgCtx } = data;

  const addressOverrideTemplate = data.communicationOverrides && data.communicationOverrides.customerEmails;

  try {
    const res = await sendMail(msgCtx, data, null, addressOverrideTemplate);
    const { entityId, message, partyId, userId, noNotifySentMail = false, sentEmailOnly = false, skipHandleSendEmail = false } = data;

    !skipHandleSendEmail &&
      (await handleSendMail(msgCtx, res, {
        id: entityId,
        to: message.to,
        from: message.from,
        notificationMessage: message.notificationMessage,
        partyId,
        userId,
        noNotifySentMail,
        sentEmailOnly,
      }));

    return { processed: true };
  } catch (error) {
    logger.error({ ctx: msgCtx, error, data, retryCount }, 'outboundMail send error');
    return { processed: false };
  }
};

/**
 * Handler for invitation email
 *
 *   @param data {Object} email information
 *    @param data.tenantId {Guid} Tenant id
 *    @param data.tenantDomain {String} Tenant's domain
 *    @param data.partyId {Guid} Party id
 *    @param data.invites {Array} list of emails
 *      @param data.ctx.memberId {Guid} Member id
 *      @param data.ctx.email {String} person's email
 *    @param data.propertyId {Guid} Property id
 *    @param data.isFromAgent {Boolean} True when the originator is an agent
 *    @param data.originator {Object} Information from originator
 * @return {Object} return { processed: true } when it is handled correctly
 *                  { processed: false } when there is an error
 */
export const outboundApplicationInvitationEmailSent = async data => {
  const { msgCtx: ctx, partyId, invites, isFromAgent = true, originator = { fullName: '' } } = data;
  let propertyId = data.propertyId;

  const { tenantId, tenantDomain } = ctx;
  logger.trace({ ctx, partyId, invites, propertyId, isFromAgent, originator }, 'handler invitation Email');
  const party = await loadPartyById(ctx, partyId);

  if (!propertyId) propertyId = await getPropertyAssignedToParty(ctx, party);

  const tpl = getReactTemplate('ApplicationInvitationTemplate');
  logger.trace(ctx, `tpl found: ${!!tpl}`);

  const { tenant, property, leasingAgent, emailConfiguration, partyMembers, team, program } = await getDataForInvite(ctx, partyId, propertyId);
  logger.info({ ctx, partyId, propertyId, leasingAgent: { id: leasingAgent.id, fullName: leasingAgent.fullName }, team, program }, 'obtained data for invite');

  const propertiesToReplace = {
    propertyName: property.propertyName || '',
    propertyAddress: property.propertyAddress || '',
  };
  const message = `Click the button below to start or continue your application for ${property.propertyName}. Let me know if you have any questions.`;
  const buttonLabel = isFromAgent ? 'OPEN APPLICATION' : 'APPLY NOW';

  const props = {
    propertyInfo: property,
    agentInfo: leasingAgent,
    program,
    contactInfo: { preferredName: '' },
    footerText: processEmailSettings(tenant.settings.communications.footerNotice, propertiesToReplace),
    copyright: processEmailSettings(tenant.settings.communications.footerCopyright, propertiesToReplace),
    footerLinks: emailConfiguration.footerLinks,
    message,
    signature: leasingAgent.fullName,
    buttonLabel,
  };

  const addressOverrideTemplate = tenant.settings.communicationOverrides && tenant.settings.communicationOverrides.customerEmails;
  const from = `${leasingAgent.fullName} <${party.emailIdentifier}@${emailConfiguration.domain}>`;
  const subject = emailConfiguration.subject;

  for (const invite of invites) {
    const { memberId, email: to } = invite;
    const { personId, isGuarantor, otherApplicants = [] } = partyMembers[memberId];
    if (!isFromAgent) {
      if (isGuarantor) {
        props.message = `${originator.fullName} would like you to be a guarantor for a unit at ${property.propertyName}.`;
        props.message2 = `As of now, there are ${otherApplicants.length} roommates including: ${otherApplicants.map(member => member.fullName).join(', ')}`;
        props.message3 = 'Click the button below to fill out a short rental application as a guarantor.';
      } else {
        props.message = `${originator.fullName} invited you to fill out a rental application for a unit at ${property.propertyName}.  Click the button below to get started.`;
      }
    }

    const token = await createApplicationToken({ tenantId, hostname: tenantDomain }, { partyId, memberId, propertyId });
    props.url = resolveSubdomainURL(`https://${tenantDomain}/welcome/${token}`, config.rentapp.hostname);
    props.contactInfo = partyMembers[memberId];
    const html = renderEmailTpl(tpl, props);

    logger.info({ ctx, personId, memberId, to, contactInfo: props.contactInfo }, 'contact info to deliver the message');

    const emailMessage = {
      subject,
      from,
      to: [to],
      html,
      text: '',
      isHtmlContent: true,
      contentForEmailCard: `<a href="${props.url}" target="_blank">View rental application in your browser</a>`,
    };
    const messageEntity = {
      message: emailMessage,
      unread: false,
      type: DALTypes.CommunicationMessageType.EMAIL,
      parties: [partyId],
      userId: leasingAgent.id,
      direction: DALTypes.CommunicationDirection.OUT,
      persons: [personId],
      status: {
        status: [{ address: to, status: DALTypes.CommunicationStatus.PENDING }],
      },
      teams: [team.id],
      threadId: newUUID(),
      category: DALTypes.CommunicationCategory.APPLICATION_INVITE,
    };

    const newComm = await addNewCommunication(ctx, messageEntity);
    const res = await sendMail(ctx, { message: { from, to, subject } }, html, addressOverrideTemplate);
    await handleSendMail(ctx, res, {
      id: newComm.id,
      notificationMessage: 'EMAIL_SENT',
      to,
      from,
      partyId,
      userId: leasingAgent.id,
    });

    logger.trace({ ctx, from, to, subject }, 'about to acknowledge sendMail was called.');
  }

  return { processed: true };
};

export const outboundInvitationFromApplicantEmailSent = async data => {
  const dataLog = {
    ...data,
    quoteData: {
      ...data.quoteData,
      applyNowUrl: removeToken(data.quoteData.applyNowUrl),
    },
  };

  const { msgCtx } = data;

  logger.trace({ ctx: msgCtx, data: dataLog }, 'outboundInvitationFromApplicantEmailSent called');

  const tpl = getReactTemplate(data.templateName);
  const html = renderEmailTpl(tpl, data);
  const { from, to, subject } = data.message;
  const { tenantId, partyId, userId, teamsId, personId } = data.ctx;
  const emailMessage = {
    subject,
    from,
    to: [to],
    html,
    text: '',
  };
  const messageEntity = {
    message: emailMessage,
    unread: false,
    type: DALTypes.CommunicationMessageType.EMAIL,
    parties: [partyId],
    userId,
    direction: DALTypes.CommunicationDirection.OUT,
    persons: [personId],
    status: {
      status: [{ address: to, status: DALTypes.CommunicationStatus.PENDING }],
    },
    teams: teamsId,
    threadId: newUUID(),
    category: DALTypes.CommunicationCategory.APPLICATION_INVITE,
  };

  const newComm = await addNewCommunication({ tenantId }, messageEntity);
  const res = await sendMail(msgCtx, data, html);
  if (newComm.id) {
    await handleSendMail(msgCtx, res, {
      id: newComm.id,
      to,
      from,
      partyId,
      userId,
      noNotifySentMail: true,
    });
  }

  logger.trace({ ctx: msgCtx, from, to, subject }, 'sent invitation from Application email');

  return { processed: true };
};

export const outboundPersonToPersonEmailSent = async data => {
  const { msgCtx } = data;
  logger.trace({ ctx: msgCtx, data }, 'outboundPersonToPersonEmailSent called');

  const {
    message,
    message: { from, to, subject, content: html },
    sender,
    receiver,
  } = data;

  const messageEntity = {
    from: sender.personId,
    to: receiver.personId,
    messageId: newUUID(),
    message,
    status: {
      status: [
        {
          address: to,
          status: (message.personToPersonThreadId && 'received') || DALTypes.CommunicationStatus.PENDING,
        },
      ],
    },
    threadId: message.personToPersonThreadId || newUUID(),
  };
  const newComm = await savePersonToPersonMessage(msgCtx, messageEntity);
  const res = await sendMail(msgCtx, data, html);
  if (newComm.id) {
    const messageDelta = { messageId: message.messageId || res.MessageId };
    message.messageId && Object.assign(messageDelta, { forwardMessageId: res.MessageId });
    await updatePersonToPersonMessages(msgCtx, { id: newComm.id }, messageDelta);
  }

  logger.trace({ ctx: msgCtx, from, to, subject }, 'Sent Person to Person email');

  return { processed: true };
};

export const outboundPriceChangesDetectedEmailSent = async emailInfo => {
  const { msgCtx } = emailInfo;
  logger.trace({ ctx: msgCtx, emailInfo }, 'outboundPriceChangesDetectedEmailSent');

  const tpl = getReactTemplate('PriceChangesDetectedTemplate');
  const { priceChangesDetected } = config.mail;

  const props = {
    requestUpdateText: priceChangesDetected.requestUpdateText,
    priceChanges: emailInfo.priceChanges,
    thirdPartySystem: emailInfo.thirdPartySystem,
  };

  const html = renderEmailTpl(tpl, props);
  await sendMail(msgCtx, emailInfo, html);

  return { processed: true };
};

export const outboundEmailFromForwardingCommunication = async (ctx, messageData) => {
  logger.trace({ ctx, messageData }, 'outboundEmailFromForwardingCommunication');
  try {
    const result = await sendMail(ctx, { message: messageData });
    return { processed: true, result };
  } catch (error) {
    logger.error({ ctx, error, messageData }, 'forward incoming email send error');
    return { processed: false };
  }
};

export const outboundCommsTemplateDataBindingErrorEmailSent = async emailInfo => {
  const { msgCtx } = emailInfo;
  logger.trace({ ctx: msgCtx, emailInfo }, 'outboundCommsTemplateDataBindingErrorEmailSent');

  const tpl = getReactTemplate('CommsTemplateDataBindingErrorTemplate');

  const props = emailInfo.commsTemplate || {};

  const html = renderEmailTpl(tpl, props);
  await sendMail(msgCtx, emailInfo, html);

  return { processed: true };
};

export const decisionServiceEmailHandler = async payload => {
  const { msgCtx: ctx, partyId, emailInfo } = payload;
  logger.info({ ctx, decisionServiceEHPayload: payload }, 'decisionServiceEmailHandler');

  switch (emailInfo.type) {
    case DALTypes.PartyEventType.LEASE_EXECUTED:
    case DALTypes.PartyEventType.LEASE_VERSION_CREATED:
    case DALTypes.PartyEventType.LEASE_VOIDED:
    case DALTypes.PartyEventType.LEASE_SENT: {
      await sendLeaseEmail(ctx, partyId, emailInfo);
      break;
    }
    case DALTypes.PartyEventType.APPOINTMENT_CREATED: {
      await sendCommsOnCreateAppointment(ctx, emailInfo);
      break;
    }
    case DALTypes.PartyEventType.APPOINTMENT_UPDATED: {
      await sendCommsOnUpdateAppointment(ctx, emailInfo, partyId);
      break;
    }
    case DALTypes.PartyEventType.APPOINTMENT_CANCELED: {
      await sendCommsOnCancelAppointment(ctx, emailInfo);
      break;
    }
    case DALTypes.PartyEventType.APPLICATION_STATUS_UPDATED: {
      await sendApplicationDeclinedComm(ctx, emailInfo);
      break;
    }
    case DALTypes.PartyEventType.PAYMENT_RECEIVED: {
      await sendAccountCompleteRegistrationEmail(ctx, emailInfo);
      break;
    }
    case DALTypes.PartyEventType.QUOTE_SENT: {
      await sendQuoteEmail(ctx, emailInfo);
      break;
    }
    case DALTypes.PartyEventType.PERSON_TO_PERSON_APPLICATION_INVITE: {
      await sendRegistrationInviteEmails(ctx, emailInfo);
      break;
    }
    case DALTypes.PartyEventType.PARTY_CREATED:
    case DALTypes.PartyEventType.LEASE_SIGNED: {
      await sendResidentsInviteEmail(ctx, emailInfo);
      break;
    }
    default:
      logger.error({ ctx, payload, emailInfo }, 'invalid email type received');
      return { processed: false };
  }

  return { processed: true };
};

export const outboundDirectMessageSent = async data => {
  const { msgCtx, directMessageNotification } = data;
  logger.info({ ctx: msgCtx, directMessageNotification }, 'outboundDirectMessageSent');

  const { personId } = directMessageNotification;

  if (!directMessageNotification.emailAddress) {
    logger.info({ ctx: msgCtx, directMessageNotification }, 'No recipients to send the direct message email notification to');
    return { processed: true };
  }

  const notificationId = newUUID();

  try {
    const { commsTemplateSettingsId, ...message } = await createSendGridDirectMessage(data, notificationId);

    await saveDirectMessageNotification(msgCtx, {
      id: notificationId,
      communicationId: directMessageNotification.communicationId,
      message: message.content,
      status: DALTypes.CommunicationStatus.PENDING,
      propertyId: directMessageNotification.propertyId,
    });

    if (await isPersonUnsubscribedFromComm(msgCtx, personId, commsTemplateSettingsId)) {
      await updateDirectMessageNotificationStatus(msgCtx, notificationId, DALTypes.CommunicationStatus.FILTERED);
      return { processed: true };
    }

    await sendEmail(msgCtx, message);
    await updateDirectMessageNotificationStatus(msgCtx, notificationId, DALTypes.CommunicationStatus.SENT);

    return { processed: true };
  } catch (error) {
    logger.error({ ctx: msgCtx, error, data }, 'outboundDirectMessageSent send error');
    await updateDirectMessageNotificationStatus(msgCtx, notificationId, DALTypes.CommunicationStatus.FAILED, error);

    return { processed: false };
  }
};
