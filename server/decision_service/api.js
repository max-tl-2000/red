/*
 * Copyright (c) 2022 Reva Technology Inc., all rights reserved.
 * Unauthorized copying of this file, via any medium is strictly prohibited
 * Licensed under the Elastic License 2.0; you may not use this file except
 * in compliance with the Elastic License 2.0.
 */

import express from 'express';
import bodyParser from 'body-parser';

import { routeHandler, jwtAuthorizationHandler, notFoundHandler, noIndexRobotsHeader } from '../common/middleware';
import { setLogMiddleware } from '../../common/server/logger-middleware';
import { setDefaultAPIHeaderSecurity } from '../common/securityMiddleware';
import * as actions from './actions';
import logger from '../../common/helpers/logger';
import { setRequestMiddleware } from '../../common/server/request-middleware';
import { errorHandler } from '../common/errorMiddleware';

const app = express();

app.use(noIndexRobotsHeader());
app.use(bodyParser.urlencoded({ extended: false, limit: '10000mb' }));
app.use(bodyParser.json({ limit: '10000mb' }));

setRequestMiddleware({ app });
setLogMiddleware({ app, logger });

setDefaultAPIHeaderSecurity(app);

app.get('/ping', async (req, res) => {
  logger.trace({ ctx: req }, 'ping');
  res.send('ok');
});

const openPaths = [];

const routeMethods = ['get', 'put', 'post', 'patch', 'delete'];
const router = {};

routeMethods.forEach(method => {
  router[method] = app[method].bind(app);
  app[method] = (route, ...routeMiddleware) => {
    if (!routeMiddleware.length) {
      return router[method](route); // probably this is app.get('settingName');
    }

    const [routeAction] = routeMiddleware.splice(routeMiddleware.length - 1, 1);
    if (!routeAction) {
      logger.error({ route }, 'Could not find action for route');
      throw new Error(`Missing action for route ${route}`);
    }
    return router[method](route, ...routeMiddleware, routeHandler(routeAction));
  };
});

app.use(jwtAuthorizationHandler(openPaths));

app.post('/:version/party/scoring', actions.handlePartyScoring);
app.post('/:version/party/scoringCorticon', actions.handlePartyScoringViaCorticon);
app.post('/:version/party/screening', actions.handlePartyScreening);
app.post('/:version/party/customMessages', actions.handleCustomMessage);
app.post('/:version/party/handleCai', actions.handlePartyCai);
app.post('/:version/tasks/completeContactInfo', actions.handleCompleteContactInfo);
app.post('/:version/tasks/counterSign', actions.handleCounterSign);
app.post('/:version/tasks/introduceYourself', actions.handleIntroduceYourself);
app.post('/:version/tasks/reviewApplication', actions.handleReviewApplication);
app.post('/:version/tasks/removeAnonymousEmail', actions.handleRemoveAnonymousEmail);
app.post('/:version/tasks/contactBack', actions.handleContactBack);
app.post('/:version/tasks/promoteApplication', actions.handlePromoteApplication);
app.post('/:version/tasks/sendContract', actions.handleSendContract);
app.post('/:version/tasks/sendRenewalQuote', actions.handleSendRenewalQuote);
app.post('/:version/tasks/sendRenewalReminder', actions.handleSendRenewalReminder);
app.post('/:version/tasks/collectServiceAnimalDoc', actions.handleCollectServiceAnimalDoc);
app.post('/:version/tasks/collectEmergencyContact', actions.handleCollectEmergencyContact);
app.post('/:version/tasks/contactPartyDeclinedDecision', actions.handleContactPartyDeclinedDecision);
app.post('/:version/email/appointment', actions.handleAppointment);
app.post('/:version/email/lease', actions.handleLease);
app.post('/:version/email/registration', actions.handlePayment);
app.post('/:version/email/applicationDeclined', actions.handleApplicationUpdates);
app.post('/:version/email/quote', actions.handleQuote);
app.post('/:version/email/personApplicationInvite', actions.handlePersonApplicationInvite);
app.post('/:version/email/residentsInvite', actions.handleResidentsInvite);
app.post('/:version/corticon/request', actions.handleCorticonDecisionRequest);
app.post('/:version/party/partyMember', actions.handleCreatePartyMemberDecision);
app.post('/:version/party/reassign', actions.handleReassignPartyDecision);

// Fallback route not found handler
app.use('*', notFoundHandler());

// Fallback error handler
app.use(errorHandler());

export default app;
