/*
 * Copyright (c) 2022 Reva Technology Inc., all rights reserved.
 * Unauthorized copying of this file, via any medium is strictly prohibited
 * Licensed under the Elastic License 2.0; you may not use this file except
 * in compliance with the Elastic License 2.0.
 */

import get from 'lodash/get';
import { generateInvite } from './invites';
import { getResetTokenForUser } from './tokens';
import { getUserByEmail } from '../../auth/server/services/user-management';
import { getCommonUserByPersonId, getRegistrationToken } from '../../auth/server/services/common-user';
import { getTenant, getTenantSettings } from './tenantService';
import config from '../config';
import { ServiceError } from '../common/errors';
import { resolveSubdomainURL } from '../../common/helpers/resolve-url';
import { sendMessage } from './pubsub';
import { APP_EXCHANGE, COMM_MESSAGE_TYPE } from '../helpers/message-constants';
import { validateEmail } from '../../common/helpers/validations/email';
import { sendUrltoShortener } from './urlShortener';
import { stringFormat } from '../helpers/string-format';
import { createJWTToken } from '../../common/server/jwt-helpers';
import { formatTenantEmailDomain, formatFromEmailAddress } from '../../common/helpers/utils';
import { loadParty, loadPartyAgent } from '../dal/partyRepo';
import { getTeamsForUser } from '../dal/teamsRepo';
import logger from '../../common/helpers/logger';
import { getAdminUser } from '../dal/usersRepo';
import { getPropertyById } from './properties';
import { saveCommonToken } from '../../auth/server/dal/common-tokens-repo';
import { now } from '../../common/helpers/moment-utils';

import { getFooterLinks, resolveHost, getMailDomain, generateAnonymousEmail } from '../helpers/mails';
import { parseTemplateVariables } from '../../common/helpers/emailParser';
import { applyInvitationEmailTemplate } from './emailTemplatingService';
import { parsePriceChangesForMail } from './helpers/priceChangesEmail';
import { logCtx } from '../../common/helpers/logger-utils';
import { getPersonById } from './person';
import { getDisplayName } from '../../common/helpers/person-helper';
import { formatPhone } from '../../common/helpers/phone-utils';
import { stripPersonMappingDataFromAppConfig } from '../../common/helpers/auth';
import { assert } from '../../common/assert';
import { errorIfHasUndefinedValues } from '../../common/helpers/validators';
import { getSmallAvatar, init as initCloudinaryHelpers } from '../../common/helpers/cloudinary';
import { formatEmployeeAssetUrl } from '../helpers/assets-helper';
import { renderTemplate } from './templates';
import { TemplateNames } from '../../common/enums/templateTypes';

const sendMail = async (mailOptions, mailType, ctx) =>
  await sendMessage({
    exchange: APP_EXCHANGE,
    key: mailType,
    message: mailOptions,
    ctx,
  });

function generateMail(from, to, subject) {
  return {
    from,
    to,
    subject,
    text: '',
  };
}

const generateNoreplyMail = (ctx, to, subject, senderName) => {
  const domain = getMailDomain(ctx);
  return generateMail(`${senderName || 'Reva - no reply'} <noreply@${domain}>`, to, subject);
};

// TODO: not a fan of this signature.  partyId should be extracted by the caller. not expected to be dug out of the ctx like this...
// ctx must contain authUser, this is used:
//   to get tenantName (? shouldn't this come from ctx)
//   to get fullName to format the emailAddress
export const generateTeamMail = async (ctx, emailData) => {
  const { authUser } = ctx;

  const enhancedEmailData = { ...emailData, partyId: emailData.partyId || ctx.body.partyId || ctx.params.partyId };
  assert(emailData.fromUser, 'generateTeamMail called without a sender');
  errorIfHasUndefinedValues(emailData);

  const emailDomain = formatTenantEmailDomain(ctx.tenantName || (authUser && authUser.tenantName), config.mail.emailDomain);

  logger.trace({ ctx, emailDomain, partyId: enhancedEmailData?.partyId, fromUser: enhancedEmailData?.fromUser?.id }, 'generateTeamMail about to loadParty');
  const party = await loadParty(ctx, enhancedEmailData.partyId);

  const { emailIdentifier } = party;
  const emailAddress = `${emailIdentifier}@${emailDomain}`;
  const from = formatFromEmailAddress(emailData.fromUser, emailAddress);
  logger.trace({ ctx, from, to: emailData.to, subject: emailData.subject }, 'generateTeamMail about to generateMail');
  return generateMail(from, emailData.to, emailData.subject);
};

export const getResetPasswordUrl = (ctx, token) => {
  const host = resolveHost(ctx.get('Host'));
  let url = resolveSubdomainURL(`${ctx.protocol}://${host}${config.mail.resetPasswordPath}/${token}`, ctx.tenantName);
  if (ctx.mode) url = `${url}?mode=${ctx.mode}`;
  return url;
};

async function generateResetPasswordMailInfo(ctx, email, subject, user) {
  // A user is not logged in when this happens, so we can not use the authUser object
  // As a quick fix, implemented the retrieval of the host here. Ideally should be  a helper shared with login.js

  const message = await generateNoreplyMail(ctx, email, subject);
  const token = await getResetTokenForUser(ctx, user);
  const url = getResetPasswordUrl(ctx, token);

  return {
    message,
    url,
    token,
  };
}

// ctx here is an emailContext, not a traditional ctx
// see generateEmailContext fn in payments.js
export const sendRegistrationEmail = async (ctx, { commonUser, personMapping, propertyId, personApplicationId }) => {
  // QUESTION: is propertyId allowed to be null?
  const {
    body: { partyId, quoteId },
  } = ctx;

  errorIfHasUndefinedValues({ commonUser, personMapping, propertyId, personApplicationId });

  logger.debug({ ctx, commonUserId: commonUser.id, personMapping, propertyId, partyId, quoteId }, 'sending registration Email');

  const tenant = await getTenant(ctx);
  const extendedCtx = { ...ctx, tenantName: tenant.name };

  const authUser = await loadPartyAgent(extendedCtx, partyId);
  if (!authUser) {
    logger.error({ ctx, partyId }, 'unable to load agent in order to send mail');
    throw new Error('NO_AGENT_FOR_PARTY');
  }
  // TODO: consolidate into above query
  // QUESTION: do we not have teams already?
  authUser.teams = await getTeamsForUser(ctx, authUser.id);

  const person = await getPersonById(ctx, personMapping.personId);
  const email = person && person.contactInfo.defaultEmail;
  const emailError = validateEmail(email);

  if (emailError) throw new Error(emailError);

  const employeeAssetUrl = await formatEmployeeAssetUrl(extendedCtx, authUser.id, { permaLink: true, from: 'template' });
  const {
    id: agentUserId,
    fullName,
    displayPhoneNumber,
    displayEmail,
    metadata: { businessTitle },
  } = authUser;

  initCloudinaryHelpers({
    cloudName: config.cloudinaryCloudName,
    tenantName: ctx.tenantName,
    isPublicEnv: config.isPublicEnv,
    isDevelopment: config.isDevelopment,
    domainSuffix: config.domainSuffix,
    reverseProxyUrl: config.reverseProxy.url,
    rpImageToken: config.rpImageToken,
    cloudEnv: config.cloudEnv,
  });
  const agentInfo = {
    agentUserId,
    fullName,
    businessTitle,
    displayPhoneNumber: formatPhone(displayPhoneNumber),
    email: displayEmail,
    avatarUrl: getSmallAvatar(employeeAssetUrl, fullName),
  };
  const mailCtx = { ...ctx, authUser };
  logger.trace({ ctx: mailCtx }, 'sendRegistrationMail about to generateTeamMail');
  const message = await generateTeamMail(mailCtx, { fromUser: authUser, to: email, subject: config.mail.registration.emailTitle });
  const host = resolveHost(ctx.host);

  logger.trace({ ctx: mailCtx, commonUser, host }, 'sendRegistrationMail about to getRegistrationToken');
  const token = await getRegistrationToken(mailCtx, commonUser, {
    partyId,
    quoteId,
    personApplicationId,
    propertyId,
    personId: personMapping.personId,
    tenantDomain: resolveSubdomainURL(host, tenant.name, false),
  });
  logger.trace({ ctx: mailCtx }, 'sendRegistrationMail back from getRegistrationToken');

  const url = resolveSubdomainURL(`${ctx.protocol}://${host}/${config.mail.registration.registrationPath}?token=${token}`, config.mail.registration.tenantName);

  logger.trace({ ctx: mailCtx, url }, 'sendRegistrationMail about to send to shortener');
  const [shortenedUrl] = await sendUrltoShortener(ctx, [url]);
  logger.trace({ ctx: mailCtx, url }, 'sendRegistrationMail about to generate mailinfo');

  const mailInfo = {
    // TODO: personId does NOT belong in ctx...
    ctx: { ...ctx, personId: personMapping.personId },
    message,
    agentInfo,
    footerLinks: getFooterLinks(ctx, tenant.settings.communications),
    url: shortenedUrl,
    emailTitle: config.mail.registration.emailTitle,
    shortAppDescription: config.mail.registration.shortAppDescription,
    propertyName: ctx.body.propertyName,
    propertyAddress: ctx.body.propertyAddress,
    emailHeader: ctx.body.propertyName,
    inviteeGreeting: stringFormat(config.mail.registration.emailGreeting, {
      inviteeName: getDisplayName(commonUser, { ignoreContactInfo: true, usePreferred: true }),
    }),
    appInvitation: config.mail.registration.appInvitation,
    completeRegistrationButtonText: config.mail.registration.completeRegistrationButtonText,
    copyableLinkText: config.mail.registration.copyableLinkText,
    linkDurationText: config.mail.registration.linkDurationText,
    footerText: tenant.settings.communications.footerNotice,
    copyright: tenant.settings.communications.footerCopyright,
    communicationOverrides: tenant.settings?.communicationOverrides,
  };
  logger.trace({ ctx: mailCtx }, 'sendRegistrationMail about to sendMail');
  return await sendMail(mailInfo, COMM_MESSAGE_TYPE.OUTBOUND_REGISTRATION_EMAIL, ctx);
};

export async function sendResetPasswordMail(ctx, email) {
  logger.debug({ email }, 'sendResetPasswordMail');
  const emailError = validateEmail(email);
  if (emailError !== '') {
    throw new ServiceError({
      token: emailError,
      status: 400,
    });
  }

  let user = '';
  try {
    user = await getUserByEmail(ctx, email);
  } catch (error) {
    // If mail is not found we return success anyway for security.
    return true;
  }
  const subject = config.mail.resetMailSubject;
  const mailInfo = await generateResetPasswordMailInfo(ctx, email, subject, user);

  const tenant = await getTenant(ctx);
  const communicationOverrides = tenant.settings && tenant.settings.communicationOverrides;
  return await sendMail({ ctx: { tenantId: tenant.id }, ...mailInfo, communicationOverrides }, COMM_MESSAGE_TYPE.OUTBOUND_RESET_PASSWORD_EMAIL, ctx);
}

export const generateRegistrationUrl = (ctx, token) =>
  resolveSubdomainURL(`${ctx.authUser.protocol}://${ctx.authUser.domain}/register/${token}`, ctx.tenantName);

// this is used to send mails to employees
export const sendInviteEmail = async (ctx, email, organization, inviteData) => {
  logger.debug({ ctx, email, organization }, 'sendInviteMail');
  const tenantId = organization || ctx.tenantId;
  const emailError = validateEmail(email);
  if (emailError) {
    logger.warn({ email }, 'email was not valid');
    return Promise.reject(
      new ServiceError({
        token: emailError,
      }),
    );
  }

  assert(ctx.authUser, 'sendInviteEmail caleld without an authUser');

  const message = await generateNoreplyMail(ctx, email, config.mail.inviteMailSubject);
  const superAdminUser = await getAdminUser({ tenantId: 'admin' });
  const userId = superAdminUser.id === ctx.authUser.id ? '' : ctx.authUser.id;
  const user = await getUserByEmail(ctx, email, false /* no error if not found */);
  let url;
  if (user) {
    logger.trace({ ctx, userId: user.id }, 'user from email');
    const token = await getResetTokenForUser(ctx, user);
    url = getResetPasswordUrl(ctx, token);
  } else {
    // currently this path isn't used.  It was used in an old screen in which employees could send invites
    // to other employees
    const { token: inviteToken } = await generateInvite(ctx, email, organization, {
      ...inviteData,
      tenantName: ctx.tenantName,
    });
    url = generateRegistrationUrl(ctx, inviteToken);
  }
  logger.trace({ tenantId, url }, 'preparing to send mail');

  const tenantSettings = await getTenantSettings(ctx, tenantId);

  const mailInfo = {
    ctx: { tenantId, userId },
    message,
    url,
    appInvitation: stringFormat(config.mail.redAppInvitation, config.mail.redAppName),
    shortAppDescription: config.mail.redAppShortDescription,
    communicationOverrides: tenantSettings?.communicationOverrides,
  };

  const templatingResult = await applyInvitationEmailTemplate(ctx, mailInfo);
  return await sendMail(templatingResult, COMM_MESSAGE_TYPE.OUTBOUND_SYSTEM_REGISTRATION_EMAIL, ctx);
};

const getPropertyNameAndAddress = async ctx => {
  if (!ctx.propertyId) return {};

  const property = (await getPropertyById(ctx, ctx.propertyId)) || {};
  const { addressLine1, city, state } = property.address || {};
  const propertyAddress = [addressLine1, city, state].filter(x => x).join(', ');
  return {
    propertyAddress,
    propertyName: property.displayName,
  };
};

export const sendInviteRegisterEmail = async (req, commonUserResult) => {
  const ctx = (req.tenantId && req) || req.emailContext;
  const { commonUser } = commonUserResult;
  logger.trace({ ctx, commonUserId: commonUser.id }, 'sendInviteRegisterEmail');
  const emailError = validateEmail(commonUser.email);
  if (emailError) {
    return Promise.reject(
      new ServiceError({
        token: emailError,
      }),
    );
  }
  const message = await generateNoreplyMail(ctx, commonUser.email, config.mail.roommateFinderRegistration.emailTitle, ctx.appName);
  const tenant = await getTenant(ctx);

  // TODO: SHould see whether we can use createTokenForGenericResetPasswordMail
  const tokenData = {
    appId: ctx.appId,
    emailAddress: commonUser.email,
    name: getDisplayName(commonUser, { ignoreContactInfo: true, preferredFirst: true }),
    applicationId: commonUser.metadata.applicationId,
    userId: commonUser.id,
    tenantName: ctx.tenantName,
    propertyName: ctx.propertyName,
    propertyId: ctx.propertyId,
  };
  /*  const tokenData = {
    appId: ctx.appId,
    emailAddress: commonUser.email,
    name: getDisplayName(commonUser, { ignoreContactInfo: true, usePreferred: true }),
    tenantName: ctx.tenantName,
    propertyName: ctx.propertyName,
    propertyId: ctx.propertyId,
    applicationId: commonUser.metadata.applicationId,
    userId: commonUserResult.personMapping.commonUserId,
    personMapping: commonUserResult.personMapping,
    settings: {
      communications: {
        disclaimerLink: tenant.settings.communications.disclaimerLink,
        contactUsLink: ctx.contactUsLink,
      },
      appConfig: stripPersonMappingDataFromAppConfig(ctx.appConfig),
    },
  }; */
  const validPeriodInDays = 1; // config.tokens.validPeriodInDays
  const token = {
    token: createJWTToken(tokenData, { expiresIn: `${validPeriodInDays}d` }),
    expiryDate: now().add(validPeriodInDays, 'days'),
    userId: commonUser.id,
  };
  const savedToken = await saveCommonToken(ctx, token);

  if (!savedToken) {
    throw new ServiceError({
      token: 'ERROR_SAVING_RESET_TOKEN',
    });
  }
  const url = `${ctx.confirmUrl}?confirmToken=${savedToken}`;

  const [shortenedUrl] = await sendUrltoShortener(ctx, [url]);
  const emailVariablesToReplace = await getPropertyNameAndAddress(ctx);
  const mailInfo = {
    ctx: {
      tenantId: tenant.id,
      personId: commonUserResult.personMapping.personId,
      userId: commonUserResult.personMapping.commonUserId,
    },
    message,
    footerLinks: getFooterLinks(ctx, tenant.settings.communications),
    url: shortenedUrl,
    emailTitle: config.mail.roommateFinderRegistration.emailTitle,
    shortAppDescription: '',
    propertyName: ctx.shortAppName,
    propertyAddress: '',
    emailHeader: ctx.appName,
    inviteeGreeting: stringFormat(config.mail.roommateFinderRegistration.emailGreeting, { appName: ctx.appName }),
    appInvitation: config.mail.roommateFinderRegistration.appInvitation,
    completeRegistrationButtonText: config.mail.roommateFinderRegistration.completeRegistrationButtonText,
    copyableLinkText: config.mail.roommateFinderRegistration.copyableLinkText,
    linkDurationText: config.mail.roommateFinderRegistration.linkDurationText,
    footerText: ctx.footerNotice,
    copyright: parseTemplateVariables(tenant.settings.communications.footerCopyright, emailVariablesToReplace),
    communicationOverrides: '',
  };
  return await sendMail(mailInfo, COMM_MESSAGE_TYPE.OUTBOUND_REGISTRATION_EMAIL, ctx);
};

export const createTokenForGenericResetPasswordMail = async (ctx, { isRentappReset, commonUser, commonUserResult, tenant }) => {
  const baseTokenData = {
    appId: ctx.appId,
    emailAddress: commonUser.email,
    name: getDisplayName(commonUser, { ignoreContactInfo: true, preferredFirst: true }),
    applicationId: commonUser.metadata.applicationId,
    isResetPassword: true,
  };

  const tokenData = isRentappReset
    ? {
        ...baseTokenData,
        userId: commonUser.id,
      }
    : {
        ...baseTokenData,
        tenantId: ctx.tenantId,
        tenantName: ctx.tenantName,
        propertyName: ctx.shortAppName,
        propertyId: ctx.propertyId,
        userId: commonUserResult.personMapping.commonUserId,
        personMapping: commonUserResult.personMapping,
        settings: {
          communications: {
            disclaimerLink: tenant.settings.communications.disclaimerLink,
            contactUsLink: ctx.contactUsLink,
          },
          appConfig: stripPersonMappingDataFromAppConfig(ctx.appConfig),
        },
      };

  const token = {
    token: createJWTToken(tokenData, { expiresIn: `${config.tokens.validPeriodInDays}d` }),
    expiryDate: now().add(config.tokens.validPeriodInDays, 'days'),
    userId: commonUser.id,
  };

  const savedToken = await saveCommonToken(ctx, token);

  if (!savedToken) {
    throw new ServiceError({
      token: 'ERROR_SAVING_RESET_TOKEN',
    });
  }

  return savedToken;
};

const getGenericResetPasswordMailInfo = async (ctx, { commonUser, commonUserResult, message }) => {
  const { emailTitle, emailText, changePasswordButtonText, copyableLinkText, linkDurationText, footerText } = config.mail.genericResetPassword;
  const { isRentappReset, confirmUrl } = ctx;

  const tenant = ctx.tenantId && (await getTenant(ctx));

  const token = await createTokenForGenericResetPasswordMail(ctx, { isRentappReset, commonUser, commonUserResult, tenant });
  const url = !isRentappReset ? `${confirmUrl}?confirmToken=${token}` : `${confirmUrl}/${token}`;

  const [shortenedUrl] = await sendUrltoShortener(ctx, [url]);
  const communicationsSettings = tenant ? tenant.settings.communications : {};
  const showContactUsLink = false;

  const baseMailInfo = {
    message,
    url: shortenedUrl,
    footerLinks: getFooterLinks(ctx, communicationsSettings, showContactUsLink),
    emailTitle,
    appName: ctx.appName,
    emailText,
    changePasswordButtonText,
    copyableLinkText,
    linkDurationText,
    footerText,
    communicationOverrides: '',
  };

  return isRentappReset
    ? baseMailInfo
    : {
        ...baseMailInfo,
        ctx: {
          tenantId: tenant.id,
          personId: commonUserResult.personMapping.personId,
          userId: commonUserResult.personMapping.commonUserId,
        },
      };
};

export const sendGenericResetPasswordEmail = async (ctx, commonUserResult) => {
  const { commonUser } = commonUserResult;
  logger.trace({ ctx, commonUserId: commonUser.id }, 'sendGenericResetPasswordEmail');
  const emailError = validateEmail(commonUser.email);
  if (emailError) {
    return Promise.reject(
      new ServiceError({
        token: emailError,
      }),
    );
  }

  const message = await generateNoreplyMail(ctx, commonUser.email, config.mail.genericResetPassword.emailTitle, ctx.appName);
  const mailInfo = await getGenericResetPasswordMailInfo(ctx, { commonUser, commonUserResult, message });

  return sendMail(mailInfo, COMM_MESSAGE_TYPE.OUTBOUND_GENERIC_RESET_PASSWORD_EMAIL, ctx);
};

export const sendGenericYourPasswordChangedEmail = async (ctx, commonUserResult) => {
  const { commonUser } = commonUserResult;
  logger.trace({ ctx, commonUserId: commonUser.id }, 'sendGenericYourPasswordChangedEmail');
  const emailError = validateEmail(commonUser.email);
  if (emailError) {
    return Promise.reject(
      new ServiceError({
        token: emailError,
      }),
    );
  }

  const message = await generateNoreplyMail(ctx, commonUser.email, config.mail.genericYourPasswordChanged.emailTitle, ctx.appName);
  const tenant = await getTenant(ctx);
  const emailVariablesToReplace = await getPropertyNameAndAddress(ctx);

  const mailInfo = {
    ctx: {
      tenantId: tenant.id,
      personId: commonUserResult.personMapping.personId,
      userId: commonUserResult.personMapping.commonUserId,
    },
    message,
    footerLinks: getFooterLinks(ctx, tenant.settings.communications),
    emailTitle: config.mail.genericYourPasswordChanged.emailTitle,
    appName: ctx.appName,
    propertyName: ctx.shortAppName,
    propertyAddress: ctx.propertyAddress || '',
    emailText: stringFormat(config.mail.genericYourPasswordChanged.emailText, {
      email: commonUser.email,
      appName: ctx.appName,
    }),
    footerText: ctx.footerNotice,
    copyright: parseTemplateVariables(tenant.settings.communications.footerCopyright, emailVariablesToReplace),
    communicationOverrides: '',
  };

  return sendMail(mailInfo, COMM_MESSAGE_TYPE.OUTBOUND_GENERIC_YOUR_PASSWORD_CHANGED_EMAIL, ctx);
};

export const sendResidentResetPasswordEmail = async (ctx, { commonUser, propertyId, appId, appName, isConfirmation }) => {
  const commonUserId = commonUser?.id;
  logger.trace({ ctx, commonUserId, propertyId, appId, appName }, 'sendResidentResetPasswordEmail');
  const emailError = validateEmail(commonUser?.email);
  if (emailError) {
    throw new ServiceError({
      token: emailError,
    });
  }

  const applicationName = appName;
  const templateArgs = { commonUserId, currentPropertyId: propertyId, appId, applicationName, tenantId: ctx.tenantId };
  const templateDataOverride = { property: { applicationName } };

  const { body, subject } = await renderTemplate(ctx, {
    templateName: isConfirmation ? TemplateNames.RXP_RESIDENT_PASSWORD_RESET_CONFIRMATION : TemplateNames.RXP_RESIDENT_FORGOT_PASSWORD,
    templateArgs,
    templateDataOverride,
  });

  const emailInfo = {
    message: {
      ...generateNoreplyMail(ctx, commonUser.email, subject),
      html: body,
      isHtmlContent: true,
    },
    skipHandleSendEmail: true,
  };

  return await sendMail(emailInfo, COMM_MESSAGE_TYPE.OUTBOUND_EMAIL, ctx);
};

export const sendNoCommonResidentResetPasswordEmail = async (ctx, appName, email) => {
  logger.trace({ ctx, email, appName }, 'sendNoCommonResidentResetPasswordEmail');
  const emailError = validateEmail(email);
  if (emailError) {
    throw new ServiceError({
      token: emailError,
    });
  }
  const applicationName = appName;
  const templateDataOverride = { property: { applicationName } };
  const templateArgs = { applicationName, tenantId: ctx.tenantId };
  const { body, subject } = await renderTemplate(ctx, {
    templateName: TemplateNames.RXP_RESIDENT_FORGOT_PASSWORD_FOR_NO_CURRENT_USER,
    templateArgs,
    templateDataOverride,
  });

  const emailInfo = {
    message: {
      ...generateNoreplyMail(ctx, email, subject),
      html: body,
      isHtmlContent: true,
    },
    skipHandleSendEmail: true,
  };

  return await sendMail(emailInfo, COMM_MESSAGE_TYPE.OUTBOUND_EMAIL, ctx);
};

export const sendApplicationInvitationMail = (ctx, { tenantDomain, partyId, invites, propertyId, isFromAgent, originator }) => {
  const data = {
    ctx: {
      tenantId: ctx.tenantId,
      tenantDomain,
      protocol: ctx.protocol,
      reqId: ctx.reqId,
    },
    partyId,
    invites,
    propertyId,
    isFromAgent,
    originator,
  };
  return sendMail(data, COMM_MESSAGE_TYPE.OUTBOUND_APPLICATION_INVITATION_EMAIL, ctx);
};

export const sendPersonToPersonMail = async (ctx, emailData) => {
  const { from, to, subject, content, messageId, personToPersonThreadId } = emailData;
  const senderUser = await getCommonUserByPersonId(ctx, from.personId);
  const anonymousEmail = generateAnonymousEmail(ctx, senderUser);

  const message = {
    from: anonymousEmail,
    to: [to.contactReference.email],
    subject,
    content,
  };

  messageId && Object.assign(message, { messageId });
  personToPersonThreadId && Object.assign(message, { personToPersonThreadId });

  const data = {
    ctx,
    message,
    sender: from,
    receiver: to,
  };

  return sendMail(data, COMM_MESSAGE_TYPE.OUTBOUND_ROOMMATE_CONTACT_EMAIL, ctx);
};

export const sendPriceChangesDetectedMail = async (ctx, emailData) => {
  const priceChanges = await parsePriceChangesForMail(ctx, emailData.priceChanges);
  if (!(priceChanges && priceChanges.length)) return;

  const tenant = await getTenant(ctx);
  const { priceChangesDetected } = config.mail;
  const subject = stringFormat(priceChangesDetected.subject, {
    tenantName: tenant.name,
  });
  const emailContext = { ...ctx, tenantName: tenant.name };

  const { thirdPartySystem = '' } = emailData;
  const emailInfo = {
    ctx: emailContext,
    message: generateNoreplyMail(emailContext, priceChangesDetected.receiver, subject),
    priceChanges,
    thirdPartySystem: thirdPartySystem[0].toUpperCase() + thirdPartySystem.substring(1).toLowerCase(),
  };

  await sendMail(emailInfo, COMM_MESSAGE_TYPE.OUTBOUND_PRICE_CHANGES_DETECTED_EMAIL, ctx);
};

export const sendCommsTemplateDataBindingErrorEmail = async (ctx, emailData) => {
  logger.error({ ctx, emailData }, 'sendCommsTemplateDataBindingErrorEmail');

  const { name: tenantName } = await getTenant(ctx);
  const { email, subject } = get(config, 'communications.templates.support');
  const emailContext = { ...ctx, tenantName };

  if (!email) {
    logger.warn({ ...logCtx(emailContext), tenantName }, 'comms template support email is not set');
    return;
  }

  const formattedSubject = stringFormat(subject, {
    tenantName: tenantName.toUpperCase(),
    templateName: emailData.templateName,
  });

  const emailInfo = {
    ctx: emailContext,
    message: generateNoreplyMail(emailContext, email, formattedSubject),
    commsTemplate: emailData,
  };

  await sendMail(emailInfo, COMM_MESSAGE_TYPE.OUTBOUND_COMMS_TEMPLATE_DATA_BINDING_ERROR_EMAIL, ctx);
};

export const sendMarketingFormEmail = async (ctx, message) => {
  const emailInfo = {
    message: {
      ...generateNoreplyMail(ctx, message.to, message.subject),
      html: message.body,
      isHtmlContent: true,
    },
    sentEmailOnly: true,
    noNotifySentMail: true,
  };
  await sendMail(emailInfo, COMM_MESSAGE_TYPE.OUTBOUND_EMAIL, ctx);
};
