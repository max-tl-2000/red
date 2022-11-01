/*
 * Copyright (c) 2022 Reva Technology Inc., all rights reserved.
 * Unauthorized copying of this file, via any medium is strictly prohibited
 * Licensed under the Elastic License 2.0; you may not use this file except
 * in compliance with the Elastic License 2.0.
 */

import newId from 'uuid/v4';
import loggerModule from '../../common/helpers/logger';
const logger = loggerModule.child({ subType: 'transaction-proxy' });

export const makeTransactionProxy = (trx, originStack = '') => {
  let status = '';
  const trxStartTime = new Date();
  const trxId = newId();
  const MAX_TRANSACTION_DURATION = 10000;
  const warnOfLengthyTransaction = () => logger.error({ trxId, originStack, MAX_TRANSACTION_DURATION, trxStartTime }, 'Transaction max duration exceeded!');

  const timer = setTimeout(warnOfLengthyTransaction, MAX_TRANSACTION_DURATION);
  return new Proxy(trx, {
    get(target, name) {
      if (name === '__trxStatus') {
        return status;
      }
      if (name === 'trxId') {
        return trxId;
      }
      if (name === 'trxStartTime') return trxStartTime;

      const originalFn = target[name];

      if (name === 'commit' || name === 'rollback') {
        clearTimeout(timer);
        return (...args) => {
          if (status === 'committed' || status === 'rolledback') {
            logger.warn({ trxId }, `Transaction is already ${status}`);
            return null;
          }

          const retVal = originalFn.apply(target, args);

          if (name === 'commit') {
            status = 'committed';
          }

          if (name === 'rollback') {
            status = 'rolledback';
          }

          return retVal;
        };
      }

      return target[name];
    },
  });
};
