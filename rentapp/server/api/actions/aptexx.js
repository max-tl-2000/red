/*
 * Copyright (c) 2022 Reva Technology Inc., all rights reserved.
 * Unauthorized copying of this file, via any medium is strictly prohibited
 * Licensed under the Elastic License 2.0; you may not use this file except
 * in compliance with the Elastic License 2.0.
 */

import { fakeSubmitPayment, fakeCancelPayment } from '../../services/aptexx';
import { badRequestErrorIfNotAvailable } from '../../../../common/helpers/validators';

export const simulatePayment = req => {
  badRequestErrorIfNotAvailable([
    { property: req.body.name, message: 'MISSING_NAME' },
    { property: req.body.cardnumber, message: 'MISSING_CARD_NUMBER' },
    { property: req.body.expirationdate, message: 'MISSING_EXPIRATION_DATE' },
    { property: req.body.invoiceId, message: 'MISSING_INVOICE_ID' },
  ]);
  return fakeSubmitPayment(req.body);
};

export const cancelPayment = req => fakeCancelPayment(req.body.invoiceId);
