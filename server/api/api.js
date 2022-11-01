/*
 * Copyright (c) 2022 Reva Technology Inc., all rights reserved.
 * Unauthorized copying of this file, via any medium is strictly prohibited
 * Licensed under the Elastic License 2.0; you may not use this file except
 * in compliance with the Elastic License 2.0.
 */

import express from 'express';
import bodyParser from 'body-parser';
import cookieParser from 'cookie-parser';
import { validate } from 'express-jsonschema';
import cors from 'cors';
import compression from 'compression';
import * as schema from './json-schema';
import { publicRoutes } from './actions/public-proxy.js';
import { actions } from './actions/actions-proxy';
import { middleware } from '../common/middleware-proxy';
import { docVersionHandler, requestTrackingHandler } from '../common/public_middleware';

import { setLogMiddleware } from '../../common/server/logger-middleware';
import { setDefaultAPIHeaderSecurity } from '../common/securityMiddleware';
import { notifyVersion } from '../../common/server/notify-version';

import config from '../config';
import { setupApis as setupRentappApis } from '../../rentapp/server/api/rentapp-api';
import { setupApis as setupRoommatesApis } from '../../roommates/server/api/api';

import { Rights, SystemRoles } from '../../common/acd/rights';

import logger from '../../common/helpers/logger';
import { requiresRight } from './requires-right';
import { setRequestMiddleware } from '../../common/server/request-middleware';
import { errorHandler } from '../common/errorMiddleware';
import { isString } from '../../common/helpers/type-of';
import { dbKnexMiddleware } from '../common/dbKnexMiddleware';
import { getUploadMiddleware } from '../common/upload-middleware';
import { getTranslationsMiddleware } from '../common/i18n-request-middleware';
import { isValidImageMimeType } from '../../common/image-types';

const { validatePartyId, validatePartyIds, validatePartyGroupId, validatePersonId } = actions;

const app = express();

const upload = getUploadMiddleware({ config, logger });
const uploadImportFiles = getUploadMiddleware({ maxSizeInMegabytes: 10000, config, logger });
const uploadVoiceMessages = getUploadMiddleware({ maxSizeInMegabytes: 1000, config, logger });
const uploadDocuments = getUploadMiddleware({ maxSizeInMegabytes: 20, config, logger });
const uploadImages = getUploadMiddleware({
  maxSizeInMegabytes: 10, // TODO: check if this should be the max size for all images (not only HERO on posts)
  config,
  logger,
  filesAreRequired: true, // files must be uploaded to this endpoint or it should just fail
  fileFilter: (req, file, cb) => {
    try {
      const valid = isValidImageMimeType(file.mimetype);
      cb(null, valid);
    } catch (err) {
      cb(err);
    }
  },
});

app.use(getTranslationsMiddleware({ config, logger }));

app.use(bodyParser.urlencoded({ extended: false, limit: '10000mb' }));
app.use(bodyParser.json({ limit: '10000mb' }));
app.use(cookieParser());

setRequestMiddleware({ app });

setDefaultAPIHeaderSecurity(app);

app.get('/ping', async (req, res) => {
  res.send('ok');
});

// handle all calls to /api and forward to handlers
app.use('/api', (req, res) => app.handle(req, res));

// if we load this before the previous line we will have duplicated reports due to the
// redirection from /api/handler to /handler
app.use(dbKnexMiddleware(config));

app.get('/images/:assetType/:entityId', middleware.tenantHandler(), actions.getAssetUrlByEntityId);
app.get('/images/app/rxp/tenant/:category', middleware.tenantHandler(), actions.getTenantRxpAssetByCategory);
app.get('/images/app/rxp/property/:propertyId/:category', middleware.tenantHandler(), actions.getPropertyRxpAssetByCategory);

app.get('/marketing/properties/sitemap', middleware.tenantHandler(), actions.getPropertyAssetsSitemap);
app.get('/marketing/assets/global/*', middleware.tenantHandler(), actions.getGlobalMarketingAssetByPath);
app.get('/marketing/assets/:propertyName/*', middleware.tenantHandler(), actions.getPropertyMarketingAssetByPath);
app.get('/parties/:partyId/export/proxy', actions.exportPartyFromHtml);

// these paths may specify an optional configuration key from which
// their API tokens are obtained.  If none is provided, the token
// in config.tokens.api is used instead.
const webhookPaths = [
  '/webhooks/email',
  '/webhooks/email/status',
  '/webhooks/screeningResponse:fadvCommon.apiToken',
  '/webhooks/sms/status:telephonyApiToken',
  '/webhooks/sms:telephonyApiToken',
  '/webhook/directDial:telephonyApiToken',
  '/webhooks/postDial:telephonyApiToken',
  '/webhooks/callRecording:telephonyApiToken',
  '/webhooks/callbackDial:telephonyApiToken',
  '/webhooks/digitsPressed:telephonyApiToken',
  '/webhooks/callReadyForDequeue:telephonyApiToken',
  '/webhooks/conferenceCallback:telephonyApiToken',
  '/webhooks/guest-sms-receiver:telephonyApiToken',
  '/webhooks/conferenceCallback:telephonyApiToken',
  '/webhooks/externalCalendarDelegatedAccessCallback:externalCalendarsApiToken',
  '/webhooks/userRevaCalendarEventUpdated:externalCalendarsApiToken',
  '/webhooks/userPersonalCalendarEventUpdated:externalCalendarsApiToken',
  '/webhooks/teamCalendarEventUpdated:externalCalendarsApiToken',
  '/webhooks/externalCalendarRsvpStatus:externalCalendarsApiToken',
  '/webhooks/sendGridStats',
];

// these paths may specify an optional configuration key.
// If none is provided, the token in tokens.internalApi is used instead.
const internalPaths = ['/notifyVersion'];

const NOT_SLASH = '[^/]*';
const openPaths = [
  '/config',
  '/sendCustomerOldRentDefermentDoc',
  '/getTenantAndPropertyIds',
  '/login',
  '/registerWithInvite',
  '/resetPassword',
  '/sendResetPasswordMail',
  '/validateResetToken',
  '/validResetToken',
  '/validateToken',
  '/swagger.json',
  '/favicon.ico', // added to avoid a second request during debugging
  '/sendRegistrationEmail',
  '/test/rescreen',
  '/sftpUsers',
  '/register',
  '/register/generateToken',
  '/requestResetPassword/generateToken',
  '/roommates',
  '/zendesk/login',
  '/profiles',
  '/zendesk/logout',
  '/university/createSandbox',
  '/university/checkSandboxStatus',
  '/log', // TODO: remove this; it's here so that we can use during rentapp troubleshooting
  '/health/db',
  '/health/ws',
  '/health/mq',
  '/notFound',
  '/test/fakeDocuSignPage',
  '/sisense/login',
  /^\/(api\/documents\/public\/images|documents\/public\/images)\/[^/]*\/fetch$/i,
  /^\/(api\/images|images)\/[^/]*\/[^/]*$/i,
];

const allPartyAdditionalInfoEndpoint = new RegExp(`^\\/parties\\/${NOT_SLASH}\\/additionalInfo$`, 'i');
const specificPartyAdditionalInfoEndpoint = new RegExp(`^\\/parties\\/${NOT_SLASH}\\/additionalInfo\\/${NOT_SLASH}$`, 'i');
const specificPartyAgentEndpoint = new RegExp(`^\\/parties\\/${NOT_SLASH}\\/agent$`, 'i');
const specificQuoteEndpoint = new RegExp(`^\\/quotes\\/published\\/${NOT_SLASH}$`, 'i');
const specificInventoryDetailEndpoint = new RegExp(`^\\/inventories\\/${NOT_SLASH}\\/details$`, 'i');
const specificUpdateDocumentEndpoint = new RegExp(`^\\/documents\\/${NOT_SLASH}\\/metadata$`, 'i');
const specificPersonAppDocumentsEndpoint = new RegExp(`^\\/personApplications\\/${NOT_SLASH}\\/documents$`, 'i');
const specificPartyAppDocumentsEndpoint = new RegExp(`^\\/partyApplications\\/${NOT_SLASH}\\/documents$`, 'i');
const specificPersonAppDocumentsDownloadEndpoint = new RegExp(`^\\/personApplications\\/current\\/documents\\/${NOT_SLASH}\\/retrieve$`, 'i');
const specificPersonEndpoint = new RegExp(`^\\/persons\\/${NOT_SLASH}$`, 'i');
const specificPartyQuotePromotionsEndpoint = new RegExp(`^\\/parties\\/${NOT_SLASH}\\/quotePromotions$`, 'i');
const specificPartyExportEndpoint = new RegExp(`^\\/parties\\/${NOT_SLASH}\\/export$`, 'i');
const specificPersonFeesEndpoint = new RegExp(`^\\/personApplications\\/${NOT_SLASH}\\/fees$`, 'i');
const specificApplicationSettingsEndpoint = new RegExp(`^\\/applicationSettings\\/${NOT_SLASH}\\/partyType\\/${NOT_SLASH}\\/memberType\\/${NOT_SLASH}$`, 'i');
const specificRoommateProfiles = new RegExp(`^\\/profiles\\/${NOT_SLASH}$`, 'i');

const userPaths = [
  '/documents',
  '/disclosures',
  allPartyAdditionalInfoEndpoint, // TODO: Move to restrictedPaths when the CPM-4192 is implemented
  specificPartyAdditionalInfoEndpoint, // TODO: Move to restrictedPaths when the CPM-4192 is implemented
  specificPartyAgentEndpoint,
  specificQuoteEndpoint,
  specificInventoryDetailEndpoint,
  '/personApplications/current/additionalData',
  '/personApplications/current',
  '/partyApplication/current/applicationData',
  specificUpdateDocumentEndpoint,
  specificPersonAppDocumentsEndpoint,
  specificPartyAppDocumentsEndpoint,
  specificPersonAppDocumentsDownloadEndpoint,
  '/applicant',
  '/applications',
  specificPersonEndpoint,
  '/personApplications/current/screeningData',
  specificPartyQuotePromotionsEndpoint,
  specificPartyExportEndpoint,
  '/fullStory/content',
  specificPersonFeesEndpoint,
  specificApplicationSettingsEndpoint,
  specificRoommateProfiles,
  '/roommates/messages/send',
];

const bindRoutes = expressApp => {
  const routeMethods = ['get', 'put', 'post', 'patch', 'delete'];
  const router = {};

  routeMethods.forEach(method => {
    router[method] = expressApp[method].bind(expressApp);
    expressApp[method] = (route, ...routeMiddleware) => {
      if (!routeMiddleware.length) {
        return router[method](route); // probably this is app.get('settingName');
      }

      const [routeAction] = routeMiddleware.splice(routeMiddleware.length - 1, 1);
      if (!routeAction) {
        logger.error({ route }, 'Could not find action for route');
        throw new Error(`Missing action for route ${route}`);
      }
      return router[method](route, ...routeMiddleware, middleware.routeHandler(routeAction));
    };
  });
};

bindRoutes(app);

const getApiPaths = apiPaths => {
  const mappedApiPaths = apiPaths.map(apiPath => (isString(apiPath) ? `/api${apiPath}` : apiPath));
  return !config.isIntegration ? mappedApiPaths : apiPaths;
};

// order is important here
// some legacy browsers (IE11, various SmartTVs) don't like 204 that's why we need to use 200
app.use(cors({ optionsSuccessStatus: 200 }));
app.use(middleware.noIndexRobotsHeader());
app.use(middleware.addHeaderReferrer());
app.use(middleware.tokenAuthorizationHandler());
app.use(middleware.webhookAuthorizationHandler(webhookPaths));
app.use(middleware.internalAuthorizationHandler(internalPaths));
app.use(middleware.authorizationHandler(getApiPaths(openPaths)));
app.use(middleware.commonTokenAuthorizationHandler(userPaths));

app.use(middleware.tenantHandler());
app.use(middleware.hydrateSession());

setLogMiddleware({ app, logger });
app.use(compression());

// IMPORTANT: use usual Express syntax for registering routes: app.METHOD(PATH, [..MIDDLEWARE], ROUTEHANDLER)
// NOTE 1: ROUTEHANDLER should be a function of the format ([req: ExpressRequest]): Promise|Value|void
// If the return value is a Promise - the value with which the promise is resolved will be sent in the HTTP Response as JSON
// If the return value is not a promise - it will be sent in the HTTP Response as JSON
// If an Error is thrown by the handler - it's token will be sent in the HTTP Response as JSON (+stacktrace in debug mode)
// NOTE 2: MIDDLEWARE is an optional list of standard Express middleware
// That is functions receiving (req, res, next) with the ability to augment req/res or break the execution by invoking next with an error

// Routes are not cacheable by default.  To make a route cacheable, add "makeRequestCacheable" before calling the action
setupRentappApis(app);
setupRoommatesApis(app);

app.post('/login', actions.login);
app.post('/registerWithInvite', actions.registerWithInvite);
app.post('/resetPassword', actions.resetPassword);
app.post('/search/units', actions.getRankedUnits);
app.post('/search/persons', actions.searchPersons);
app.post('/search/personMatches', actions.getPersonMatches);
app.post('/search/companies', actions.searchCompanies);
app.post('/globalSearch', actions.globalSearch);
app.post('/sendInvite', actions.sendInvite);
app.post('/sendInviteImportedUsers', actions.sendInviteImportedUsers);
app.post('/sendResetPasswordMail', actions.sendResetPasswordMail);
app.post('/sendRegistrationEmail', actions.sendRegistrationEmail);
app.post('/validateResetToken', actions.validateResetToken);
app.post('/validateToken', actions.validateToken);
app.post('/communication/:partyId/sendQuoteMail', validatePartyId, actions.sendQuoteMail);

app.get('/config', actions.getConfig);
app.get('/getTenantAndPropertyIds', actions.getTenantAndPropertyIds);

// import endpoints
app.post('/seedData', uploadImportFiles, requiresRight(SystemRoles.IS_ADMIN_USER), middleware.mapOriginalName, actions.uploadDataImportFiles);

app.post('/documents/public/images', requiresRight(Rights.MODIFY_POSTS), uploadImages, middleware.mapOriginalName, actions.uploadImageFile);
app.get('/documents/public/images/:imageId/fetch', actions.fetchPublicImage);
app.delete('/documents/public/images/:imageId', requiresRight(Rights.MODIFY_POSTS), actions.deleteUploadedImage);
app.get('/documents/public/images/:imageId/download', requiresRight(Rights.MODIFY_POSTS), actions.downloadImage);

app.get('/documents', actions.getAllDocuments);
app.get('/documents/:documentId/download', actions.downloadDocument);
app.post('/documents', uploadDocuments, middleware.mapOriginalName, actions.uploadDocuments);
app.patch('/documents/:documentId/metadata', actions.updateDocumentMetadata);
app.delete('/documents', actions.deleteDocuments);

app.post('/importUpdates', upload, requiresRight(SystemRoles.IS_ADMIN_USER), middleware.mapOriginalName, actions.uploadUpdates);
app.post('/importRms', upload, requiresRight(SystemRoles.IS_ADMIN_USER), middleware.mapOriginalName, actions.importRms);
app.post('/importVoiceMessages', uploadVoiceMessages, requiresRight(SystemRoles.IS_ADMIN_USER), middleware.mapOriginalName, actions.uploadVoiceMessages);
// migration endpoints
app.post('/migrateData', upload, requiresRight(SystemRoles.IS_ADMIN_USER), middleware.mapOriginalName, actions.uploadAndConvertFiles);

// path binded endpoints
app.get('/globalData', actions.getGlobalData);
app.post('/dashboard', actions.getFilteredDashboard);
app.post('/dashboard/party/:partyId', validatePartyId, actions.getDashboardParty);
app.get('/personDetails/:personId', validatePersonId, actions.getPersonDetailsData);
app.get('/partyDetails/:partyId', validatePartyId, actions.getPartyDetailsData);
// end of data loading endpoints for pages

app.patch('/companies/:companyId', actions.updateCompany);
app.post('/companies', actions.addCompany);

app.post('/parties', actions.addParty);
app.get('/parties', actions.loadAllParties);
app.get('/partyGroups/:partyGroupId', validatePartyGroupId, actions.loadPartiesByPartyGroupId);

app.patch('/parties/:partyId', validatePartyId, requiresRight(Rights.MODIFY_PARTY), actions.updateParty);

app.get('/parties/:partyId/export', validatePartyId, requiresRight(Rights.MODIFY_PARTY), actions.exportParty);

app.get('/parties/:partyId', validatePartyId, actions.loadParty);

app.post('/parties/:partyId/members', validatePartyId, requiresRight(Rights.MODIFY_PARTY), actions.addPartyMember);
app.patch('/parties/:partyId/members/:memberId', validatePartyId, requiresRight(Rights.MODIFY_PARTY), actions.updatePartyMember);

app.post('/parties/:partyId/members/:memberId/proxyToken', validatePartyId, actions.getImpersonationToken);

app.post('/parties/:partyId/members/:memberId/applicationInvitation', validatePartyId, actions.sendApplicationInvitationToContact);

app.post('/parties/:partyId/personApplications/copy', validatePartyId, actions.copyPersonApplication);

app.get('/parties/:partyId/members', validatePartyId, actions.loadPartyMembers);
app.get('/parties/:partyId/agent', validatePartyId, actions.loadPartyAgent);
app.get('/parties/:partyId/communication', validatePartyId, requiresRight(Rights.MODIFY_PARTY), actions.loadCommunicationsByParty);

app.post('/parties/communications', validatePartyIds, actions.loadCommunicationsForParties);

app.get('/parties/:partyId/tasks', validatePartyId, requiresRight(Rights.MODIFY_PARTY), actions.getTasksForParty);

app.delete('/parties/:partyId/members/:memberId', validatePartyId, requiresRight(Rights.MODIFY_PARTY), actions.removePartyMember);

app.post('/parties/:partyId/assign', validatePartyId, requiresRight(Rights.MODIFY_PARTY), actions.assignParty);

app.post('/parties/addTransferReasonActivityLogAndComm', actions.addTransferReasonActivityLogAndComm);

config.isDemoEnv && app.post('/parties/:partyId/restartCai', validatePartyId, requiresRight(Rights.MODIFY_PARTY), actions.restartCai);

app.post(
  '/parties/:partyId/members/:memberId/linkMember',
  validatePartyId,
  middleware.forbiddenOnCorporate,
  requiresRight(Rights.MODIFY_PARTY),
  actions.linkPartyMember,
);

app.post('/parties/:partyId/close', validatePartyId, requiresRight(Rights.MODIFY_PARTY), actions.closeParty);
app.post('/parties/:partyId/markAsSpam', validatePartyId, actions.markAsSpam);

app.post('/parties/:partyId/reopen', validatePartyId, requiresRight(Rights.MODIFY_PARTY), actions.reopenParty);
app.post('/parties/:partyId/additionalInfo', validatePartyId, actions.addPartyAdditionalInfo);
app.get('/parties/:partyId/additionalInfo', validatePartyId, actions.loadAllPartyAdditionalInfo);
app.patch('/parties/:partyId/additionalInfo/:additionalInfoId', validatePartyId, actions.updatePartyAdditionalInfo);
app.delete('/parties/:partyId/additionalInfo/:additionalInfoId', validatePartyId, actions.removePartyAdditionalInfo);
app.get('/parties/:partyId/additionalInfo/:additionalInfoId', validatePartyId, actions.loadPartyAdditionalInfo);

app.get('/parties/:partyId/screeningResult', validatePartyId, actions.loadAllScreeningResults);

app.get('/parties/:partyId/quotePromotions', validatePartyId, actions.loadAllQuotePromotions);
app.post('/parties/:partyId/quotePromotions', validatePartyId, actions.insertQuotePromotion);
app.get('/parties/:partyId/quotePromotions/:quotePromotionId', validatePartyId, actions.loadQuotePromotion);
app.patch('/parties/:partyId/quotePromotions/:quotePromotionId', validatePartyId, actions.updateQuotePromotion);

app.get('/parties/:partyId/transactions', validatePartyId, actions.getApplicationInvoices);

app.post('/parties/:partyId/demoteApplication', validatePartyId, actions.demoteApplication);

app.post('/navigationHistory', actions.addNavigationHistoryEntry);
app.get('/navigationHistory', actions.loadNavigationHistoryForUser);

app.post('/mergePartySessions', actions.createMergePartySession);
app.post('/mergePartySessions/:sessionId/matches', actions.generateNextPartyMatch);
app.patch('/mergePartySessions/:sessionId/matches/:matchId/resolve', actions.resolvePartyMatch);

app.patch('/communications', actions.updateCommunications);
app.patch('/communications/thread/:threadId/markAsRead', actions.commsWereReadByUser);
app.patch('/communications/party/:partyId/markAsRead', validatePartyId, actions.markCommsAsReadForPartyByUser);
app.post('/communications', actions.addCommunication);
app.get('/communications/:commId', actions.getCommunication);
app.post('/communications/phone/:commId/transfer', actions.transferCall);
app.post('/communications/phone/makeCallFromPhone', actions.makeCallFromPhone);
app.post('/communications/phone/:commId/stopRecording', actions.stopRecording);
app.post('/communications/phone/:commId/holdCall', actions.holdCall);
app.post('/communications/phone/:commId/unholdCall', actions.unholdCall);
app.get('/communications/phone/:commId/incomingCallInfo', actions.getInfoForIncomingCall);
app.get('/communications/phone/:commId/activeCallData', actions.getDataForActiveCall);
app.get('/communications/phone/:threadId/inactiveCallData', actions.getDataForInactiveCall);
app.get('/communications/phone/externalPhones', actions.getExternalPhones);
app.post('/communications/draft', actions.storeCommunicationDraft);
app.get('/communications/drafts/:userId/:partyId', validatePartyId, actions.getDraftsForUserAndParty);
app.delete('/communications/drafts/:draftId', actions.deleteDraftById);
app.post('/communications/sms/computeThreadId', actions.computeSmsThreadId);
app.get('/teams/callQueue', actions.getCallQueueForUserTeams);

app.post('/communications/:partyId/sendCommunication', actions.sendCommunication);

app.post('/log/print/communication', actions.logPrintCommunication);

app.get('/users', actions.loadUsers);
app.post('/users', actions.loadUsersByIds);
app.get('/users/:userId', actions.loadUserById);
app.patch('/users/:userId', actions.updateUser);
app.post('/users/:userId/ipPhoneCredentials', actions.createIpPhoneCredentials);
app.delete('/users/:userId/ipPhoneCredentials', actions.removeIpPhoneCredentials);
app.patch('/users/:userId/status', actions.updateUserStatus);
app.patch('/users/:userId/logoutUser', actions.logoutUser);

app.get('/tasks', actions.getTasks);
app.post('/tasks', actions.addTask);
app.get('/tasks/:teamId/:year/:month/:day/:numberOfDays/:slotDuration/teamCalendarSlots', actions.getTeamCalendarSlots);
app.get('/tasks/:userId/:teamId/:year/:month/:day/events', actions.getDayEventsForUserAndTeam);
app.patch('/tasks/:taskId', actions.updateTask);
app.patch('/tasks', actions.updateTasks);
app.post('/tasks/:teamId/nextAgentForAppointment', actions.getNextAgentForAppointment);

app.post('/schedule/overview', actions.getScheduleOverview);
app.get('/schedule', actions.getScheduleForDays);

app.get('/layouts', actions.loadLayouts);
app.get('/buildings', actions.loadBuildings);
app.get('/disclosures', actions.loadDisclosures);

app.post('/persons/merge', actions.mergePersons);
app.patch('/persons/:personId', actions.updatePerson);
app.get('/persons', actions.loadPersons);
app.get('/persons/:personId', actions.loadPersonById);

app.get('/leads', actions.loadRawLeads);

app.get('/inventories', actions.getInventoryItems);
app.get('/inventories/:inventoryId', actions.getInventoryItem);
app.get('/inventories/:inventoryId/details', actions.getInventoryItemDetails);
app.get('/inventories/:inventoryId/amenities', actions.getAmenitiesFromInventory);
app.post('/inventories/:inventoryId/holds', actions.setInventoryOnHold);
app.delete('/inventories/:inventoryId/holds', actions.releaseManuallyHeldInventory);

app.get('/amenities', actions.getFilteredAmenities);

app.get('/properties', actions.loadProperties);
app.post('/propertiesByTeams', actions.loadPropertiesByTeams);

app.put('/parties/:partyId/units-filters', validatePartyId, actions.saveUnitsFilters);

app.put('/users/:userId/search-history', actions.saveSearchHistory);
app.get('/users/:userId/search-history', actions.loadSearchHistory);

app.post('/tenants/:id/clearTenantSchema', requiresRight(SystemRoles.IS_ADMIN_USER), actions.clearTenantSchema);
app.post('/tenants/:id/refreshTenantSchema', middleware.forbiddenOnProd, requiresRight(SystemRoles.IS_ADMIN_USER), actions.refreshTenantSchema);
app.patch('/tenants/:id/passwordForType', requiresRight(SystemRoles.IS_ADMIN_USER), actions.passwordForType);
app.post('/tenants', requiresRight(SystemRoles.IS_ADMIN_USER), actions.createTenant);
app.patch('/tenants/:id', requiresRight(SystemRoles.IS_ADMIN_USER), actions.patchTenant);
app.get('/tenants', requiresRight(SystemRoles.IS_ADMIN_USER), actions.getAllTenants);
app.delete('/tenants/:id', requiresRight(SystemRoles.IS_ADMIN_USER), actions.deleteTenantById);
app.get('/tenants/availablePhoneNumbers', requiresRight(SystemRoles.IS_ADMIN_USER), actions.getAvailableTenantPhoneNumbers);
app.get('/tenants/:id', requiresRight(SystemRoles.IS_ADMIN_USER), actions.getTenantById);
app.post('/tenants/communicationProviderCleanup', requiresRight(SystemRoles.IS_ADMIN_USER), actions.triggerCommunicationProviderCleanup);
app.get('/tenants/:id/teams', requiresRight(SystemRoles.IS_ADMIN_USER), actions.getTenantTeams);
app.get('/tenants/:id/programs', requiresRight(SystemRoles.IS_ADMIN_USER), actions.getTenantPrograms);
app.patch('/tenants/:tenantId/teams/:teamId', requiresRight(SystemRoles.IS_ADMIN_USER), actions.updateTeam);
app.post('/tenants/:tenantId/export', requiresRight(SystemRoles.IS_ADMIN_USER), actions.exportDatabaseToSpreadsheet);
app.get('/tenants/:tenantId/download/:fileName', requiresRight(SystemRoles.IS_ADMIN_USER), actions.downloadExportedDatabaseFileFromS3);
app.get('/test/tenants/:tenantId/property/:propertyName', actions.getPropertyByName);
app.post('/test/tenants/:tenantId/unitsPricing/:propertyId', actions.saveUnitsPricingByPropertyId);
app.get('/test/tenants/:tenantId/program/:programName', actions.getProgramByName);
app.get('/appSettings', requiresRight(SystemRoles.IS_ADMIN_USER), actions.fetchAppSettings);
app.patch('/appSettings', requiresRight(SystemRoles.IS_ADMIN_USER), actions.updateAppSettings);
app.get('/subscriptions', requiresRight(SystemRoles.IS_ADMIN_USER), actions.fetchSubscriptions);
app.patch('/subscriptions', requiresRight(SystemRoles.IS_ADMIN_USER), actions.updateSubscriptions);
app.delete('/subscriptions', requiresRight(SystemRoles.IS_ADMIN_USER), actions.deleteSubscriptions);
app.post('/subscriptions', requiresRight(SystemRoles.IS_ADMIN_USER), actions.addSubscriptions);

app.patch('/tenants/:tenantId/migrateRenewalV1', requiresRight(SystemRoles.IS_ADMIN_USER), actions.migrateRenewalV1);

app.post('/tenants/:tenantId/generateDomainToken', actions.generateDomainToken);

app.post('/tenants/:tenantId/closeImportedParties', requiresRight(SystemRoles.IS_ADMIN_USER), actions.closeImportedParties);
app.post(
  '/tenants/:tenantId/archivePartiesFromSoldProperties',
  requiresRight(SystemRoles.IS_ADMIN_USER),
  middleware.mapOriginalName,
  actions.archivePartiesFromSoldProperties,
);
app.post('/tenants/:tenantId/refreshLeaseTemplates', actions.refreshLeaseTemplates);
app.post('/tenants/:tenantId/refreshPaymentProvider', actions.refreshPaymentProvider);

app.get('/activityLogs', actions.getActivityLogs);
app.get('/activityLogs/:id', actions.getActivityLog);
app.post('/activityLog', actions.addActivityLog);

app.get('/swagger.json', actions.swagger);

app.post('/webhooks/email', actions.enqueueInboundEmailReceived);
app.post('/webhooks/email/status', actions.enqueueOutboundEmailStatusChange);
app.post('/webhooks/sms', actions.enqueueInboundSmsReceived);
app.post('/webhooks/sms/status', actions.enqueueOutboundSmsStatusChange);

app.post('/webhooks/directDial', actions.respondToCallRequest);
app.post('/webhooks/postDial', actions.respondToPostCallRequest);
app.post('/webhooks/callbackDial', actions.respondToDialCallbackRequest);
app.post('/webhooks/callRecording', actions.saveCallRecording);
app.post('/webhooks/digitsPressed', actions.respondToDigitsPressedRequest);
app.post('/webhooks/callReadyForDequeue', actions.respondToCallReadyForDequeueRequest);
app.post('/webhooks/conferenceCallback', actions.respondToConferenceCallbackRequest);
app.post('/webhooks/transferFromQueue', actions.transferFromQueue);
app.post('/webhooks/transferToVoicemail', actions.transferToVoicemail);
app.post('/webhooks/conferenceCallback', actions.respondToConferenceCallbackRequest);
app.post('/webhooks/agentCallForQueue', actions.respondToAgentCallForQueueRequest);

// ring central stuff
app.post('/tenants/:tenantId/ringCentral/token/refresh', actions.refreshRingCentralToken);
app.post('/tenants/:tenantId/ringCentral/token', actions.requestRingCentralToken);
app.post('/tenants/:tenantId/ringCentral/renewSubscription', actions.renewRingCentralSubscription);
app.get('/tenants/:tenantId/ringCentral/authUrl', actions.getRingCentralAuthUrl);
app.post('/webhooks/ringCentralNotificationCallback', actions.respondToRCEvent);

// external calendars integration
app.get('/externalCalendars/enterpriseConnect/authorizationUrl', actions.getAuthorizationUrlForEnterpriseConnect);
app.get('/externalCalendars/externalCalendarEventsSync', actions.syncCalendarEvents);
app.post('/externalCalendars/enterpriseConnect/accessToken', actions.requestAccessTokenForEnterpriseConnect);
app.post('/webhooks/externalCalendarDelegatedAccessCallback', actions.respondToCalendarDelegatedAccessCallback);
app.post('/webhooks/userRevaCalendarEventUpdated', actions.userRevaCalendarEventUpdatedCallback);
app.post('/webhooks/userPersonalCalendarEventUpdated', actions.userPersonalCalendarEventUpdatedCallback);
app.post('/webhooks/teamCalendarEventUpdated', actions.teamCalendarEventUpdatedCallback);
app.post('/webhooks/externalCalendarRsvpStatus', actions.externalCalendarRsvpStatus);

// sendGrid integration
app.post('/webhooks/sendGridStats', actions.sendGridStats);

app.get('/quotes', actions.getAllQuotes);
app.post('/quotes', actions.createAQuote);
app.get('/quotes/draft/:quoteId', actions.getAQuoteDraft);
app.get('/quotes/published/:quoteId', middleware.replacePersonIdForMergedPerson, actions.getAQuotePublish);
app.post('/quotes/:quoteId/emailContent', middleware.replacePersonIdForMergedPerson, actions.renderPublishedQuote);
app.post('/quotes/draft', actions.duplicateQuote);
app.patch('/quotes/draft/:quoteId', actions.patchAQuote);
app.delete('/quotes/:quoteId', actions.deleteAQuote);
app.post('/printQuote', actions.printAQuote);

app.post('/log', actions.log);

app.get('/jobs', requiresRight(SystemRoles.IS_ADMIN_USER), actions.getFilteredJobs);
app.get('/jobs/:jobId', requiresRight(SystemRoles.IS_ADMIN_USER), actions.getJobById);

app.get('/validateAssets', actions.validateAssets);

// TODO: make sure these endpoints are not used anymore and remove them if not
app.post('/contactUs', actions.handleWebInquiry);
app.post('/guestCard', actions.handleWebInquiry);
app.get('/guestCard/availableSlots', actions.getAvailableSlots);
app.get('/guestCard/appointment/:token', actions.getAppointmentForSelfService);
app.patch('/guestCard/appointment/:token', actions.updateAppointmentFromSelfService);
app.post('/marketing/session', middleware.ignoreBot, actions.handleMarketingContact);
app.post('/marketingContact', middleware.ignoreBot, actions.handleMarketingContact);
app.post('/marketing/guestCard', actions.handleWebInquiry);
app.get('/marketing/appointment/availableSlots', actions.getAvailableSlots);
app.get('/marketing/appointment/:token', actions.getAppointmentForSelfService);
app.patch('/marketing/appointment/:token', actions.updateAppointmentFromSelfService);

app.get('/blacklist', actions.getBlacklist);
app.post('/blacklist', actions.addToBlacklist);
app.delete('/blacklist', actions.removeFromBlacklist);

// leases
app.patch('/parties/:partyId/leases/:leaseId', validatePartyId, requiresRight(Rights.MODIFY_PARTY), actions.patchLease);
app.post('/parties/:partyId/leases/:leaseId/publish', validatePartyId, requiresRight(Rights.MODIFY_PARTY), actions.publishLease);
app.post('/parties/:partyId/leases/:leaseId/email', validatePartyId, requiresRight(Rights.MODIFY_PARTY), actions.emailLease);
app.post('/parties/:partyId/leases/:leaseId/void', validatePartyId, requiresRight(Rights.MODIFY_PARTY), actions.voidLease);
app.post('/parties/:partyId/leases/:leaseId/voidExecutedLease', validatePartyId, requiresRight(Rights.MODIFY_PARTY), actions.voidExecutedLease);
app.post('/parties/:partyId/leases/:leaseId/wetSign', validatePartyId, requiresRight(Rights.MODIFY_PARTY), actions.wetSign);
app.get('/activeLeases/reassignActiveLeasesToRS', requiresRight(SystemRoles.IS_ADMIN_USER), actions.reassignActiveLeasesToRS);

app.get('/parties/:partyId/leases/:leaseId/additionalData', validatePartyId, actions.getLeaseAdditionalData);

app.post('/parties/:partyId/leases', validatePartyId, requiresRight(Rights.MODIFY_PARTY), actions.createLease);
app.get('/parties/:partyId/leases', validatePartyId, actions.loadLeasesForParty);

// this is used when link is sent via email
app.get('/leases/signature-token', actions.getResidentSignatureToken);
app.get('/leases/download', actions.downloadLeaseForResident);
app.get('/leases/:leaseId/download', actions.downloadLeaseForAgent);
app.get('/leases/downloadPreview', actions.downloadPreviewLeaseForAgent);

app.get('/leases/:envelopeId/token/:clientUserId', actions.getInOfficeSignatureToken);
app.post('/leases/updateEnvelopeStatus', actions.updateEnvelopeStatus);
app.get('/parties/:partyId/leases/:leaseId/status', validatePartyId, requiresRight(Rights.MODIFY_PARTY), actions.getLeaseStatus);
app.post('/leases/:leaseId/syncLeaseSignatures', actions.syncLeaseSignatures);

app.post('/parties/:partyId/importMovingOut', validatePartyId, requiresRight(Rights.MODIFY_PARTY), actions.importMovingOut);
app.post('/parties/:partyId/importCancelMoveout', validatePartyId, requiresRight(Rights.MODIFY_PARTY), actions.importCancelMoveout);

app.post('/templates/mjmlToHtml', actions.mjmlToHtml);
app.post('/templates/mjmlComponentToHtml', actions.mjmlComponentToHtml);
app.get('/templates/:propertyId/shortCodes', actions.getTemplatesShortCodes);
app.post('/templates/:templateId/render', actions.renderTemplate);
app.post('/templates/:templateName/renderByName', actions.renderTemplateByName);

app.get('/sftpUsers', actions.getSftpUsers);

// Renewals
app.post('/renewals', validatePartyId, actions.createRenewal);

app.post('/sendCustomerOldRentDefermentDoc', actions.sendCustomerOldRentDefermentDoc);

// endpoints used only for testing
app.patch('/test/updateInvite', actions.updateInvite);
app.post('/test/clearQueues', actions.clearQueues);
app.post('/test/disableRecurringJobs', actions.disableRecurringJobs);
app.post('/test/enableRecurringJobs', actions.enableRecurringJobs);
app.post('/test/createGuestApplication', actions.createGuestApplication);
app.post('/test/tenant/forceLogout', actions.forceLogout);
app.post('/test/tenant/disableAutomaticLogout', actions.disableAutomaticLogout);
app.post('/test/createTruncateFn', actions.createTruncanteFn);
app.post('/test/schema/truncate', actions.truncateSchemaTables);
app.post('/test/deassignPhoneNumbers', actions.deassignPhoneNumbers);
app.get('/test/availableCucumberPhoneNumber', actions.getAnAvailableCucumberPhoneNumber);
app.get('/test/program', actions.getProgramByEmailIdentifier);

app.post('/webhooks/guest-sms-receiver', actions.fakeSmsReceiver);
app.post('/test/sendGuestSMS', actions.sendGuestSMS);
app.post('/test/sendGuestEmail', actions.sendGuestEmail);
app.post('/test/verifyGuestReceivedMessageFromNumber', actions.verifyGuestReceivedMessageFromNumber);
app.post('/test/verifyEmailIsDeliveredToGuest', actions.verifyEmailIsDeliveredToGuest);
app.post('/test/replyToEmailWith', actions.replyToEmailWith);
app.post('/test/deleteMessagesFromNumber', actions.deleteMessagesFromNumber);
app.get('/test/createDummyParty', actions.createDummyParty);
app.post('/test/importActiveLeases', actions.importActiveLeases);
app.post('/test/appointment', actions.createAnAppointmentForParty);

app.get('/test/communications', actions.getCommunicationsForParty);
app.patch('/test/tenants/:tenantId/feePricing/:propertyId', actions.updateFeePricingByPropertyId);

app.use('/zendesk/login', actions.zendeskLogin);
app.use('/zendesk/logout', actions.zendeskLogout);
app.get('/zendesk/generatePrivateContentToken', actions.zendeskPrivateContentToken);

app.use('/sisense/login', actions.loginToSisense);

app.get('/health/db', actions.checkDatabase);
app.get('/health/ws', actions.checkWebSocket);
app.get('/health/mq', actions.checkMessageQueue);

app.post('/notifyVersion', notifyVersion(config));

// Set of public API, all endpoints should be cleaned-up before moving here
app.all('/public/*', middleware.jwtAuthorizationHandler(getApiPaths(openPaths)), docVersionHandler, requestTrackingHandler);
app.get('/public/party/:partyId/users/:role', validatePartyId, publicRoutes.getUsersWithRoleForParty);
app.get('/public/party/:partyId/screeningReports', validatePartyId, publicRoutes.getScreeningReports);
app.post('/public/party/:partyId/tasks', validatePartyId, publicRoutes.createTask);
app.patch('/public/party/:partyId/tasks', validatePartyId, publicRoutes.updateTask);
app.post('/public/party/:partyId/email', validatePartyId, publicRoutes.sendPartyEmail);
app.post('/public/party/:partyId/score', validatePartyId, validate({ body: schema.PartyScoreSchema }), publicRoutes.updatePartyScore);
app.post('/public/party/:partyId/delayedMessages', validatePartyId, publicRoutes.sendDelayedCustomMessage);
app.post('/public/party/:partyId/sendComm', validatePartyId, publicRoutes.sendComm);
app.post('/public/party/:partyId/partyMember', validatePartyId, publicRoutes.createPartyMember);
app.post('/public/party/:partyId/reassignParty', validatePartyId, publicRoutes.reassignParty);
app.post('/public/party/:partyId/archiveParty', validatePartyId, publicRoutes.archiveParty);
if (config.isDemoEnv) {
  app.patch('/public/party/:partyId', validatePartyId, actions.updateParty);
  app.post('/public/communications', actions.addCommunication);
  app.patch('/public/communications', actions.updateCommunications);
}

app.get('/floatingAgents/availability/:userId/:startDate/:endDate', actions.getAgentAvailability);
app.post('/floatingAgents/availability', actions.saveAgentAvailability);

app.get('/sickLeaves/user/:userId', actions.getAgentSickLeaves);
app.post('/sickLeaves/', actions.addSickLeave);
app.patch('/sickLeaves/:sickLeaveId', actions.removeSickLeave);

app.get('/cohortComms/posts', requiresRight(Rights.MODIFY_POSTS), actions.getPosts);
app.post('/cohortComms/post', requiresRight(Rights.MODIFY_POSTS), actions.createPost);
app.patch('/cohortComms/post', requiresRight(Rights.MODIFY_POSTS), actions.updatePost);
app.delete('/cohortComms/post', requiresRight(Rights.MODIFY_POSTS), actions.deletePost);
app.post('/cohortComms/post/send', requiresRight(Rights.MODIFY_POSTS), middleware.mapOriginalName, actions.sendPost);
app.post('/cohortComms/post/recipient', requiresRight(Rights.MODIFY_POSTS), upload, middleware.mapOriginalName, actions.uploadRecipientFile);
app.patch('/cohortComms/post/retract', requiresRight(Rights.MODIFY_POSTS), actions.retractPost);
app.delete('/cohortComms/post/recipient', requiresRight(Rights.MODIFY_POSTS), actions.deleteRecipientFile);
app.get('/cohortComms/post/:recipientFileId/download', requiresRight(Rights.MODIFY_POSTS), actions.downloadRecipientFile);
app.get('/cohortComms/draftPosts', requiresRight(Rights.MODIFY_POSTS), actions.getDraftPosts);
app.get('/cohortComms/post/:postId', requiresRight(Rights.MODIFY_POSTS), actions.getPostById);
app.get('/cohortComms/post/:postId/downloadResult', requiresRight(Rights.MODIFY_POSTS), actions.downloadPostRecipientFile);

app.post('/resident/invite', actions.sendResidentInviteMail);

app.get('/sheets/:sheetName', actions.getSheetData);
app.post('/sheets', actions.updateDBFromSheets);

// marketing
const v1Router = new express.Router();
bindRoutes(v1Router);

app.use('/v1', v1Router);

v1Router.post('/marketing/session', middleware.ignoreBot, actions.handleMarketingContact);

v1Router.post('/marketing/forms', actions.handleMarketingForm);
v1Router.post('/marketing/guestCard', actions.handleWebInquiry);
v1Router.get('/marketing/appointment/availableSlots', actions.getAvailableSlots);
v1Router.get('/marketing/appointment/:token', actions.getAppointmentForSelfService);
v1Router.patch('/marketing/appointment/:token', actions.updateAppointmentFromSelfService);

v1Router.get('/marketing/properties', actions.getMarketingProperties);
v1Router.get('/marketing/properties/:propertyId/layoutGroup/:marketingLayoutGroupId/layouts', middleware.ignoreBot, actions.getMarketingLayoutGroup);
v1Router.get('/marketing/property/:propertyId', actions.getMarketingProperty);
v1Router.post('/marketing/properties/search', actions.searchMarketingProperties);
v1Router.post('/marketing/properties/:propertyId/search', actions.searchRelatedProperties);
v1Router.get('/marketing/inventory/:inventoryId', actions.getMarketingInventory);
v1Router.get('/marketing/inventory/:inventoryId/pricing', actions.getMarketingInventoryPricing);
v1Router.get('/marketing/inventory/:inventoryId/quoteQuestions', actions.getMarketingInventoryQuoteQuestions);

v1Router.post('/marketing/inventory', actions.getMarketingInventoryAndLayouts);
v1Router.patch('/marketing/party/:partyId/preferences', actions.updateMarketingPartyPreferences);

v1Router.post('/marketing/chatbot/conversation', actions.chatbotConversation);

// this endpoint triggers the sandbox creation on the operational environment
app.post('/university/requestSandboxCreation', actions.requestSandboxCreation);
app.post('/university/getSandboxUrl', actions.getSandboxUrl);

// these endpoints run on the university environment
app.post('/university/autoLogin', actions.autoLogin);
app.post('/university/createSandbox', actions.createSandbox);
app.post('/university/checkSandboxStatus', actions.checkSandboxStatus);

// Fallback route not found handler
app.use('*', middleware.notFoundHandler());

// Fallback error handler
app.use(errorHandler());

// Start processing DB notifications
export const processDBEvents = () => {
  const { processEvents } = require('./events_processor');
  return processEvents();
};

export default app;
