/*
 * Copyright (c) 2022 Reva Technology Inc., all rights reserved.
 * Unauthorized copying of this file, via any medium is strictly prohibited
 * Licensed under the Elastic License 2.0; you may not use this file except
 * in compliance with the Elastic License 2.0.
 */

import xmlParser from 'express-xml-bodyparser';
import { actions } from './actions/actions-proxy';
import { requiresRight } from '../../../server/api/requires-right';
import { Rights, SystemRoles } from '../../../common/acd/rights';

const replacePersonIdForMergedPersonOnAuthUser = (req, res, next) => {
  const replacePersonIdForMergedPersonOnAuthUserFn = require('./middleware').replacePersonIdForMergedPersonOnAuthUser;

  return replacePersonIdForMergedPersonOnAuthUserFn(req, res, next);
};

// for XML body parser - see https://www.npmjs.com/package/express-xml-bodyparser
const xml2jsDefaults = {
  explicitArray: true,
  normalize: false,
  normalizeTags: false,
  trim: true,
};

export const setupApis = app => {
  app.get('/partyApplications/:partyApplicationId/documents', actions.getDocumentsMetadataByPartyApplicationId);

  app.get('/partyApplication/current/applicationData', actions.getPartyApplicationApplicationData);
  app.patch('/partyApplication/current/applicationData', actions.updatePartyApplicationApplicationData);

  app.post('/personApplications/current/screeningData', actions.createOrUpdatePersonApplication);
  app.patch('/personApplications/current', actions.completePersonApplication);
  app.post('/personApplications/current/events', actions.saveEvent);

  app.get('/personApplications/current/additionalData', actions.getPersonApplicationAdditionalData);
  app.patch('/personApplications/current/additionalData', actions.updatePersonApplicationAdditionalData);
  app.get('/personApplications/current/documents/:documentId/retrieve', actions.getApplicationDocumentByDocId);

  app.get('/personApplications/:personApplicationId', actions.getPersonApplication);
  app.patch('/personApplications/:personApplicationId', actions.updatePersonApplication);

  app.post('/webhooks/screeningResponse', xmlParser(xml2jsDefaults), actions.handleScreeningResponse);

  app.get('/applicant', actions.getApplicant);
  app.get('/applications', actions.getApplications);
  app.get('/applicationSettings/:propertyId/partyType/:partyType/memberType/:memberType', actions.getApplicationSettings);

  app.post('/webhooks/paymentNotification', actions.handlePaymentNotification);

  app.post('/parties/:partyId/holdApplicationStatus', requiresRight(Rights.MODIFY_PARTY), actions.holdApplicationStatus);
  app.get('/parties/:partyId/rerunScreening', requiresRight(Rights.MODIFY_PARTY), actions.rerunScreening);
  app.post('/parties/:partyId/rescreen', requiresRight(SystemRoles.IS_REVA_ADMIN_USER), actions.forceRescreening);
  app.get('/party/:partyId/personApplications', actions.getPersonApplicationsByPartyId);
  app.get('/personApplications/:personApplicationId/documents', actions.getDocumentsForPersonApplication);
  app.get('/personApplications/:personApplicationId/fees', actions.getFeesByPersonApplication);

  app.get('/personApplications/documents/:documentId/category', actions.getDocumentCategory);

  app.post('/payment/initiate', replacePersonIdForMergedPersonOnAuthUser, actions.initiatePayment);

  app.get('/screeningSummary/:partyId', actions.getScreeningSummary);
  app.get('/screeningSummary/:partyId/view/report', actions.getScreeningReportSummary);

  app.get('/fullStory/content', actions.getFullStoryContent);

  app.patch('/applicationFeeWaivers', actions.updateWaivedFee);

  app.post('/validResetToken', actions.validResetToken);
};
