/*
 * Copyright (c) 2022 Reva Technology Inc., all rights reserved.
 * Unauthorized copying of this file, via any medium is strictly prohibited
 * Licensed under the Elastic License 2.0; you may not use this file except
 * in compliance with the Elastic License 2.0.
 */

// IMPORTANT
//
// When adding actions to this file do not forget to run
//
// ```bash
// node_modules/.bin/babel-node --extensions '.js,.ts' resources/bin/generate-require-from-actions.js
// ```
//
// The previous command will update the generated-actions-requires.json which is used to lazy load the actions

export { handleDeepLink } from './deep-link';
export { getLoginFlowSettings } from './settings';
export { getUserSettings } from './resident-properties';
export {
  getUserNotifications,
  getDirectMessages,
  handleIncomingDirectMessage,
  getUserPosts,
  getUserPost,
  markPostsAsRead,
  markPostAsClicked,
  markLinkAsVisited,
  markDirectMessagesAsRead,
} from './communications';
export {
  getPaymentInfo,
  deletePaymentMethodById,
  initiatePaymentMethod,
  handlePaymentMethodNotification,
  createPayment,
  initiateScheduledPayment,
  changeDefaultPaymentMethod,
  deleteScheduledPayment,
  handlePaymentMethodCallbackSuccess,
  handlePaymentMethodCallbackCancel,
  handleSchedulePaymentCallbackCancel,
  handleSchedulePaymentCallbackSuccess,
  getScheduledTransactions,
  markScheduledTransactionAsSeen,
} from './payment';

export { getMaintenanceTickets, createMaintenanceTicket, getMaintenanceTypes } from './maintenance';
export { createDevice, updateDevice } from './device';
export { getDataFromUnsubscribeToken, unsubscribePersonFromComms } from './unsubscription';

export { log } from './log';
