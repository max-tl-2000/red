/*
 * Copyright (c) 2022 Reva Technology Inc., all rights reserved.
 * Unauthorized copying of this file, via any medium is strictly prohibited
 * Licensed under the Elastic License 2.0; you may not use this file except
 * in compliance with the Elastic License 2.0.
 */

import eventTypes from 'enums/eventTypes';
import { logger } from 'client/logger';
import { socketClient } from './socket-client';
import { emitServerStarted } from '../../../client/helpers/notify-version';
import { removeTokenFromObject } from '../../../common/helpers/logger-utils';

export const initSocketListener = ({ application, auth }) => {
  socketClient.on(eventTypes.PAYMENT_RECEIVED, async (e, data) => {
    try {
      logger.trace({ e, data: removeTokenFromObject(data) }, 'Got payment received WS event');
      const { personApplicationId, partyApplicationId } = data;
      if (personApplicationId === application.personApplicationId) {
        // TODO: would be better to simply set the paymentComplete step
        // of the model, and let that trigger whatever is supposed to
        // happen next

        application.redirectToAdditionalInfo(auth.token, !application.continueWithoutPayment);
      } else if (partyApplicationId === application.partyApplicationId) {
        await application.fetchApplicant({ forceFetch: true });
        await application.details.applicationFees.fetchFees(true);
      }
    } catch (err) {
      logger.error({ err }, 'Error handling payment received event!');
    }
  });
  socketClient.on(eventTypes.WAIVE_APPLICATION_FEE, async (e, data) => {
    try {
      const { personApplicationId } = data;
      if (personApplicationId === application.personApplicationId) {
        await application.details.applicationFees.fetchFees(true);
      }
    } catch (err) {
      logger.error({ err }, 'Error handling waive application fee event!');
    }
  });
  socketClient.on(eventTypes.BROADCAST_WEB_UPDATED, (e, data) => emitServerStarted(data));
};
