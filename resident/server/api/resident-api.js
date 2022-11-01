/*
 * Copyright (c) 2022 Reva Technology Inc., all rights reserved.
 * Unauthorized copying of this file, via any medium is strictly prohibited
 * Licensed under the Elastic License 2.0; you may not use this file except
 * in compliance with the Elastic License 2.0.
 */

import Express from 'express';
import cors from 'cors';
import { actions } from './actions/actions-proxy';
import { registerEndpoint, add404HandlerForEndpoints } from '../common/register-endpoint';
import { tenantMiddleware, consumerTokenMiddleware, propertyMiddleware, webhookTokenMiddleware, emailTokenMiddleware } from './common-middlewares';

const registerPaymentMethodRoutes = residentsRouter => {
  // NOTE: the /paymentMethods end-points should not check for paymentModule flag except for initiatePaymentMethod
  registerEndpoint(residentsRouter, {
    method: 'delete',
    middlewares: [tenantMiddleware, consumerTokenMiddleware()],
    routePath: '/paymentMethods/:paymentMethodId',
    actionHandler: actions.deletePaymentMethodById,
  });

  registerEndpoint(residentsRouter, {
    method: 'patch',
    middlewares: [tenantMiddleware, consumerTokenMiddleware()],
    routePath: '/paymentMethods/changeDefault/:paymentMethodId',
    actionHandler: actions.changeDefaultPaymentMethod,
  });

  registerEndpoint(residentsRouter, {
    method: 'post',
    middlewares: [tenantMiddleware, webhookTokenMiddleware()],
    routePath: '/webhooks/paymentMethods',
    actionHandler: actions.handlePaymentMethodNotification,
  });

  registerEndpoint(residentsRouter, {
    method: 'post',
    middlewares: [tenantMiddleware, consumerTokenMiddleware(), propertyMiddleware({ requiredFeatures: ['paymentModule'] })],
    routePath: '/paymentMethods/initiate',
    actionHandler: actions.initiatePaymentMethod,
  });

  registerEndpoint(residentsRouter, {
    method: 'get',
    middlewares: [tenantMiddleware],
    routePath: '/paymentMethodCallback/success',
    actionHandler: actions.handlePaymentMethodCallbackSuccess,
    useHTMLResponsePage: true,
  });

  registerEndpoint(residentsRouter, {
    method: 'get',
    middlewares: [tenantMiddleware],
    routePath: '/paymentMethodCallback/cancel',
    actionHandler: actions.handlePaymentMethodCallbackCancel,
    useHTMLResponsePage: true,
  });

  registerEndpoint(residentsRouter, {
    method: 'get',
    middlewares: [tenantMiddleware, webhookTokenMiddleware()],
    routePath: '/schedulePaymentCallback/success',
    actionHandler: actions.handleSchedulePaymentCallbackSuccess,
    useHTMLResponsePage: true,
  });

  registerEndpoint(residentsRouter, {
    method: 'get',
    middlewares: [tenantMiddleware],
    routePath: '/schedulePaymentCallback/cancel',
    actionHandler: actions.handleSchedulePaymentCallbackSuccess,
    useHTMLResponsePage: true,
  });
};

export const setupResidentRoutes = app => {
  const residentsRouter = Express.Router(); // eslint-disable-line new-cap
  residentsRouter.use(cors());

  // this one actually returns the html for the deepLinking feature
  registerEndpoint(residentsRouter, {
    method: 'get',
    middlewares: [tenantMiddleware],
    routePath: '/deepLink',
    actionHandler: actions.handleDeepLink,
    useHTMLResponsePage: true,
  });

  registerEndpoint(residentsRouter, {
    method: 'get',
    middlewares: [tenantMiddleware, consumerTokenMiddleware(), emailTokenMiddleware],
    routePath: '/settings/user',
    actionHandler: actions.getUserSettings,
  });

  registerEndpoint(residentsRouter, {
    method: 'get',
    middlewares: [tenantMiddleware, consumerTokenMiddleware({ credentialsRequired: false }), emailTokenMiddleware],
    routePath: '/settings/loginFlow',
    actionHandler: actions.getLoginFlowSettings,
  });

  registerEndpoint(residentsRouter, {
    method: 'get',
    middlewares: [tenantMiddleware, consumerTokenMiddleware(), propertyMiddleware()],
    routePath: '/userNotifications',
    actionHandler: actions.getUserNotifications,
  });

  registerEndpoint(residentsRouter, {
    method: 'get',
    middlewares: [tenantMiddleware, consumerTokenMiddleware(), propertyMiddleware()],
    routePath: '/properties/:propertyId/directMessages',
    actionHandler: actions.getDirectMessages,
  });

  registerEndpoint(residentsRouter, {
    method: 'post',
    middlewares: [tenantMiddleware, consumerTokenMiddleware(), propertyMiddleware()],
    routePath: '/properties/:propertyId/directMessages',
    actionHandler: actions.handleIncomingDirectMessage,
  });

  registerEndpoint(residentsRouter, {
    method: 'post',
    middlewares: [tenantMiddleware, consumerTokenMiddleware(), propertyMiddleware()],
    routePath: '/properties/:propertyId/directMessages/markAsRead',
    actionHandler: actions.markDirectMessagesAsRead,
  });

  registerEndpoint(residentsRouter, {
    method: 'get',
    middlewares: [tenantMiddleware, consumerTokenMiddleware(), propertyMiddleware()],
    routePath: '/properties/:propertyId/posts',
    actionHandler: actions.getUserPosts,
  });

  registerEndpoint(residentsRouter, {
    method: 'get',
    middlewares: [tenantMiddleware, consumerTokenMiddleware(), propertyMiddleware()],
    routePath: '/properties/:propertyId/posts/:postId',
    actionHandler: actions.getUserPost,
  });

  registerEndpoint(residentsRouter, {
    method: 'post',
    middlewares: [tenantMiddleware, consumerTokenMiddleware(), propertyMiddleware()],
    routePath: '/properties/:propertyId/posts/markAsRead',
    actionHandler: actions.markPostsAsRead,
  });

  registerEndpoint(residentsRouter, {
    method: 'post',
    middlewares: [tenantMiddleware, consumerTokenMiddleware(), propertyMiddleware()],
    routePath: '/properties/:propertyId/posts/markAsClicked',
    actionHandler: actions.markPostAsClicked,
  });

  registerEndpoint(residentsRouter, {
    method: 'post',
    middlewares: [tenantMiddleware, consumerTokenMiddleware(), propertyMiddleware()],
    routePath: '/properties/:propertyId/posts/markLinkAsVisited',
    actionHandler: actions.markLinkAsVisited,
  });

  registerEndpoint(residentsRouter, {
    method: 'get',
    middlewares: [tenantMiddleware, consumerTokenMiddleware(), propertyMiddleware({ requiredFeatures: ['paymentModule'] })],
    routePath: '/properties/:propertyId/paymentInfo',
    actionHandler: actions.getPaymentInfo,
  });

  registerEndpoint(residentsRouter, {
    method: 'get',
    middlewares: [tenantMiddleware, consumerTokenMiddleware(), propertyMiddleware({ requiredFeatures: ['paymentModule'] })],
    routePath: '/properties/:propertyId/scheduledTransactions',
    actionHandler: actions.getScheduledTransactions,
  });

  registerEndpoint(residentsRouter, {
    method: 'post',
    middlewares: [tenantMiddleware, consumerTokenMiddleware(), propertyMiddleware({ requiredFeatures: ['paymentModule'] })],
    routePath: '/properties/:propertyId/scheduledTransactions/:providerTransactionId/seen',
    actionHandler: actions.markScheduledTransactionAsSeen,
  });

  registerEndpoint(residentsRouter, {
    method: 'post',
    middlewares: [tenantMiddleware, consumerTokenMiddleware(), propertyMiddleware({ requiredFeatures: ['paymentModule'], checkIfUserIsCurrentResident: true })],
    routePath: '/properties/:propertyId/payment',
    actionHandler: actions.createPayment,
  });

  registerEndpoint(residentsRouter, {
    method: 'get',
    middlewares: [
      tenantMiddleware,
      consumerTokenMiddleware(),
      propertyMiddleware({ requiredFeatures: ['maintenanceModule'], checkIfUserIsCurrentResident: false, checkIfUserIsPastResident: false }),
    ],
    routePath: '/properties/:propertyId/maintenanceInfo',
    actionHandler: actions.getMaintenanceTickets,
  });

  registerEndpoint(residentsRouter, {
    method: 'get',
    middlewares: [
      tenantMiddleware,
      consumerTokenMiddleware(),
      propertyMiddleware({ requiredFeatures: ['maintenanceModule'], checkIfUserIsCurrentResident: false, checkIfUserIsPastResident: false }),
    ],
    routePath: '/properties/:propertyId/maintenanceTypes',
    actionHandler: actions.getMaintenanceTypes,
  });

  registerEndpoint(residentsRouter, {
    method: 'post',
    middlewares: [tenantMiddleware, consumerTokenMiddleware()],
    routePath: '/device',
    actionHandler: actions.createDevice,
  });

  registerEndpoint(residentsRouter, {
    method: 'patch',
    middlewares: [tenantMiddleware, consumerTokenMiddleware()],
    routePath: '/device/:deviceId',
    actionHandler: actions.updateDevice,
  });

  registerEndpoint(residentsRouter, {
    method: 'post',
    middlewares: [
      tenantMiddleware,
      consumerTokenMiddleware(),
      propertyMiddleware({ requiredFeatures: ['maintenanceModule'], checkIfUserIsCurrentResident: true }),
    ],
    routePath: '/properties/:propertyId/maintenanceTickets',
    actionHandler: actions.createMaintenanceTicket,
  });

  registerEndpoint(residentsRouter, {
    method: 'post',
    routePath: '/unsubscribeToken',
    actionHandler: actions.getDataFromUnsubscribeToken,
  });

  registerEndpoint(residentsRouter, {
    method: 'post',
    routePath: '/unsubscribe/person',
    actionHandler: actions.unsubscribePersonFromComms,
  });

  registerEndpoint(residentsRouter, {
    method: 'post',
    middlewares: [tenantMiddleware, consumerTokenMiddleware(), propertyMiddleware({ requiredFeatures: ['paymentModule'], checkIfUserIsCurrentResident: true })],
    routePath: '/properties/:propertyId/initiateScheduledPayment',
    actionHandler: actions.initiateScheduledPayment,
  });

  registerEndpoint(residentsRouter, {
    method: 'delete',
    middlewares: [tenantMiddleware, consumerTokenMiddleware(), propertyMiddleware({ requiredFeatures: ['paymentModule'], checkIfUserIsCurrentResident: true })],
    routePath: '/properties/:propertyId/scheduledPayments',
    actionHandler: actions.deleteScheduledPayment,
  });

  registerEndpoint(residentsRouter, {
    method: 'post',
    middlewares: [consumerTokenMiddleware()],
    routePath: '/log',
    actionHandler: actions.log,
  });

  registerPaymentMethodRoutes(residentsRouter);

  add404HandlerForEndpoints(residentsRouter);

  app.use('/resident/api/', residentsRouter);
};
