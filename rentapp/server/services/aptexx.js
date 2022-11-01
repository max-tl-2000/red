/*
 * Copyright (c) 2022 Reva Technology Inc., all rights reserved.
 * Unauthorized copying of this file, via any medium is strictly prohibited
 * Licensed under the Elastic License 2.0; you may not use this file except
 * in compliance with the Elastic License 2.0.
 */

import { SUCCESSFUL_CARD_NUMBER, SUCCESS_STATUS, FAILURE_STATUS, CANCELED_STATUS } from '../../common/fake-aptexx-constants';
import loggerModule from '../../../common/helpers/logger';
const logger = loggerModule.child({ subType: 'Aptexx Simulation' });

const validateCardNumber = cardNumber => {
  if (cardNumber === SUCCESSFUL_CARD_NUMBER) {
    return {
      status: SUCCESS_STATUS,
      redirectUrl: 'payment-success.html',
    };
  }
  return { status: FAILURE_STATUS };
};

export const fakeSubmitPayment = payment =>
  new Promise(resolve => {
    setTimeout(() => resolve(validateCardNumber(payment.cardnumber)), 3000);
  });

export const fakeCancelPayment = invoiceId => {
  logger.info({ invoiceId }, 'Payment has been cancelled');
  return { status: CANCELED_STATUS };
};
