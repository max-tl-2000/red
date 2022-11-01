/*
 * Copyright (c) 2022 Reva Technology Inc., all rights reserved.
 * Unauthorized copying of this file, via any medium is strictly prohibited
 * Licensed under the Elastic License 2.0; you may not use this file except
 * in compliance with the Elastic License 2.0.
 */

import config from '../config';
import { getTenant } from '../services/tenantService';
import { parseTemplateVariables } from '../../common/helpers/emailParser';
import { formatTenantEmailDomain, formatPropertyAddress } from '../../common/helpers/utils';
import { isUuid } from '../api/helpers/validators';
import { AppLinkIdUrls } from '../../common/enums/messageTypes';
import { resolveSubdomainURL } from '../../common/helpers/resolve-url';
import { getUserById } from '../dal/usersRepo';
import loggerModule from '../../common/helpers/logger';
import { loadPartyAgent } from '../dal/partyRepo';
import { getTeamsForUser } from '../dal/teamsRepo';

const isRunningFromApiTests = host => host === '127.0.0.1';
const logger = loggerModule.child({ subType: 'leaseEmails' });
export const EMAIL_UNIQUE_CONSTRAINT_ERROR = 'duplicate key value violates unique constraint "Communication_messageId_';
export const CONTACT_INFO_CONSTRAINT_ERROR = 'duplicate key value violates unique constraint "ContactInfo_value_idx"';
export const DUPLICATE_EMAIL_TIME_INTERVAL_MIN = 240;

export const resolveHost = host => (isRunningFromApiTests(host) ? 'localhost' : host);

export const getFooterLinks = (ctx, communicationSettings, showContactUs = true) => {
  const footerLinks = [
    {
      text: config.mail.registration.termsAndConditions,
      url: AppLinkIdUrls.TERMS_AND_CONDITIONS_ID,
    },
    {
      text: config.mail.registration.privacyPolicyText,
      url: AppLinkIdUrls.PRIVACY_POLICY_ID,
    },
  ];

  if (!showContactUs) return footerLinks;

  const contactUsLink = ctx.contactUsLink || communicationSettings.contactUsLink;
  footerLinks.push({ text: config.mail.registration.contactUsText, url: contactUsLink });
  return footerLinks;
};

export const getFooterSettings = async (ctx, quoteData) => {
  const tenant = await getTenant(ctx);
  const communicationSettings = tenant.settings.communications;

  const emailVariablesToReplace = {
    propertyName: quoteData.flattenedInventory.propertyName,
    propertyAddress: quoteData.flattenedInventory.propertyAddress,
  };

  return {
    footerText: communicationSettings.footerNotice,
    footerLinks: getFooterLinks(ctx, communicationSettings),
    copyright: parseTemplateVariables(communicationSettings.footerCopyright, emailVariablesToReplace),
  };
};

export const getMailDomain = ctx =>
  ctx.tenantName && ctx.tenantName !== 'admin' ? formatTenantEmailDomain(ctx.tenantName, config.mail.emailDomain) : config.mail.emailDomain;

export const generateAnonymousEmail = (ctx, { anonymousEmailId, roommateProfile }) => {
  const domain = getMailDomain(ctx);
  const { preferredName = 'Reva' } = roommateProfile || {};
  return `${preferredName} <${config.auth.anonymousEmailPrefix}-${anonymousEmailId}@${domain}>`;
};

const getEmailIdentifier = (email, hasDomain) => (hasDomain ? email.substring(0, email.lastIndexOf('@')) : email);

export const getAnonymousEmailIdFromEmail = (email, hasDomain = true) => {
  let emailIdentifier = getEmailIdentifier(email, hasDomain);
  emailIdentifier = emailIdentifier.substring(emailIdentifier.lastIndexOf('<') + 1);
  const anonymousEmailId = emailIdentifier.substring(emailIdentifier.indexOf('-') + 1);
  return isUuid(anonymousEmailId) && anonymousEmailId;
};

export const isAnonymousEmail = (email, hasDomain = true) => !!getAnonymousEmailIdFromEmail(email, hasDomain);

export const generateEmailContext = (ctx, { tenantName, partyId, host, quoteId, property }) => ({
  ...ctx,
  tenantName,
  host: resolveSubdomainURL(host, tenantName, false),
  protocol: 'https',
  body: {
    applicationId: 'application', // could get this from config...
    partyId,
    quoteId,
    propertyName: property && property.displayName,
    propertyAddress: formatPropertyAddress(property),
  },
});

// returns a user object, enhanced with the users teams, from the passed in emailInfo
// emailInfo must contain either a senderId or a partyId
export const getSenderInfo = async (ctx, emailInfo) => {
  const sender = emailInfo.senderId ? await getUserById(ctx, emailInfo.senderId) : await loadPartyAgent(ctx, emailInfo.partyId);

  if (!sender) {
    logger.error({ ctx, partyId: emailInfo.partyId }, 'unable to load agent in order to send mail');
    throw new Error('NO_AGENT_FOR_PARTY');
  }
  sender.teams = await getTeamsForUser(ctx, sender.id);

  return sender;
};
