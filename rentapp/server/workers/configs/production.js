/*
 * Copyright (c) 2022 Reva Technology Inc., all rights reserved.
 * Unauthorized copying of this file, via any medium is strictly prohibited
 * Licensed under the Elastic License 2.0; you may not use this file except
 * in compliance with the Elastic License 2.0.
 */

/* eslint-disable global-require */
import { APP_EXCHANGE, SCREENING_MESSAGE_TYPE, TRANSACTIONS_MESSAGE_TYPE } from '../../../../server/helpers/message-constants';
import envVal from '../../../../common/helpers/env-val';

module.exports = {
  workerConfig: () => {
    const { processTransactions } = require('../payment/transactions-handler');
    const { handleScreeningSubmitViewRequestReceived } = require('../screening/helpers/screening-report-request-handler-helper');
    const { handlePollScreeningUnreceivedResponses } = require('../screening/screening-polling-handler');
    const { handleScreeningResponseReceived } = require('../screening/screening-handler-response');
    const { handlePaymentNotificationReceived } = require('../payment/payment-handler');

    const {
      handlePaymentProcessed,
      handleApplicantDataUpdated,
      handleApplicationHoldStatusChanged,
      handlePartyMembersChanged,
      handleQuotePublished,
      handleScreeningResponseValidation,
      handleLongRunningScreeningRequests,
      handleRerunExpiredScreening,
      handleForceRecreeningRequested,
      handleAdminSsnSendChanged,
      handleStuckRequestDetected,
      handleApplicantMemberTypeChanged,
      handlePartyArchivedOrClosed,
      // for version 2
      handleRequestApplicantReport,
    } = require('../screening/screening-handler');

    return {
      screening: {
        exchange: APP_EXCHANGE,
        queue: 'screening_queue',
        topics: {
          [SCREENING_MESSAGE_TYPE.PAYMENT_PROCESSED]: handlePaymentProcessed,
          [SCREENING_MESSAGE_TYPE.SCREENING_RESPONSE_RECEIVED]: handleScreeningResponseReceived,
          [SCREENING_MESSAGE_TYPE.PAYMENT_NOTIFICATION_RECEIVED]: handlePaymentNotificationReceived,
          [SCREENING_MESSAGE_TYPE.APPLICANT_DATA_UPDATED]: handleApplicantDataUpdated,
          [SCREENING_MESSAGE_TYPE.APPLICATION_HOLD_STATUS_CHANGED]: handleApplicationHoldStatusChanged,
          [SCREENING_MESSAGE_TYPE.PARTY_MEMBERS_CHANGED]: handlePartyMembersChanged,
          [SCREENING_MESSAGE_TYPE.QUOTE_PUBLISHED]: handleQuotePublished,
          [SCREENING_MESSAGE_TYPE.SCREENING_RESPONSE_VALIDATION]: handleScreeningResponseValidation,
          [SCREENING_MESSAGE_TYPE.POLL_SCREENING_UNRECEIVED_RESPONSES]: handlePollScreeningUnreceivedResponses,
          [SCREENING_MESSAGE_TYPE.SCREENING_SUBMIT_VIEW_REQUEST_RECEIVED]: handleScreeningSubmitViewRequestReceived,
          [SCREENING_MESSAGE_TYPE.LONG_RUNNING_SCREENING_REQUESTS]: handleLongRunningScreeningRequests,
          [SCREENING_MESSAGE_TYPE.RERUN_EXPIRED_SCREENING]: handleRerunExpiredScreening,
          [SCREENING_MESSAGE_TYPE.FORCE_RESCREENING_REQUESTED]: handleForceRecreeningRequested,
          [SCREENING_MESSAGE_TYPE.PARTY_CLOSED]: handlePartyArchivedOrClosed,
          [SCREENING_MESSAGE_TYPE.PARTY_ARCHIVED]: handlePartyArchivedOrClosed,
          [SCREENING_MESSAGE_TYPE.SEND_SSN_CHANGED]: handleAdminSsnSendChanged,
          [SCREENING_MESSAGE_TYPE.STUCK_REQUEST_DETECTED]: handleStuckRequestDetected,
          [SCREENING_MESSAGE_TYPE.APPLICANT_MEMBER_TYPE_CHANGED]: handleApplicantMemberTypeChanged,

          // for version 2
          [SCREENING_MESSAGE_TYPE.REQUEST_APPLICANT_REPORT]: handleRequestApplicantReport,
        },
        noOfConsumers: envVal('RED_SCREENING_MESSAGE_NUMBER_OF_CONSUMERS', 5),
      },
      paymentTransactions: {
        exchange: APP_EXCHANGE,
        queue: 'payment_transactions_queue',
        topics: {
          [TRANSACTIONS_MESSAGE_TYPE.FETCH_AND_STORE]: processTransactions,
        },
      },
    };
  },
};
