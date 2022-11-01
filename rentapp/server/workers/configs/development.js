/*
 * Copyright (c) 2022 Reva Technology Inc., all rights reserved.
 * Unauthorized copying of this file, via any medium is strictly prohibited
 * Licensed under the Elastic License 2.0; you may not use this file except
 * in compliance with the Elastic License 2.0.
 */

const config = {
  workerConfig: {
    screening: {
      queue: 'dev_screening_queue',
    },
    paymentTransactions: {
      queue: 'dev_payment_transactions_queue',
    },
  },
};

module.exports = config;
