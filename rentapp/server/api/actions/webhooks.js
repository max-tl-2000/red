/*
 * Copyright (c) 2022 Reva Technology Inc., all rights reserved.
 * Unauthorized copying of this file, via any medium is strictly prohibited
 * Licensed under the Elastic License 2.0; you may not use this file except
 * in compliance with the Elastic License 2.0.
 */

import path from 'path';
import { sendMessage } from '../../../../server/services/pubsub';
import { APP_EXCHANGE, SCREENING_MESSAGE_TYPE } from '../../../../server/helpers/message-constants';
import { InternalServerError } from '../../../../server/common/errors';
import logger from '../../../../common/helpers/logger';
import { removeTokenFromObject } from '../../../../common/helpers/logger-utils';
import { read } from '../../../../common/helpers/xfs';

/*
 * handleScreeningResponse  which should call sendMessage with this new type. The message should simply contain the
 *                          raw XML from the response
 * @param {Object or String} screeningResponse - screeningResponse (may be XML string or already parsed)
 */
export const handleScreeningResponse = async req => {
  try {
    if (req.body instanceof String) {
      throw new InternalServerError('handleScreeningResponse expects req.body to be an Object');
    }
    await sendMessage({
      exchange: APP_EXCHANGE,
      key: SCREENING_MESSAGE_TYPE.SCREENING_RESPONSE_RECEIVED,
      message: {
        _noLog: true,
        screeningResponse: req.body,
      },
      ctx: req,
    });
    const response = await read(path.resolve(__dirname, '../../resources/fadv-success-response-template.xml'));
    logger.info('Screening response handled successfully');
    const result = {
      content: response,
      type: 'xml',
      httpStatusCode: 200,
    };
    return result;
  } catch (error) {
    logger.error({ error }, 'Error while handling the screening response');
    throw new InternalServerError('ERROR_HANDLING_SCREENING_RESPONSE');
  }
};

/**
 * handlePaymentNotification simply posts the received request to the queue
 */
export const handlePaymentNotification = async req => {
  // Should we validate here?
  logger.trace({ body: req.body, paymentNotificationQuery: removeTokenFromObject(req.query) }, 'handlePaymentNotification');
  await sendMessage({
    exchange: APP_EXCHANGE,
    key: SCREENING_MESSAGE_TYPE.PAYMENT_NOTIFICATION_RECEIVED,
    message: { ...req.query, ...req.body },
    ctx: req,
  });
  return { status: 1 }; // expected by mock form - aptexx doesn't care as long as they get a 200
};
