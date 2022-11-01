/*
 * Copyright (c) 2022 Reva Technology Inc., all rights reserved.
 * Unauthorized copying of this file, via any medium is strictly prohibited
 * Licensed under the Elastic License 2.0; you may not use this file except
 * in compliance with the Elastic License 2.0.
 */

import getUUID from 'uuid/v4';
import pick from 'lodash/pick';
import flatten from 'lodash/flatten';
import sortBy from 'lodash/sortBy';
import partition from 'lodash/partition';
import intersection from 'lodash/intersection';
import remove from 'lodash/remove';
import union from 'lodash/union';
import uniq from 'lodash/uniq';
import isEqual from 'lodash/isEqual';
import { mapSeries, Promise } from 'bluebird';
import isEmpty from 'lodash/isEmpty';
import * as commsRepo from '../dal/communicationRepo';
import * as contactInfoRepo from '../dal/contactInfoRepo';
import {
  loadParty,
  loadPartyById,
  loadParties,
  getOwnersForParties,
  getTimezoneForParty,
  getPersonIdsbyPartyIds,
  isCorporateLeaseType,
  loadPartyAgent,
  getTeamsForParties,
  getActivePartyIdsByPersonIdsPropertyIdAndState,
  getPartyIdsByPersonIdsPropertyIdAndState,
  getOwnerTeamsForParties,
  getActivePartiesByPartyGroupId,
} from '../dal/partyRepo';
import { getTeamsForUsers, getTeamsForUser } from '../dal/teamsRepo';
import { getProperty } from '../dal/propertyRepo';
import { getPersonById, getPersonsByIds } from '../dal/personRepo';
import { getCallDetailsByCommId, saveCallDetails } from '../dal/callDetailsRepo';
import { DALTypes } from '../../common/enums/DALTypes';
import { ServiceError } from '../common/errors';
import { sendMessage } from './pubsub';
import { APP_EXCHANGE, COMM_MESSAGE_TYPE } from '../helpers/message-constants';
import config from '../config';
import * as utils from '../../common/helpers/utils';
import {
  logEntity,
  updatePartyActivity,
  getActivityLogDetailsForNewComm,
  getActivityLogDetailsForCommUpdate,
  getComponentTypeForComm,
} from './activityLogService';
import { COMPONENT_TYPES, ACTIVITY_TYPES, SUB_COMPONENT_TYPES } from '../../common/enums/activityLogTypes';
import { sendUrltoShortener } from './urlShortener';
import { addTokenToUrls } from '../helpers/urlShortener';
import { getPersonalizedData, getUnitShortHand } from '../../common/helpers/quotes';
import { getInlinedEmailHtml, inlineEmail } from '../../common/helpers/handlebars-utils';
import { getEmailHtmlWithReact } from '../../common/helpers/render-email-tpl';
import * as telephony from './telephony';
import { sendMessageToCompleteFollowupPartyTasks } from '../helpers/taskUtils';
import { resolveSubdomainURL } from '../../common/helpers/resolve-url';
import { getDisplayName } from '../../common/helpers/person-helper';
import { sendApplicationInvitationMail, generateTeamMail } from './mails';
import { fillSmsTemplate } from '../../common/helpers/render-sms-tpl';
import loggerModule from '../../common/helpers/logger';
import { getFooterSettings } from '../helpers/mails';
import { getFullQualifiedNamesForInventories, getShortFormatRentableItem } from '../helpers/inventory';
import { loadUserById, loadUsersByIds } from './users';
import { saveCommunicationAddedEvent, saveCommunicationCompletedEvent } from './partyEvent';
import { getPartyDataForInvite } from '../helpers/party';
import { createApplicationToken } from '../helpers/auth';
import { getOutgoingSourcePhoneNumber } from './telephony/outgoing';
import { getHoldingMusic } from './telephony/voiceMessages';
import { roundDateToThirtyMinutes } from '../../common/helpers/date-utils';
import { getContactEventTypes } from '../../common/helpers/contactEventTypes';
import { DATE_AND_TIME_US_FORMAT } from '../../common/date-constants';
import * as externalPhonesRepo from '../dal/externalPhonesRepo';
import { loadProgramForIncomingCommByTeamPropertyProgram } from '../dal/programsRepo';
import { getQuoteById } from '../dal/quoteRepo';
import { getFormattedSmsData } from './sms';
import { notifyCommunicationUpdate, notifyCommunicationsUpdate, getSMSNotificationMessage, getEmailNotificationMessage } from '../helpers/notifications';
import { renderTemplate } from './templates';
import { now, toMoment, formatMoment } from '../../common/helpers/moment-utils';
import { CommunicationContext, CommunicationContextError } from '../../common/enums/communicationTypes';
import { TemplateTypes } from '../../common/enums/templateTypes';
import { validateEmail } from '../../common/helpers/validations/email';
import { getApplyNowUrlForPublishedQuote } from '../helpers/quotes';
import { getTenant, getTenantSettings } from './tenantService';
import { handleCommsTemplateDataBindingErrors } from '../../common/helpers/mjml-helpers';
import eventTypes from '../../common/enums/eventTypes';
import { OperationResultType } from '../../common/enums/enumHelper';
import { notify, RESIDENTS } from '../../common/server/notificationClient';
import { getSmallAvatar, getBigLayoutImage, init as initCloudinaryHelpers } from '../../common/helpers/cloudinary';
import { formatEmployeeAssetUrl } from '../helpers/assets-helper';
import { execConcurrent } from '../../common/helpers/exec-concurrent';
import { partyWfStatesSubset } from '../../common/enums/partyTypes';
import { getUserFullNameById } from '../dal/usersRepo';
import { getCommonUserByPersonId } from '../../auth/server/dal/common-user-repo';
import { sendPushNotification } from '../../common/server/push-notifications';
import { truncateForPushNotificationBody } from '../../common/helpers/strings';
import { extractPostMessage } from './helpers/communicationHelpers';

const logger = loggerModule.child({ subType: 'services/communication' });

const addPostsToCommunications = async (ctx, comms = [], column, ids) => {
  const postsAsComms = await commsRepo.getPostsAsCommsByColumnAndIds(ctx, column, ids);

  const newThreadMap = new Map();

  postsAsComms.forEach(p => newThreadMap.set(p.persons.toString(), { threadId: getUUID() }));

  const enhancedPosts = await mapSeries(postsAsComms, async p => {
    const { threadId } =
      comms.find(c => c.type === DALTypes.CommunicationMessageType.DIRECT_MESSAGE && isEqual(sortBy(c.persons), sortBy(p.persons))) ||
      newThreadMap.get(p.persons.toString());
    const { post } = p.message;
    const { title, sentBy, metadata } = post;
    const fullName = await getUserFullNameById(ctx, sentBy);
    p.threadId = threadId;
    p.message = { title, text: extractPostMessage(post), from: { fullName, userId: sentBy }, metadata };

    return p;
  });
  const commsWithPosts = comms.concat(enhancedPosts);
  return commsWithPosts.sort((a, b) => toMoment(b.updated_at).diff(toMoment(a.updated_at)));
};

export const getCommunicationsByPartiesForCommsPanel = async (ctx, parties) => {
  const comms = await commsRepo.getCommunicationsByPartiesForCommsPanel(ctx, parties);
  return await addPostsToCommunications(ctx, comms, 'partyIds', parties);
};

export const loadCommunicationsByParties = async (ctx, parties) => {
  const comms = await commsRepo.loadCommunicationsByPartyIds(ctx, parties);
  return await addPostsToCommunications(ctx, comms, 'partyIds', parties);
};

export const loadCommunicationsByPersons = async (ctx, persons) => {
  const comms = await commsRepo.loadCommunicationsByPersonIds(ctx, persons);
  return await addPostsToCommunications(ctx, comms, 'personId', persons);
};

export const loadCommunicationsWithSourceByIdsForParties = async (ctx, parties, ids) =>
  commsRepo.loadCommunicationsWithSourceByIdsForParties(ctx, parties, ids);

export const loadCommunicationsByPerson = (ctx, personId) => commsRepo.loadCommunicationsByPersonIds(ctx, [personId]);

export const updateCommunicationEntriesByIds = async ({ ctx, ids, delta, shouldAddActivityLog = false }) => {
  const updatedComms = await commsRepo.updateCommunicationEntriesByIds(ctx, ids, delta);
  if (shouldAddActivityLog) await updatePartyActivity(ctx, updatedComms, getActivityLogDetailsForCommUpdate(delta));
  return updatedComms;
};

export const updateCommunicationEntryById = async ({ ctx, id, delta, shouldAddActivityLog = false }) => {
  const [updatedComm] = await updateCommunicationEntriesByIds({ ctx, ids: [id], delta, shouldAddActivityLog });
  return updatedComm;
};

export const updateCommunicationEntriesByMessageId = (ctx, messageId, delta) => commsRepo.updateMessages(ctx, { messageId }, delta);

const publishedQuoteEmailData = async (ctx, templateData) => {
  const templateDataLog = data =>
    pick(data, [
      'id',
      'partyId',
      'leaseStartDate',
      'quoteExpirationDate',
      'expirationDate',
      'confirmationNumber',
      'inventoryName',
      'propertyId',
      'propertyTimezone',
    ]);

  logger.debug({ ctx, templateData: templateDataLog(templateData) }, 'Generating data for emailed published quote');
  const propertyTimezone = templateData.propertyTimezone || templateData.flattenedInventory.timezone;

  if (now({ timezone: propertyTimezone }).isAfter(toMoment(templateData.expirationDate, { timezone: propertyTimezone }))) {
    throw new ServiceError({ token: 'QUOTE_HAS_EXPIRED', status: 400 });
  }

  templateData.emails.forEach(email => {
    const emailError = validateEmail(email);
    if (emailError !== '') {
      throw new ServiceError({
        token: emailError,
        status: 400,
      });
    }
  });
  if (!ctx.tenantDomain) {
    ctx = {
      ...ctx,
      tenantDomain: (ctx.authUser || {}).domain,
    };
  }

  const partyOwnerId = (ctx.authUser || {}).id;

  if (!partyOwnerId) {
    throw new Error('PartyOwnerId not found');
  }

  if (!ctx.tenantDomain) {
    throw new Error('Tenant Domain not found in ctx');
  }

  const longUrl = `https://${ctx.tenantDomain}/publishedQuote/${templateData.id}`;
  const personalizedData = getPersonalizedData(templateData.id, templateData.partyMembers, longUrl);
  const urlsWithToken = personalizedData.map(info =>
    addTokenToUrls(info.url, pick(info, ['quoteId', 'personId', 'personName']), true, { expiresIn: config.quote.tokenExpiration }),
  );

  const shortenedUrls = await sendUrltoShortener(ctx, urlsWithToken);
  const emailLink = { message: templateData.linkMessage };
  shortenedUrls.forEach(shortenedUrl => {
    emailLink.url = shortenedUrl;
  });

  const footerSettings = await getFooterSettings(ctx, templateData);

  const templatePath = config.mail.reactTemplate.quoteMail;
  const isCorporateParty = await isCorporateLeaseType(ctx, templateData.partyId);
  const applyNowUrl = await getApplyNowUrlForPublishedQuote(ctx, templateData);
  const contentForEmailCard = `<a href="${emailLink.url}" target="_blank" style="color:#2196f3;">${templateData.contentForComms.anchorText}</a>`;
  const partyOwnerImageUrl = await formatEmployeeAssetUrl(ctx, partyOwnerId);

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

  const mailInfo = {
    templatePath,
    emailLink,
    applyNowUrl,
    hideApplicationLink: isCorporateParty,
    contentForEmailCard,
    content: templateData.contentForComms.anchorText,
    leaseStartDate: templateData.leaseStartDate,
    quoteExpirationDate: templateData.quoteExpirationDate,
    flattenedInventory: {
      ...templateData.flattenedInventory,
      imageUrl: getBigLayoutImage(templateData.flattenedInventory.imageUrl),
    },
    flattenedLeaseTerms: templateData.flattenedLeaseTerms,
    leaseTermsLengthIsOdd: templateData.leaseTermsLengthIsOdd,
    confirmationNumber: templateData.confirmationNumber,
    policy: templateData.policy,
    contact: templateData.contact,
    paymentSchedule: templateData.paymentSchedule,
    isReactTemplate: !!templatePath,
    isHtmlContent: true,
    avatarUrl: getSmallAvatar(partyOwnerImageUrl, (ctx.authUser || {}).fullName),
    ...footerSettings,
    category: DALTypes.CommunicationCategory.QUOTE,
  };
  return mailInfo;
};

const getDataByTemplate = async (req, templateData) => {
  switch (templateData.templateName) {
    case DALTypes.TemplateNames.QUOTE:
      return await publishedQuoteEmailData(req, templateData);
    default:
      return null;
  }
};

const getEnvelopeEmails = async (ctx, { partyId, cInfosEntities, freeFormAddresses, emailSender, party }) => {
  logger.trace({ ctx, partyId, cInfosEntities, freeFormAddresses, emailSenderId: emailSender.id }, 'getEnvelopeEmails');
  const recipientsEmails = [...cInfosEntities.map(p => p.value), ...(freeFormAddresses || [])]; // spread of an object breaks in node@6.3
  if (recipientsEmails.length === 0) {
    throw new ServiceError('NO_EMAILS_FOR_RECIPIENTS');
  }

  const { from } = await generateTeamMail(ctx, {
    fromUser: emailSender,
    to: recipientsEmails[0],
    partyId,
  });

  const tenantName = emailSender.tenantName || ctx.tenantName;
  const emailDomain = utils.formatTenantEmailDomain(tenantName, config.mail.emailDomain);
  const replyTo = emailDomain ? `${party.emailIdentifier}@${emailDomain}` : null;

  return {
    from,
    replyTo,
    recipientsEmails,
  };
};

const getCommSender = async (ctx, { partyId }) => {
  const { sender, authUser } = ctx;
  const commSender = sender || (authUser && authUser.id ? authUser : null) || (await loadPartyAgent(ctx, partyId));

  if (!commSender.teams) {
    commSender.teams = await getTeamsForUser(ctx, commSender.id);
  }

  commSender.avatarUrl = getSmallAvatar(commSender.avatarUrl, commSender.fullName);
  logger.trace({ ctx, partyId, commSenderId: commSender.id }, 'getCommSender');

  return commSender;
};

export const addNewCommunication = async (ctx, messageEntity) => {
  const { message, ...rest } = messageEntity;
  const { html, ...messageWithoutHTML } = message || {};

  const messageEntityToLog = { ...rest, message: messageWithoutHTML };

  logger.trace({ ctx, messageEntity: messageEntityToLog }, 'addNewCommunication');
  const comm = await commsRepo.storeMessage(ctx, messageEntity);
  comm.unread &&
    !utils.isCommAnOutgoingDirectMessage(comm) &&
    (await mapSeries(comm.parties, async partyId => await commsRepo.saveUnreadCommunication(ctx, partyId, comm)));

  return comm;
};

const getTeamId = (party, teams) => {
  if (party?.ownerTeam) return party?.ownerTeam;

  const team = teams.find(t => party.teamsAllowedToModify.includes(t.id));
  if (team) return team.id;

  return teams[0]?.id;
};

const sendEmail = async (ctx, { emailData, cInfosEntities, requestQuote = false, templateArgs = {} }) => {
  const {
    recipients = {},
    message = {},
    inReplyTo,
    html,
    isHtmlContent,
    contentForEmailCard,
    category,
    templateData = {},
    partyId: partyIdFromBody,
    messageType,
    shouldNotNotifyMailSent,
  } = emailData;

  logger.info({ ctx, inReplyTo, partyId: emailData.partyId }, 'sendEmail - started!');

  const partyId = templateData?.partyId || partyIdFromBody;
  const emailSender = await getCommSender(ctx, { partyId });
  const { freeFormAddresses = [] } = recipients;

  const { files = [], subject, content } = message;

  const persons = await contactInfoRepo.getPersonIdsForContacts(
    ctx,
    cInfosEntities.map(p => p.id),
  );

  const party = await loadParty(ctx, partyId);
  const partyCollaboratorsIncludingOwner = [party.userId, ...party.collaborators];
  const teamsForUsers = (await getTeamsForUsers(ctx, partyCollaboratorsIncludingOwner)) || [];
  party.teamsAllowedToModify = teamsForUsers.map(t => t.id);

  const messageFrom = 'Message from';

  const { from, replyTo, recipientsEmails } = await getEnvelopeEmails(ctx, { partyId, cInfosEntities, freeFormAddresses, emailSender, party });
  const notificationMessage = getEmailNotificationMessage(messageType, category, party.workflowName);

  logger.trace({ ctx, partyId, messageType, category, partyWorkflow: party.workflowName, notificationMessage }, 'getEmailNotificationMessage - completed');
  const emailMessage = {
    text: content,
    subject: subject || `${messageFrom} ${emailSender.fullName}`,
    from,
    replyTo,
    to: recipientsEmails,
    unread: !!message.unread,
    html,
    isHtmlContent,
    notificationMessage,
    contentForEmailCard,
    files,
    requestQuote,
  };

  const threadId = inReplyTo ? (await commsRepo.getCommunicationByMessageId(ctx, inReplyTo)).threadId : getUUID();
  if (inReplyTo) {
    emailMessage.inReplyTo = inReplyTo;
  }
  const { teams } = emailSender;

  const teamId = getTeamId(party, teams);
  const statusMap = recipientsEmails.map(p => ({
    address: p,
    status: DALTypes.CommunicationStatus.PENDING,
  }));

  const quoteId = templateArgs?.quoteId;
  if (quoteId) {
    emailMessage.quoteId = quoteId;
  }

  const userId = emailSender.id;
  const messageEntity = {
    message: emailMessage,
    type: DALTypes.CommunicationMessageType.EMAIL,
    parties: [partyId],
    userId,
    direction: DALTypes.CommunicationDirection.OUT,
    unread: false,
    persons,
    status: { status: statusMap },
    threadId,
    teams: [teamId],
    category: category || DALTypes.CommunicationCategory.USER_COMMUNICATION,
    partyOwner: party.userId,
    partyOwnerTeam: party.ownerTeam,
  };

  const res = await addNewCommunication(ctx, messageEntity);

  const tenant = await getTenant(ctx);
  const communicationOverrides = tenant.settings && tenant.settings.communicationOverrides;

  await sendMessage({
    exchange: APP_EXCHANGE,
    key: COMM_MESSAGE_TYPE.OUTBOUND_EMAIL,
    message: {
      message: emailMessage,
      entityId: res.id,
      partyId,
      userId,
      communicationOverrides,
      noNotifySentMail: !!shouldNotNotifyMailSent,
    },
    ctx,
  });
  logger.info({ ctx, partyId, communicationId: res.id }, 'sendEmail - completed!');

  return res;
};

const sendSms = async (req, cInfosEntities, sourcePhoneNo, templateArgs = {}) => {
  const ctx = req;
  const { message, partyId, quote, templateData, threadId, messageType, communicationCategory, skipSMSNotify } = req.body;
  const { content } = message;
  logger.info({ ctx, sourcePhoneNo, messageType, partyId }, 'sendSms - started!');

  const recipientsSms = cInfosEntities.map(p => p.value);
  if (recipientsSms.length === 0) {
    throw new ServiceError('NO_PHONE_NUMBERS_FOR_RECIPIENTS');
  }

  const party = await loadParty(ctx, partyId);
  const activeParties = await getActivePartiesByPartyGroupId(ctx, party.partyGroupId);
  const smsSender = await getCommSender(ctx, { partyId });
  const partyCollaboratorsIncludingOwner = [party.userId, ...party.collaborators];
  const teamsForUsers = (await getTeamsForUsers(ctx, partyCollaboratorsIncludingOwner)) || [];
  party.teamsAllowedToModify = teamsForUsers.map(t => t.id);

  // transform template
  const template = content.replace('[ Quote link ]', '{shortenedUrl}');

  if (templateData) {
    const { quoteId } = templateData.commonData;
    const longUrl = `${ctx.authUser.protocol}://${ctx.authUser.domain}/publishedQuote/${quoteId}`;
    templateData.personalizedData = getPersonalizedData(quoteId, templateData.recipients, longUrl, ctx.tenantId);
    const urlsWithToken = templateData.personalizedData.map(info =>
      addTokenToUrls(info.url, pick(info, ['quoteId', 'personId', 'personName', 'tenantId']), true, { expiresIn: config.quote.tokenExpiration }),
    );
    const shortenedUrls = await sendUrltoShortener(ctx, urlsWithToken);

    for (let i = 0; i < shortenedUrls.length; i++) {
      templateData.personalizedData[i].shortenedUrl = shortenedUrls[i];
    }
  }
  const templatedText =
    templateData &&
    cInfosEntities.length === 1 &&
    utils.replaceTemplatedValues(
      template,
      templateData.personalizedData.find(t => t.personId === cInfosEntities[0].personId),
    );
  const text = templatedText || content;

  const smsMessage = {
    text,
    from: sourcePhoneNo,
    to: recipientsSms,
    rasaConversationId: message.rasaConversationId,
  };
  const statusMap = recipientsSms.map(p => ({
    address: p,
    status: DALTypes.CommunicationStatus.PENDING,
  }));

  const { teams } = smsSender;

  const teamId = getTeamId(party, teams);

  const quoteId = templateArgs?.quoteId;
  if (quoteId) {
    smsMessage.quoteId = quoteId;
  }

  const partyIdsForComm = uniq([...activeParties.map(p => p.id), partyId]);

  const messageEntity = {
    message: { ...smsMessage, text },
    unread: false,
    type: DALTypes.CommunicationMessageType.SMS,
    parties: partyIdsForComm,
    userId: ctx?.authUser?.id || ctx?.sender?.id,
    direction: DALTypes.CommunicationDirection.OUT,
    persons: cInfosEntities.map(p => p.personId),
    status: { status: statusMap },
    category: communicationCategory || DALTypes.CommunicationCategory.USER_COMMUNICATION,
    threadId,
    teams: [teamId],
    partyOwner: party.userId,
    partyOwnerTeam: party.ownerTeam,
  };
  const res = await addNewCommunication(ctx, messageEntity);

  const tenantSettings = await getTenantSettings(ctx);

  const communicationOverrides = tenantSettings?.communicationOverrides;
  const notificationMessage = getSMSNotificationMessage(messageType, communicationCategory, party.workflowName);
  logger.trace(
    { ctx, partyId, messageType, communicationCategory, partyWorkflow: party.workflowName, notificationMessage },
    'getSMSNotificationMessage - completed',
  );

  await sendMessage({
    exchange: APP_EXCHANGE,
    key: COMM_MESSAGE_TYPE.OUTBOUND_SMS,
    message: {
      message: smsMessage,
      entityId: res?.id,
      tenantId: ctx.tenantId,
      userId: ctx?.authUser?.id || ctx?.sender?.id,
      tenantName: ctx.tenantName,
      sourcePhoneNo,
      partyId,
      notificationMessage,
      skipSMSNotify,
      customerPhoneOverride: communicationOverrides && communicationOverrides.customerPhone,
    },
    ctx,
  });
  if (quote) {
    // This means that is sending a quote
    quote.partyId = partyId;
    quote.unitShortHand = await getShortFormatRentableItem(ctx, quote.inventoryId);
    await logEntity(ctx, { entity: quote, activityType: ACTIVITY_TYPES.TEXT, component: COMPONENT_TYPES.QUOTE });
  }
  logger.info({ ctx, communicationId: res?.id, sourcePhoneNo, partyId, recipientsSms }, 'sendSms - completed!');

  return res;
};

const getEmailData = (reqBody, data, html, isHtmlContent, contentForEmailCard) => ({
  ...reqBody,
  text: reqBody.message.content || (data && data.content),
  html,
  isHtmlContent,
  contentForEmailCard,
  category: data.category,
});

const shouldSendToEachRecipient = templateName => {
  switch (templateName) {
    case DALTypes.TemplateNames.QUOTE:
    case DALTypes.TemplateNames.DECLINED_APPLICATION:
      return true;
    default:
      return false;
  }
};

const getEmailHtml = async data => {
  if (data.isReactTemplate) return await getEmailHtmlWithReact(data);
  return await getInlinedEmailHtml(data);
};

/*
  cInfo has the communication info use to send the emails e.g.
  cInfo = {
    created_at: 2016-12-12T22:12:23.652Z,
    updated_at: 2016-12-12T22:12:23.652Z,
    id: 'a5ddcf1e-1046-4e43-8287-bcd3aad9ee69',
    type: 'email',
    value: 'email@reva.tech',
    imported: false,
    metadata: {},
    personId: '94427591-7ef0-43e3-be16-def77f21dce2',
    isSpam: false,
    markedAsSpamBy: null
  }
*/
const sendIndividualQuoteEmail = async (ctx, { authUser, reqBody, cInfo, requestQuote }) => {
  const {
    templateData,
    templateData: { partyMembers },
  } = reqBody;

  const partyMember =
    partyMembers && partyMembers.find(member => (cInfo.personId ? member.personId === cInfo.personId : member.person.contactInfo.defaultEmailId === cInfo.id));

  if (!partyMember) return undefined;

  const singlePersonData = {
    ...templateData,
    partyMembers: [partyMember],
  };
  if (authUser) {
    ctx = {
      ...ctx,
      authUser,
    };
  }
  const data = await getDataByTemplate(ctx, singlePersonData);
  const html = data && (await getEmailHtml(data));
  const isHtmlContent = !!data.isHtmlContent;
  const contentForEmailCard = data.contentForEmailCard;
  const emailData = getEmailData(reqBody, data, html, isHtmlContent, contentForEmailCard);
  return sendEmail(ctx, { authUser, emailData, cInfosEntities: [cInfo], requestQuote });
};

const addEmailCommunication = async req => {
  const { recipients, templateData } = req.body;
  const { contactInfos } = recipients;
  const cInfosEntities = await contactInfoRepo.getContactInfoByIds(req, contactInfos);

  const useInlineEmail = !templateData && req.body?.isHtmlContent && req.body?.html;
  if (useInlineEmail) {
    req.body.html = await inlineEmail(req.body.html);
  }

  if (!templateData) return [await sendEmail(req, { authUser: req.authUser, emailData: req.body, cInfosEntities })];

  const shouldSendEachRecipient = shouldSendToEachRecipient(templateData.templateName);

  if (shouldSendEachRecipient) {
    return await mapSeries(cInfosEntities, async cInfo =>
      sendIndividualQuoteEmail(req, { authUser: req.authUser, reqBody: req.body, cInfo, requestQuote: false }),
    );
  }

  const data = await getDataByTemplate(req, templateData);
  const html = data && (await getEmailHtml(data));
  const isHtmlContent = !!data.isHtmlContent;
  const contentForEmailCard = data.contentForEmailCard;
  const emailData = getEmailData(req.body, data, html, isHtmlContent, contentForEmailCard);
  return [await sendEmail(req, { authUser: req.authUser, emailData, cInfosEntities })];
};

const addSmsCommunication = async req => {
  const ctx = req;
  const { recipients, templateData, partyId } = req.body;
  const { contactInfos } = recipients;
  const cInfosEntities = await contactInfoRepo.getExtendedContactInfoByIds(ctx, contactInfos);

  const sourcePhoneNo = await getOutgoingSourcePhoneNumber({ ctx, partyId });

  if (templateData) {
    return await execConcurrent(cInfosEntities, async e => await sendSms(req, [e], sourcePhoneNo));
  }

  return [await sendSms(req, cInfosEntities, sourcePhoneNo)];
};

const addQuoteCommActivityLog = async (ctx, { quoteId, partyId, comm, guests }) => {
  const { inventory, leaseState } = await getQuoteById(ctx, quoteId);
  const unitShortHand = getUnitShortHand(inventory);
  const subComponentType = leaseState === DALTypes.LeaseState.NEW ? SUB_COMPONENT_TYPES.QUOTE : SUB_COMPONENT_TYPES.RENEWAL_LETTER;

  await logEntity(ctx, {
    entity: { partyId, id: comm.id, to: [guests], quoteId, unitShortHand, leaseState },
    activityType: ACTIVITY_TYPES.NEW,
    component: getComponentTypeForComm(comm.type),
    subComponent: subComponentType,
  });
};

const addCommToActivityLog = async (ctx, { partyId, comm, person, templateArgs }) => {
  const guests = getDisplayName(person);
  const { quoteId } = templateArgs;
  if (quoteId) {
    await addQuoteCommActivityLog(ctx, { quoteId, partyId, comm, guests });
  } else {
    await logEntity(ctx, { entity: { partyId, id: comm.id, to: [guests] }, activityType: ACTIVITY_TYPES.NEW, component: getComponentTypeForComm(comm.type) });
  }
};

const enhanceDirectMessages = async (ctx, person, messages, propertyId) => {
  const userIds = uniq(messages.map(msg => msg.userId));
  const users = await loadUsersByIds(ctx, userIds);
  const usersMap = users.reduce((acc, u) => {
    acc[u.id] = u.fullName;
    return acc;
  }, {});

  return messages.map(msg => ({
    id: msg.id,
    author: msg.userId ? usersMap[msg.userId] : person.fullName,
    message: msg.message.text,
    direction: msg.direction,
    threadId: msg.threadId,
    createdAt: msg.created_at,
    unread: msg.unread,
    propertyId,
  }));
};

const sendDirectMessageNotification = async (ctx, party, comm, contactInfoEntities, commonUser, personId) => {
  logger.trace({ ctx, partyId: party.id, commId: comm.id, contactInfoEntities, commonUser, personId }, 'sendDirectMessageNotification');

  const hasDMNotificationToday = personId && party.assignedPropertyId && (await commsRepo.personWasNotifiedToday(ctx, personId, party.assignedPropertyId));

  if (hasDMNotificationToday) {
    logger.trace({ ctx, personId }, 'Person was already notified today. Skipping notification.');
    return;
  }

  const primaryContactInfo = contactInfoEntities.find(ci => ci.type === DALTypes.ContactInfoType.EMAIL && ci.isPrimary);
  const directMessageNotification = {
    emailAddress: commonUser ? commonUser.email : primaryContactInfo?.value,
    fullName: commonUser ? commonUser.fullName : primaryContactInfo?.fullName,
    communicationId: comm?.id,
    partyId: party.id,
    personId,
    propertyId: party.assignedPropertyId,
    commonUserId: commonUser?.id,
  };

  await sendMessage({
    exchange: APP_EXCHANGE,
    key: COMM_MESSAGE_TYPE.OUTBOUND_DIRECT_MESSAGE,
    message: {
      directMessageNotification,
      tenantId: ctx.tenantId,
      tenantName: ctx.tenantName,
    },
    ctx,
  });
};

const addDirectMessageCommunication = async req => {
  logger.trace({ ctx: req }, 'addDirectMessageCommunication');
  const ctx = req;
  const { message, partyId, threadId, recipients } = req.body;

  const { contactInfos } = recipients;
  const cInfosEntities = await contactInfoRepo.getContactsInfoByEmail(ctx, contactInfos[0]);
  const { content } = message;
  const commSender = await getCommSender(ctx, { partyId });
  const recipientsDirectMessage = [...new Set(cInfosEntities.map(p => p.personId))];

  if (recipientsDirectMessage.length === 0) {
    throw new ServiceError('NO_RECIPIENTS_FOR_DIRECT_MESSAGE');
  }

  const party = await loadParty(ctx, partyId);
  const partyCollaboratorsIncludingOwner = [party.userId, ...party.collaborators];
  const teamsForUsers = (await getTeamsForUsers(ctx, partyCollaboratorsIncludingOwner)) || [];
  party.teamsAllowedToModify = teamsForUsers.map(t => t.id);

  const directMessage = {
    text: content,
    from: { userId: commSender.id, fullName: commSender.fullName },
    to: cInfosEntities.map(e => ({ personId: e.personId, fullName: e.fullName })),
  };

  const statusMap = recipientsDirectMessage.map(p => ({
    address: p.id,
    status: DALTypes.CommunicationStatus.PENDING,
  }));

  const { teams } = commSender;

  const teamId = getTeamId(party, teams);

  const messageEntity = {
    message: directMessage,
    unread: true,
    type: DALTypes.CommunicationMessageType.DIRECT_MESSAGE,
    parties: [partyId],
    userId: ctx?.authUser?.id || req?.sender?.id,
    direction: DALTypes.CommunicationDirection.OUT,
    persons: recipientsDirectMessage,
    status: { status: statusMap },
    category: DALTypes.CommunicationCategory.USER_COMMUNICATION,
    threadId,
    teams: [teamId],
    messageId: getUUID(),
    partyOwner: party.userId,
    partyOwnerTeam: party.ownerTeam,
  };
  const comm = await addNewCommunication(ctx, messageEntity);

  const [enhancedMessage] = await enhanceDirectMessages(ctx, recipientsDirectMessage[0], [comm], party.assignedPropertyId);
  const commonUser = await getCommonUserByPersonId(ctx, recipientsDirectMessage[0]);

  await sendDirectMessageNotification(ctx, party, comm, cInfosEntities, commonUser, recipientsDirectMessage[0]);

  notify({
    ctx,
    event: eventTypes.DIRECT_MESSAGE_SENT,
    data: {
      type: OperationResultType.SUCCESS,
      ids: [comm.id],
      userId: (ctx.sender || ctx.authUser).id,
      partyId,
      persons: flatten(recipientsDirectMessage),
    },
    routing: { teams: party.teams },
  });

  if (commonUser) {
    notify({
      ctx: { tenantId: RESIDENTS, trx: ctx.trx },
      event: eventTypes.DIRECT_MESSAGE_TO_RXP,
      data: { message: enhancedMessage },
      routing: { users: [commonUser.id], shouldFallbackToBroadcast: false },
    });

    sendPushNotification(
      ctx,
      {
        body: truncateForPushNotificationBody(enhancedMessage.message),
        title: enhancedMessage.author,
        data: {
          event: eventTypes.DIRECT_MESSAGE_TO_RXP,
          message: enhancedMessage,
          id: enhancedMessage.id,
        },
      },
      [commonUser.id],
    );
  }

  return [comm];
};

const addContactEvent = async req => {
  const ctx = req;
  const { type, category, recipients, partyId, message, threadId, contactEventType, names } = req.body;

  const party = await loadParty(ctx, partyId);

  const messageEntity = {
    message, // TODO: validate the fields allowed to be saved for entity to ignore fields send by mistake
    type,
    parties: [partyId],
    userId: (ctx.authUser || {}).id,
    direction: DALTypes.CommunicationDirection.IN,
    persons: recipients,
    messageId: getUUID(),
    threadId: threadId || getUUID(),
    category: category || DALTypes.CommunicationCategory.USER_COMMUNICATION,
    partyOwner: party.userId,
    partyOwnerTeam: party.ownerTeam,
  };

  const timezone = await getTimezoneForParty(ctx, partyId);

  const result = threadId ? await commsRepo.updateMessages(ctx, { threadId }, messageEntity) : [await addNewCommunication(ctx, messageEntity)];
  const communicationId = result[0]?.id;
  await saveCommunicationCompletedEvent(ctx, { partyId, metadata: { communicationId } });
  const activityType = threadId ? ACTIVITY_TYPES.UPDATE : ACTIVITY_TYPES.NEW;
  const logEntry = {
    partyId,
    id: communicationId,
    participants: names,
    type: contactEventType,
    date: message.eventDateTime ? formatMoment(message.eventDateTime, { timezone, format: DATE_AND_TIME_US_FORMAT }) : `${message.eventDate} ${message.time}`,
    notes: message.text,
  };
  await logEntity(ctx, { entity: logEntry, activityType, component: COMPONENT_TYPES.CONTACT_EVENT });
  return result;
};

export const addCommunication = async req => {
  const communicationLog = reqBody =>
    pick(reqBody, [
      'message.notificationMessage',
      'message.subject',
      'partyId',
      'templateData.emails',
      'templateData.id',
      'templateData.partyId',
      'templateData.leaseStartDate',
      'templateData.quoteExpirationDate',
      'templateData.expirationDate',
      'templateData.confirmationNumber',
      'templateData.inventoryName',
      'templateData.propertyId',
    ]);

  logger.trace({ ctx: req, body: communicationLog(req.body) }, 'addCommunication');
  let comms;
  switch (req.body.type) {
    case DALTypes.CommunicationMessageType.EMAIL:
      comms = await addEmailCommunication(req);
      break;
    case DALTypes.CommunicationMessageType.SMS:
      comms = await addSmsCommunication(req);
      break;
    case DALTypes.CommunicationMessageType.CONTACTEVENT:
      comms = await addContactEvent(req);
      break;
    case DALTypes.CommunicationMessageType.DIRECT_MESSAGE:
      comms = await addDirectMessageCommunication(req);
      break;
    default:
      logger.error({ ctx: req, communicationType: req.body.type }, 'Invalid communication type');
      throw new ServiceError('INVALID_COMMUNICATION_TYPE');
  }

  comms = comms.filter(comm => comm && Object.keys(comm).length);
  const partyIds = flatten(comms.map(comm => comm.parties));
  const tenantCtx = { tenantId: req.tenantId };
  await sendMessageToCompleteFollowupPartyTasks(tenantCtx, partyIds);
  await updatePartyActivity(req, comms, getActivityLogDetailsForNewComm);

  const { partyId } = req.body;
  const communicationId = comms && comms.length && comms[0].id;
  await saveCommunicationAddedEvent(req, { partyId, metadata: { communicationId } });

  return comms;
};

export const storeCommunicationDraft = async req => {
  const { draft } = req.body;
  if (!draft) return;

  const { contactInfos } = draft.recipients;
  if (!contactInfos) return;

  const persons = await contactInfoRepo.getPersonIdsForContacts(req, contactInfos);
  await commsRepo.storeDraft(req, { persons, ...draft });
};

export const getDraftsForUserAndParty = async req => {
  const { userId, partyId } = req.params;
  return await commsRepo.getDraftsForUserAndParty(req, userId, partyId);
};

export const deleteDraftById = async req => {
  const { draftId } = req.params;
  await commsRepo.deleteDraftById(req, draftId);
};

export const transferCall = async (ctx, id, to) => {
  logger.trace({ ctx, commId: id, transferCallTo: to }, 'transferCall');
  const comm = await commsRepo.loadMessageById(ctx, id);
  const { messageId: callId, direction, parties } = comm;

  const transferParams = {
    ctx,
    callId,
    direction,
    to,
    from: ctx.authUser.id,
    comm,
    parties,
  };

  await telephony.transferCall(transferParams);
};

export const stopRecording = async (ctx, commEntry) => {
  logger.trace({ ctx, commEntry }, 'stopRecording');
  await telephony.stopRecording(ctx, commEntry.messageId);

  const [updated] = await commsRepo.updateMessages(
    ctx,
    { id: commEntry.id },
    {
      message: {
        recordingUrl: '',
        recordingId: '',
        recordingDuration: '',
        isRecorded: false,
        recordingWasRemoved: true,
      },
    },
  );

  return updated;
};

export const holdCall = async (ctx, commEntry) => {
  logger.trace({ ctx, commEntry }, 'holdCall');
  const [teamId] = commEntry.teams;

  const holdingMusic = await getHoldingMusic(ctx, { teamId });
  const holdingMusicUrl = `${config.telephony.audioAssetsUrl}/${holdingMusic}`;

  const legs = commEntry.direction === DALTypes.CommunicationDirection.IN ? 'aleg' : 'bleg';
  await telephony.holdCall(ctx, commEntry.messageId, holdingMusicUrl, legs);

  const holdStartTime = now({ timezone: 'UTC' }).toISOString();
  return await saveCallDetails(ctx, { commId: commEntry.id, details: { holdStartTime } });
};

export const unholdCall = async (ctx, commEntry) => {
  logger.trace({ ctx, commEntry }, 'unholdCall');
  await telephony.unholdCall(ctx, commEntry.messageId);

  const holdEndTime = now({ timezone: 'UTC' }).toISOString();

  const holdCallDetails = await getCallDetailsByCommId(ctx, commEntry.id);
  const { holdStartTime = '' } = holdCallDetails?.details || {};
  const seconds = holdStartTime && toMoment(holdEndTime).diff(toMoment(holdStartTime), 'seconds');

  return await saveCallDetails(ctx, { commId: commEntry.id, details: { holdEndTime, holdDuration: seconds } });
};

const getSmsTemplateData = async (ctx, smsInfo) => {
  const { contactInfo, member = {}, applicationToken, tenantDomain, propertyId } = smsInfo;
  const baseUrl = resolveSubdomainURL(`https://${tenantDomain}/welcome/`, config.rentapp.hostname);
  const rentalAppUrl = `${baseUrl}${applicationToken}`;
  const [shortenedUrl] = await sendUrltoShortener(ctx, [rentalAppUrl]);
  const property = await getProperty(ctx, propertyId);

  const templateData = {
    templateName: config.smsTemplateNameMap.applicationInvitationSmsTemplate,
    data: {
      preferredName: getDisplayName(member, { usePreferred: true, ignoreContactInfo: true }),
      url: shortenedUrl,
      propertyName: property.displayName || 'our property',
    },
  };
  const text = await fillSmsTemplate(templateData);
  return {
    to: [contactInfo.value],
    text,
  };
};

const sendApplicationMail = async (ctx, { tenantDomain, partyId, propertyId, contactInfo, memberId, userId }) => {
  const result = await sendApplicationInvitationMail(ctx, {
    tenantDomain,
    partyId,
    propertyId,
    invites: [{ email: contactInfo.value, memberId }],
  });

  const { fullName, value: email } = contactInfo;
  await logEntity(
    { ...ctx, authUser: { id: userId } },
    { entity: { memberName: fullName || email, partyId }, activityType: ACTIVITY_TYPES.EMAIL, component: COMPONENT_TYPES.APPLICATION },
  );

  return result;
};

const sendApplicationSms = async (ctx, { tenantDomain, partyId, propertyId, contactInfo, memberId, userId, personIds = [] }) => {
  const { tenant, leasingAgent, partyMembers } = await getPartyDataForInvite(ctx, { partyId, propertyId, userId });

  const applicationToken = await createApplicationToken({ ...ctx, hostname: tenantDomain }, { partyId, memberId, propertyId });
  const message = await getSmsTemplateData(ctx, {
    contactInfo,
    member: partyMembers.find(pm => pm.id === memberId),
    applicationToken,
    tenantDomain,
    propertyId,
  });

  const persons = personIds.length ? personIds : await contactInfoRepo.getPersonIdsForContacts(ctx, [contactInfo.id]);

  const messageEntity = {
    message,
    unread: false,
    type: DALTypes.CommunicationMessageType.SMS,
    parties: [partyId],
    userId: leasingAgent.id,
    direction: DALTypes.CommunicationDirection.OUT,
    persons,
    status: {
      status: [{ address: message.to, status: DALTypes.CommunicationStatus.PENDING }],
    },
    category: DALTypes.CommunicationCategory.APPLICATION_INVITE,
  };

  const res = addNewCommunication(ctx, messageEntity);
  const smsData = await getFormattedSmsData(ctx, {
    message,
    tenantName: tenant.name,
    partyId,
    entityId: res.id,
  });

  await logEntity(
    { ...ctx, authUser: { id: userId } },
    { entity: { memberName: contactInfo.fullName, partyId }, activityType: ACTIVITY_TYPES.TEXT, component: COMPONENT_TYPES.APPLICATION },
  );
  const result = await sendMessage({
    exchange: APP_EXCHANGE,
    key: COMM_MESSAGE_TYPE.OUTBOUND_APPLICATION_INVITATION_SMS,
    message: smsData,
    ctx,
  });
  await notifyCommunicationUpdate(ctx, res);

  return result;
};

const applicationCommTypeMapping = {
  [DALTypes.ContactInfoType.EMAIL]: sendApplicationMail,
  [DALTypes.ContactInfoType.PHONE]: sendApplicationSms,
};

const sendApplicationByCommType = async (ctx, type, data) => {
  const sendApplication = applicationCommTypeMapping[type];
  if (!sendApplication) {
    logger.error({ ctx, type }, 'Invalid contact info type');
    throw new ServiceError('CONTACT_INFO_TYPE_NOT_RECOGNIZED');
  }
  return await sendApplication(ctx, data);
};

export const sendApplicationLinkToContact = async (ctx, data) => {
  logger.trace(
    {
      ctx,
      ...data,
    },
    'sendApplicationLinkToContact',
  );

  const { contactInfo } = data;
  if (Array.isArray(contactInfo)) {
    return await mapSeries(contactInfo, async info => await sendApplicationByCommType(ctx, info.type, { ...data, contactInfo: info }));
  }

  return sendApplicationByCommType(ctx, contactInfo.type, data);
};

export const getInfoForIncomingCall = async (ctx, commId) => {
  logger.trace({ ctx, commId }, 'getInfoForIncomingCall');
  const comm = await commsRepo.loadMessageById(ctx, commId);
  const person = await getPersonById(ctx, comm.persons[0]);
  const party = await loadParty(ctx, comm.parties[0]);
  const program = comm.teamPropertyProgramId && (await loadProgramForIncomingCommByTeamPropertyProgram(ctx, comm.teamPropertyProgramId));

  let propertyName;
  if (party.assignedPropertyId) {
    const property = await getProperty(ctx, party.assignedPropertyId);
    propertyName = property.displayName;
  }

  const user = party.userId && (await loadUserById(ctx, party.userId));
  const transferredFromUser = (comm.message.transferredFrom && (await loadUserById(ctx, comm.message.transferredFrom))) || {};

  const units = (await getFullQualifiedNamesForInventories(ctx, party.metadata.favoriteUnits || [])).map(u => u.fullQualifiedName);

  const { fullName, preferredName, contactInfo } = person;
  const { score, state } = party;
  const { defaultEmail, defaultPhone } = contactInfo;

  return {
    fullName,
    preferredName,
    contactInfo: { defaultEmail, defaultPhone },
    score,
    state,
    propertyName,
    programName: program && program.displayName,
    targetName: comm.message.targetName,
    units,
    owner: user && user.fullName,
    partyId: party.id,
    transferredFromName: transferredFromUser.fullName,
    transferredFromAvatar: transferredFromUser.avatarUrl,
  };
};

export const getCommunication = async (ctx, commId) => {
  logger.trace({ ctx, commId }, 'getCommunication');
  const comm = await commsRepo.loadMessageById(ctx, commId);
  return comm;
};

export const getDataForActiveCall = async (ctx, commId) => {
  logger.trace({ ctx, commId }, 'getDataForActiveCall');
  const communication = await commsRepo.loadMessageById(ctx, commId);
  const parties = await loadParties(ctx, partyWfStatesSubset.all, q => q.whereIn('Party.id', communication.parties));
  const person = await getPersonById(ctx, communication.persons[0]);
  const { fullName, preferredName, contactInfo } = person;
  const { defaultEmail, defaultPhone } = contactInfo;
  const { score } = parties[0];

  return {
    contact: {
      fullName,
      preferredName,
      contactInfo: { defaultEmail, defaultPhone },
      score,
    },
    communication,
    parties,
  };
};

export const getExternalPhones = async ctx => {
  logger.trace({ ctx }, 'getExternalPhones');
  return await externalPhonesRepo.getExternalPhones(ctx);
};

const sortCallsMindingTransfers = calls => {
  const callIds = new Set(calls.map(c => c.id));
  const [transferredCalls, directCalls] = partition(calls, c => callIds.has(c.transferredFromCommId));

  const sortedDirectCalls = sortBy(directCalls, c => toMoment(c.created_at).utc());

  const findTransfers = lastCall => {
    const nextTransfer = transferredCalls.find(c => c.transferredFromCommId === lastCall.id);
    if (!nextTransfer) return [lastCall];

    return [lastCall, ...findTransfers(nextTransfer)];
  };

  return sortedDirectCalls.reduce((cs, call) => [...cs, ...findTransfers(call)], []);
};

export const getDataForInactiveCall = async (ctx, threadId, partyId, personId) => {
  logger.trace({ ctx, threadId, partyId, personId }, 'getDataForInactiveCall');

  try {
    let comms = await commsRepo.loadCommsByThreadId(ctx, threadId);
    comms = partyId ? comms.filter(c => c.parties.includes(partyId)) : comms;
    comms = personId ? comms.filter(c => c.persons.includes(personId)) : comms;

    if (comms.length === 0) {
      logger.trace(
        {
          ctx,
          authUserId: ctx.authUser.id,
          threadId,
          partyId,
          personId,
        },
        'getDataForInactiveCall: there are no communications',
      );

      return {
        communications: [],
        parties: [],
        person: [],
      };
    }

    const sortedCalls = sortCallsMindingTransfers(comms);
    const lastComm = sortedCalls[sortedCalls.length - 1];
    const personIdsFromPartyMember = partyId ? await getPersonIdsbyPartyIds(ctx, [partyId]) : [];
    const commPersonIds = intersection(lastComm.persons, personIdsFromPartyMember);
    const fallbackPersonId = lastComm.persons[0];
    const commPersonsIdsForCurrentParty = personId ? [personId] : (commPersonIds.length && commPersonIds) || [fallbackPersonId];
    return {
      communications: sortedCalls,
      parties: await loadParties(ctx, partyWfStatesSubset.all, q => q.whereIn('Party.id', lastComm.parties)),
      person: await getPersonsByIds(ctx, commPersonsIdsForCurrentParty),
    };
  } catch (error) {
    logger.error({ ctx, threadId, partyId, personId, error }, 'Error in getDataForInactiveCall');
    throw error;
  }
};

export const getLastCommunicationInThread = async (ctx, threadId) => {
  logger.trace({ ctx, threadId }, 'getCommsByThreadId');
  const comms = await commsRepo.loadCommsByThreadId(ctx, threadId);
  const sortedCalls = sortCallsMindingTransfers(comms);
  return sortedCalls[sortedCalls.length - 1];
};

export const getContactEventsByPartyAndFilter = async (ctx, partyId, filters = {}) => await commsRepo.getContactEventsByPartyAndFilter(ctx, partyId, filters);

export const addPartyContactEvent = async (req, party) => {
  logger.trace({ ctx: req, partyId: party?.id }, 'addPartyContactEvent');
  const partyContactEvents = await getContactEventsByPartyAndFilter(req, party.id);
  const shouldAddContactEvent =
    party.metadata && party.metadata.creationType === DALTypes.PartyCreationTypes.USER && !partyContactEvents.length && party.metadata.firstContactChannel;

  if (!shouldAddContactEvent) return;

  const partyTimezone = await getTimezoneForParty(req, party.id);
  const eventType = party.metadata && party.metadata.firstContactChannel;
  const date = toMoment(party.created_at, { timezone: partyTimezone });
  const roundedDate = roundDateToThirtyMinutes(date, partyTimezone);

  const commReqBody = {
    type: DALTypes.CommunicationMessageType.CONTACTEVENT,
    recipients: party.partyMembers.map(member => member.personId),
    partyId: party.id,
    message: {
      text: '',
      type: eventType,
      eventDateTime: roundedDate.toJSON(),
    },
    contactEventType: (getContactEventTypes().find(e => e.id === eventType) || {}).text,
    names: party.partyMembers.map(member => member.fullName).join(','),
  };
  await addCommunication({ ...req, body: commReqBody });
};

export const getCommsToMarkAsRead = async (ctx, communicationIds, userId) => {
  const comms = await commsRepo.getCommunicationsByIds(ctx, communicationIds);
  const partiesForComms = flatten(comms.map(comm => comm.parties));
  const ownersForParties = await getOwnersForParties(ctx, [...new Set(partiesForComms)]);
  const userParties = new Set(ownersForParties.filter(item => item.userId === userId).map(item => item.id));
  return comms.filter(comm => comm.parties.some(partyId => userParties.has(partyId))).map(comm => comm.id);
};

const getCommsToMarkAsReadByThreadId = async (ctx, threadId, userId) => {
  const comms = await commsRepo.getUnreadCommunicationsWithSourceByThreadId(ctx, threadId);
  const partiesForComms = flatten(comms.map(comm => comm.parties));
  const ownersForParties = await getOwnersForParties(ctx, [...new Set(partiesForComms)]);
  const userParties = new Set(ownersForParties.filter(item => item.userId === userId).map(item => item.id));

  const ownerTeamsForParties = await getOwnerTeamsForParties(ctx, [...new Set(partiesForComms)]);
  const RSTeamParties = new Set(
    ownerTeamsForParties
      .filter(t => t.module === DALTypes.ModuleType.RESIDENT_SERVICES && t.workflowName === DALTypes.WorkflowName.ACTIVE_LEASE)
      .map(item => item.id),
  );
  return comms.filter(comm =>
    comm.parties.some(partyId => (userParties.has(partyId) || RSTeamParties.has(partyId)) && !utils.isCommAnOutgoingDirectMessage(comm)),
  );
};

export const commsWereReadByUser = async (ctx, threadId, userId) => {
  logger.trace({ ctx, threadId, userId }, 'commsWereReadByUser');
  const commsToMarkAsRead = await getCommsToMarkAsReadByThreadId(ctx, threadId, userId);

  const commsToMarkAsReadIds = commsToMarkAsRead.map(comm => comm.id);
  const updatedComms = await commsRepo.updateCommunicationEntriesByIds(ctx, commsToMarkAsReadIds, { unread: false, readBy: userId, readAt: now() });
  await commsRepo.removeUnreadCommunications(
    ctx,
    updatedComms.map(c => c.id),
  );
  await notifyCommunicationsUpdate(ctx, updatedComms);

  const updatedCommsWithSource = updatedComms.map(updatedComm =>
    commsToMarkAsRead.map(comm => comm.id === updatedComm.id && { ...updatedComm, source: comm.source }),
  );

  return flatten(updatedCommsWithSource).filter(comm => comm);
};

const logCommsMarkedAsReadForParty = async (ctx, { partyId, userId }) => {
  logger.trace({ ctx, partyId, userId }, 'logCommsMarkedAsReadForParty');

  await logEntity(ctx, {
    entity: { id: partyId, userId },
    activityType: ACTIVITY_TYPES.UPDATE,
    component: COMPONENT_TYPES.PARTY,
    subComponent: SUB_COMPONENT_TYPES.ALL_COMMS_MARKED_AS_READ,
  });
};

export const markCommsAsReadForPartyByUser = async (ctx, partyId, userId) => {
  logger.trace({ ctx, partyId, userId }, 'markCommsAsReadForPartyByUser - input params');

  const updatedComms = await commsRepo.markCommsAsReadForPartyByUser(ctx, partyId, userId);

  await commsRepo.removeUnreadCommunications(
    ctx,
    updatedComms.map(c => c.id),
  );

  logger.trace({ ctx, partyId, userId, updatedCommsSize: updatedComms.length }, 'markCommsAsReadForPartyByUser - result');
  await logCommsMarkedAsReadForParty(ctx, { userId, partyId });
  await notifyCommunicationsUpdate(ctx, updatedComms);
  return updatedComms;
};

export const computeSmsThreadId = async (ctx, personIds) => {
  logger.trace({ ctx, personIds }, 'computeSmsThreadId - input params');

  const allPersonsWithSamePhone = await contactInfoRepo.getAllPersonsWithSamePhone(ctx, personIds);
  const threadId = utils.computeThreadId(DALTypes.CommunicationMessageType.SMS, allPersonsWithSamePhone);

  logger.trace({ ctx, personIds, threadId }, 'computeSmsThreadId - result');

  return threadId;
};

const getThreadIdForMergeComms = async (ctx, comm, personIds) => {
  const { type, threadId } = comm;
  if (type === DALTypes.CommunicationMessageType.SMS) return await computeSmsThreadId(ctx, personIds);
  if (type === DALTypes.CommunicationMessageType.CALL) return utils.computeThreadId(DALTypes.CommunicationMessageType.CALL, personIds);
  return threadId;
};

export const mergeComms = async (ctx, basePersonId, otherPersonId) => {
  logger.trace({ ctx, basePersonId, otherPersonId }, 'mergeComms');
  const commsForPersons = await commsRepo.loadCommunicationsByPersonIds(ctx, [otherPersonId, basePersonId]);

  await Promise.each(commsForPersons, async comm => {
    const { persons: commPersons } = comm;
    const personIdsWithoutOtherPersId = remove(commPersons, otherPersonId);
    const persons = union(personIdsWithoutOtherPersId, [basePersonId]);

    const threadId = await getThreadIdForMergeComms(ctx, comm, persons);
    await commsRepo.updateCommunicationEntryById(ctx, comm.id, { persons, threadId });
  });
};

const sendEmailTemplate = async (
  ctx,
  {
    templateType,
    templateId,
    templateName,
    propertyTemplate,
    partyId,
    personId,
    templateDataOverride,
    templateArgs,
    contactInfo,
    communicationCategory,
    messageType,
    shouldNotNotifyMailSent,
    attachments: files,
  },
) => {
  const { defaultEmail, defaultEmailId } = contactInfo;
  const channel = templateType;
  const { subject, body: messageBody, missingTokens } = await renderTemplate(ctx, {
    templateId,
    templateName,
    propertyTemplate,
    context: TemplateTypes.EMAIL,
    partyId,
    templateDataOverride,
    templateArgs,
  });
  if (missingTokens.length) return { missingTokens, channel };
  const templatedEmailData = {
    ...ctx.body,
    partyId,
    message: { subject, files },
    recipients: {},
    html: messageBody,
    isHtmlContent: true,
    messageType,
    shouldNotNotifyMailSent,
    category: communicationCategory || (ctx.body && ctx.body.category),
  };

  const comm = await sendEmail(ctx, {
    authUser: ctx.authUser,
    emailData: templatedEmailData,
    cInfosEntities: [{ value: defaultEmail, personId, id: defaultEmailId }],
    templateArgs,
  });

  return { comm, channel: templateType };
};

const sendSmsTemplate = async (
  ctx,
  {
    templateType,
    templateId,
    templateName,
    propertyTemplate,
    partyId,
    personId,
    messageType,
    templateDataOverride,
    templateArgs,
    contactInfo,
    communicationCategory,
    skipSMSNotify,
  },
) => {
  const { defaultPhone } = contactInfo;
  const channel = templateType;

  const { body, missingTokens } = await renderTemplate(ctx, {
    templateId,
    templateName,
    propertyTemplate,
    context: TemplateTypes.SMS,
    partyId,
    templateDataOverride,
    templateArgs: { ...templateArgs, isSms: true },
  });
  if (missingTokens.length) return { missingTokens, channel };

  const sourcePhoneNo = await getOutgoingSourcePhoneNumber({ ctx, partyId });

  const smsData = {
    ...ctx,
    body: {
      partyId,
      message: { content: body },
      messageType,
      communicationCategory,
      skipSMSNotify,
    },
  };

  const comm = await sendSms(smsData, [{ value: defaultPhone, personId }], sourcePhoneNo, templateArgs);
  return { comm, channel };
};

const sendTemplate = async (ctx, data) => {
  const { templateType, personId, templateArgs = {}, partyId, person, templateName, templateId, propertyTemplate } = data;
  const contextData = { ...data, templateArgs: { ...templateArgs, personId } };
  const { comm, channel, missingTokens } =
    templateType === TemplateTypes.EMAIL ? await sendEmailTemplate(ctx, contextData) : await sendSmsTemplate(ctx, contextData);

  if (!comm) return { channel, missingTokens, recipientName: person.fullName, templateName, templateId, propertyTemplate };

  await addCommToActivityLog(ctx, { partyId, comm, person, templateArgs });
  await saveCommunicationAddedEvent(ctx, { partyId, metadata: { communicationId: comm.id } });

  return { comm, channel };
};

const handleSendCommunicationContext = async (ctx, data, contextRules = []) => {
  logger.trace({ ctx, data, contextRules }, 'handleSendCommunicationContext');
  const { contactInfo, personId } = data;

  let result = { personId, channels: [], communications: [], errors: [] };

  for (let i = 0; i < contextRules.length; i++) {
    const rule = contextRules[i];
    const { templateTypes, nextRule, error } = rule(contactInfo);

    if (error) {
      result.error = error;
      break;
    }

    if (!nextRule) {
      const sendTemplateResults = await mapSeries(templateTypes, async templateType => await sendTemplate(ctx, { ...data, templateType }));

      result = sendTemplateResults.reduce((acc, { missingTokens, comm, channel, recipientName, templateName }) => {
        acc.channels.push(channel);
        if (missingTokens) {
          acc.error = CommunicationContextError.RENDER_TEMPLATE_FAILED;
          acc.errors.push({ channel, missingTokens, recipientName, templateName });
          return acc;
        }
        comm && acc.communications.push(comm);
        return acc;
      }, result);

      break;
    }
  }

  return result;
};

const communicationContextRulesMapping = {
  [CommunicationContext.PREFER_SMS]: [
    ({ defaultPhone, defaultEmail }) => (defaultPhone && defaultEmail ? { templateTypes: [TemplateTypes.SMS] } : { nextRule: true }),
    ({ defaultPhone }) => (defaultPhone ? { templateTypes: [TemplateTypes.SMS] } : { nextRule: true }),
    ({ defaultEmail }) => (defaultEmail ? { templateTypes: [TemplateTypes.EMAIL] } : { nextRule: false }),
  ],

  [CommunicationContext.PREFER_EMAIL]: [
    ({ defaultPhone, defaultEmail }) => (defaultPhone && defaultEmail ? { templateTypes: [TemplateTypes.EMAIL] } : { nextRule: true }),
    ({ defaultPhone }) => (defaultPhone ? { templateTypes: [TemplateTypes.SMS] } : { nextRule: true }),
    ({ defaultEmail }) => (defaultEmail ? { templateTypes: [TemplateTypes.EMAIL] } : { nextRule: false }),
  ],

  [CommunicationContext.PREFER_EMAIL_AND_SMS]: [
    ({ defaultPhone, defaultEmail }) => (defaultPhone && defaultEmail ? { templateTypes: [TemplateTypes.SMS, TemplateTypes.EMAIL] } : { nextRule: true }),
    ({ defaultPhone }) => (defaultPhone ? { templateTypes: [TemplateTypes.SMS] } : { nextRule: true }),
    ({ defaultEmail }) => (defaultEmail ? { templateTypes: [TemplateTypes.EMAIL] } : { nextRule: false }),
  ],
  [CommunicationContext.REQUIRE_SMS]: [
    ({ defaultPhone }) =>
      defaultPhone ? { templateTypes: [TemplateTypes.SMS] } : { error: CommunicationContextError.REQUIRED_PHONE_NUMBER_UNAVAILABLE, nextRule: false },
  ],
  [CommunicationContext.REQUIRE_EMAIL]: [
    ({ defaultEmail }) =>
      defaultEmail ? { templateTypes: [TemplateTypes.EMAIL] } : { error: CommunicationContextError.REQUIRED_EMAIL_UNAVAILABLE, nextRule: false },
  ],
  [CommunicationContext.REQUIRE_EMAIL_OR_SMS]: [
    ({ defaultPhone, defaultEmail }) => (defaultPhone && defaultEmail ? { templateTypes: [TemplateTypes.EMAIL] } : { nextRule: true }),
    ({ defaultPhone }) => (defaultPhone ? { templateTypes: [TemplateTypes.SMS] } : { nextRule: true }),
    ({ defaultEmail }) => (defaultEmail ? { templateTypes: [TemplateTypes.EMAIL] } : { nextRule: false }),
  ],
  [CommunicationContext.NO_PREFERENCE]: [
    ({ defaultPhone, defaultEmail }) => (defaultPhone && defaultEmail ? { templateTypes: [TemplateTypes.EMAIL] } : { nextRule: true }),
    ({ defaultPhone }) => (defaultPhone ? { templateTypes: [TemplateTypes.SMS] } : { nextRule: true }),
    ({ defaultEmail }) => (defaultEmail ? { templateTypes: [TemplateTypes.EMAIL] } : { nextRule: false }),
  ],
};

const shouldSkipSmsNotification = commCategory => {
  const smsNotificationsToSkip = [
    DALTypes.CommunicationCategory.APPLICATION_DECLINED,
    DALTypes.CommunicationCategory.APPOINTMENT,
    DALTypes.CommunicationCategory.QUOTE,
  ];
  return smsNotificationsToSkip.includes(commCategory);
};

/**
 * This function sends communications(sms/email) given the following arguments, we have 3 main ways to render a template: byTemplateId, byTemplateName and byPropertyTemplate
 * @param {string} templateId - The id of the template to send.
 * @param {string} templateName - The name of the template to send.
 * @param {object} propertyTemplate - An object containing propertyId, section, action
 * @param {string} partyId - The id of the party that is calling the sendCommunication service.
 * @param {array} personIds - The list of people who will receive the communication(s).
 * @param {string} context - The communication context, each rule is defined in the communicationContextRulesMapping object.
 * @param {object} templateDataOverride - The data to override inside the template.
 * @param {object} templateArgs - The required arguments to build the template data.
 */
export const sendCommunication = async (
  ctx,
  {
    templateId,
    templateName,
    propertyTemplate,
    partyId,
    personIds,
    context,
    templateDataOverride,
    templateArgs,
    communicationCategory,
    messageType,
    shouldNotNotifyMailSent,
    attachments,
    personsOverride,
  },
) => {
  logger.info({ ctx, partyId }, 'sendCommunication - started!');
  const throwError = token => {
    throw new ServiceError({ token, status: 412 });
  };

  const { propertyId, action, section } = propertyTemplate || {};
  if (!templateId && !templateName && !(propertyId && action && section)) throwError('TEMPLATE_NOT_DEFINED');
  if (!partyId) throwError('PARTY_ID_NOT_DEFINED');
  if (!personIds) throwError('PERSON_IDS_NOT_DEFINED');

  const persons = personsOverride?.length ? personsOverride : await getPersonsByIds(ctx, personIds);
  if (!persons.length) {
    logger.error({ ctx, personIds }, 'The specified personIds were not found');
    throwError('PERSON_IDS_NOT_FOUND');
  }

  const skipSMSNotify = shouldSkipSmsNotification(communicationCategory);
  const communicationContextRules = communicationContextRulesMapping[context] || communicationContextRulesMapping[CommunicationContext.NO_PREFERENCE];

  const hasContactInfo = person => person.contactInfo && !isEmpty(person.contactInfo) && person.contactInfo.all.length;
  const [personsWithContactInfo, personsWithoutContactInfo] = partition(persons, hasContactInfo);

  personsWithoutContactInfo.length &&
    logger.trace({ ctx, personsWithoutContactInfo, templateName, partyId }, 'sendCommunication - persons without contact info');

  const results = await mapSeries(personsWithContactInfo, async person => {
    const { contactInfo, id } = person;

    return await handleSendCommunicationContext(
      ctx,
      {
        personId: id,
        person,
        partyId,
        templateId,
        templateName,
        propertyTemplate,
        templateDataOverride,
        templateArgs,
        contactInfo,
        communicationCategory,
        messageType,
        shouldNotNotifyMailSent,
        skipSMSNotify,
        attachments,
      },
      communicationContextRules,
    );
  });

  const validResults = results.filter(({ error }) => !error);
  const comms = validResults.map(({ communications }) => communications);
  const smsNotifyWasSkipped = skipSMSNotify;
  if (smsNotifyWasSkipped) {
    const party = await loadPartyById(ctx, partyId);

    const notificationMessage = getSMSNotificationMessage(messageType, communicationCategory, party.workflowName);
    const smsCommunications = flatten(comms).filter(communication => !!communication && communication.type === DALTypes.CommunicationMessageType.SMS);
    const personsWithPhoneNumber = flatten(smsCommunications).map(comm => comm.persons);
    logger.trace({ ctx, smsNotifyWasSkipped, partyId }, 'sendCommunication - smsNotifyWasSkipped');

    if (smsCommunications.length) {
      const notificationReceiver = ctx.sender || ctx.authUser;
      const smsCommIds = smsCommunications.map(communication => communication.id);
      if (notificationReceiver) {
        logger.info({ ctx }, 'Notify SMS sent');
        notify({
          ctx,
          event: eventTypes.SMS_SENT,
          data: {
            type: OperationResultType.SUCCESS,
            ids: smsCommIds,
            userId: notificationReceiver.id,
            notificationMessage,
            partyId,
            persons: flatten(personsWithPhoneNumber),
          },
          routing: { teams: party.teams },
        });
      } else {
        logger.info(
          { ctx, personsWithPhoneNumber, notificationMessage, partyId, smsCommIds },
          'Skipping send of SMS sent notification since no receiver was present in ctx',
        );
      }
    }
  }

  await sendMessageToCompleteFollowupPartyTasks(ctx, [partyId]);
  await handleCommsTemplateDataBindingErrors(ctx, partyId, results);

  logger.info({ ctx, partyId, communicationIds: flatten(comms).map(comm => comm.id) }, 'sendCommunication - completed!');

  return results;
};

export const removeUnreadCommunications = async (ctx, communicationIds) => {
  logger.trace({ ctx, communicationIds }, 'removeUnreadCommunications');
  await commsRepo.removeUnreadCommunications(ctx, communicationIds);
};

export const logPrintCommunication = async (ctx, data) => {
  const { partyId, commId, commType, from, direction, userId, created_at } = data;
  logger.trace({ ctx, partyId, commId, userId }, 'logPrintCommunication');

  await logEntity(ctx, {
    entity: {
      id: commId,
      partyId,
      communicationId: commId,
      type: commType,
      from,
      direction,
      userId,
      created_at,
    },
    activityType: ACTIVITY_TYPES.PRINT,
    component: COMPONENT_TYPES.EMAIL,
  });
};

const eligablePartyStatesForDirectMessaging = [DALTypes.PartyStateType.LEASE, DALTypes.PartyStateType.FUTURERESIDENT, DALTypes.PartyStateType.RESIDENT];

export const getDirectMessages = async (ctx, person, propertyId) => {
  logger.trace({ ctx, person, propertyId }, 'Getting direct messages');

  const partyIds = await getPartyIdsByPersonIdsPropertyIdAndState(ctx, [person.id], propertyId, eligablePartyStatesForDirectMessaging);
  const messages = await commsRepo.getDirectMessagesByPersonIdAndPartyIds(ctx, person.id, partyIds);

  return await enhanceDirectMessages(ctx, person, messages, propertyId);
};

export const handleIncomingDirectMessage = async (ctx, person, propertyId, message) => {
  logger.trace({ ctx, person, message }, 'Handling direct messages');

  const partyIds = await getActivePartyIdsByPersonIdsPropertyIdAndState(ctx, [person.id], propertyId, eligablePartyStatesForDirectMessaging);
  const teams = await getTeamsForParties(ctx, partyIds);
  const directMessage = {
    text: message.text,
    from: { personId: person.id, fullName: person.fullName },
  };
  const communication = {
    parties: partyIds,
    persons: [person.id],
    direction: DALTypes.CommunicationDirection.IN,
    type: DALTypes.CommunicationMessageType.DIRECT_MESSAGE,
    messageId: getUUID(),
    message: directMessage,
    threadId: message.threadId || getUUID(),
    teams,
    unread: true,
    category: DALTypes.CommunicationCategory.USER_COMMUNICATION,
  };
  const savedMessage = await addNewCommunication(ctx, communication);
  await updatePartyActivity(ctx, [savedMessage], getActivityLogDetailsForNewComm);
  await mapSeries(partyIds, async partyId => await saveCommunicationAddedEvent(ctx, { partyId, metadata: { communicationId: savedMessage.id } }));
  await notifyCommunicationUpdate(ctx, savedMessage);

  const [enhancedMessage] = await enhanceDirectMessages(ctx, person, [savedMessage], propertyId);
  const commonUser = await getCommonUserByPersonId(ctx, person.id);

  commonUser &&
    notify({
      ctx: { tenantId: RESIDENTS, trx: ctx.trx },
      event: eventTypes.DIRECT_MESSAGE_TO_RXP,
      data: { message: enhancedMessage },
      routing: { users: [commonUser.id], shouldFallbackToBroadcast: false },
    });

  return [enhancedMessage];
};

export const getUserNotifications = async (ctx, person, propertyIds) => {
  logger.trace({ ctx, person, propertyIds }, 'getUserNotifications');

  const unreadMessages = await commsRepo.getUnreadMessagesByPersonIdAndPropertyIds(ctx, person.id, propertyIds);

  return propertyIds.reduce((acc, propertyId) => {
    const hasUnreadMessages = unreadMessages.some(d => d.propertyId === propertyId);

    return { ...acc, [propertyId]: { hasUnreadMessages } };
  }, {});
};
