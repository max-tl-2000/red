/*
 * Copyright (c) 2022 Reva Technology Inc., all rights reserved.
 * Unauthorized copying of this file, via any medium is strictly prohibited
 * Licensed under the Elastic License 2.0; you may not use this file except
 * in compliance with the Elastic License 2.0.
 */

import { expect } from 'chai';
import newId from 'uuid/v4';
import config from '../config';
import { waitFor } from '../../../../server/testUtils/apiHelper';
import { setupConsumers } from '../../../../server/workers/consumer';
import { chan, createResolverMatcher } from '../../../../server/testUtils/setupTestGlobalContext';
import { sendMessage } from '../../../../server/services/pubsub';
import { existsApplicationTransaction } from '../../services/application-transactions';
import { setFakeTransactions } from '../../payment/adapters/fake-provider';
import { YEAR_MONTH_DAY_FORMAT } from '../../../../common/date-constants';
import { testCtx as ctx, createAProperty, createAFee } from '../../../../server/testUtils/repoHelper';
import { createAPersonApplication, createAnApplicationInvoice } from '../../test-utils/repo-helper.js';
import { now } from '../../../../common/helpers/moment-utils';

describe('transaction handler', () => {
  const transactionsWorkerConfig = config.workerConfig.paymentTransactions;
  const exchangeName = transactionsWorkerConfig.exchange;
  const FETCH_AND_STORE = Object.keys(transactionsWorkerConfig.topics)[0];
  const day = now().format(YEAR_MONTH_DAY_FORMAT);
  const baseTransaction = {
    firstName: 'James',
    lastName: 'Bond',
    accountNumber: 'asdf',
    email: 'name@test.com',
    phone: '2131111111',
    channelType: 'DEBIT',
    brandType: 'VISA',
    lastFour: '5555',
  };
  const newTransaction = () => ({
    ...baseTransaction,
    integrationId: `${newId()}`,
  });

  const fakeTransactionData = {
    payments: [
      {
        ...newTransaction(),
        id: 12344,
        createdOn: 1487283952131,
        amount: 50000,
        grossAmount: 500495,
      },
      {
        ...newTransaction(),
        id: 12345,
        createdOn: 1487283952131,
        amount: 50000,
        grossAmount: 500495,
      },
    ],
    declines: [
      {
        ...newTransaction(),
        id: 12346,
        declinedOn: 1487630045098,
        declinedReason: 'Insufficient funds',
        amount: 50000,
        grossAmount: 500495,
      },
    ],
    voids: [
      {
        ...newTransaction(),
        id: 12347,
        voidedOn: 1487630045098,
        voidReason: 'duplicate payment',
        grossAmount: 500495,
      },
    ],
    refunds: [
      {
        ...newTransaction(),
        id: 12348,
        paymentId: 1235,
        createdOn: 1487630045098,
        amount: 10495,
      },
    ],
    reversals: [
      {
        ...newTransaction(),
        refId: 12349,
        createdOn: 1487630045099,
        amount: 10495,
        fee: 2000,
        description: 'The payment was charged back',
      },
    ],
  };

  const transactions = [];
  Object.keys(fakeTransactionData).forEach(key =>
    fakeTransactionData[key].forEach(item =>
      transactions.push({
        type: key.substring(0, key.length - 1),
        integrationId: item.integrationId,
        externalId: key !== 'reversals' ? item.id : item.refId,
      }),
    ),
  );

  const createRecordsAndSetProvider = async () => {
    const property = await createAProperty();
    const applicationFee = await createAFee({
      feeType: 'application',
      feeName: 'singleAppFee',
      absolutePrice: 100,
      propertyId: property.id,
    });

    setFakeTransactions(fakeTransactionData);

    return Promise.all(
      transactions.map(async transaction => {
        const personApplication = await createAPersonApplication({ firstName: 'Name' }, newId(), newId());
        return createAnApplicationInvoice({
          id: transaction.integrationId,
          applicationFeeId: applicationFee.id,
          applicationFeeAmount: applicationFee.absolutePrice,
          personApplicationId: personApplication.id,
          partyApplicationId: personApplication.partyApplicationId,
        });
      }),
    );
  };

  const initializeConsumers = async () => {
    const condition = msg => msg.fromDay === day;
    const { resolvers, promises } = waitFor([condition]);
    const matcher = createResolverMatcher(resolvers);
    await setupConsumers(chan(), matcher, ['paymentTransactions']);
    return promises;
  };

  describe('given a message to fetch and store payment trasactions', () => {
    xit('should create a new transaction for each value returned from the payment provider', async () => {
      await createRecordsAndSetProvider();
      const promises = await initializeConsumers();

      await sendMessage({
        exchange: exchangeName,
        key: FETCH_AND_STORE,
        message: {
          tenantId: ctx.tenantId,
          fromDay: day,
        },
        ctx,
      });
      await Promise.all(promises);

      const results = await Promise.all(
        transactions.map(transaction =>
          existsApplicationTransaction(ctx, {
            invoiceId: transaction.integrationId,
            transactionType: transaction.type,
            externalId: transaction.externalId,
          }),
        ),
      );

      const missingRecords = results.some(value => !value);
      expect(missingRecords).to.be.false;
    });
  });
});
