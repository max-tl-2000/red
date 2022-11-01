/*
 * Copyright (c) 2022 Reva Technology Inc., all rights reserved.
 * Unauthorized copying of this file, via any medium is strictly prohibited
 * Licensed under the Elastic License 2.0; you may not use this file except
 * in compliance with the Elastic License 2.0.
 */

import { PaymentProviderInterface } from './payment-provider-interface';
import rand from '../../../../common/helpers/rand';
import { DALTypes } from '../../../../common/enums/DALTypes';

const fakeProviderOptions = {
  fakeTransactions: {
    payments: [],
    declines: [],
    voids: [],
    refunds: [],
    reversals: [],
  },
};

// We need to expose a way configure transaction in the provider to get diferent values
export const setFakeTransactions = transactions => {
  fakeProviderOptions.fakeTransactions = transactions;
};

export class FakeProvider extends PaymentProviderInterface {
  constructor() {
    super(DALTypes.PaymentProviderMode.FAKE);
  }

  async initiatePayment(paymentData) {
    const { tenantId, invoice } = paymentData;
    const integrationId = this.generateIntegrationId();
    const formUrl = await this.getPaymentLink({ tenantId, invoiceId: integrationId, invoice });
    const { id: invoiceId } = await this.createInvoice({ tenantId }, { ...invoice, id: integrationId });
    this.assertIntegrationId({ tenantId }, integrationId, invoiceId);
    return { invoiceId, formUrl };
  }

  async getPaymentLink({ tenantId, invoiceId, invoice }) {
    const guest = await this.fakeCreateGuest({ tenantId, invoiceId, invoice });
    return guest.link;
  }

  fakeCreateGuest({ tenantId, invoiceId, invoice }) {
    const { personApplicationId, propertyId } = invoice;
    const token = this.createToken(tenantId);
    // This is simulating the create guest api, thats why is using a promise
    return new Promise(resolve =>
      setTimeout(() => {
        const fakeResponse = {
          link: encodeURI(
            `/mock-payment-form.html?invoiceId=${invoiceId}&tenantId=${tenantId}&personApplicationId=${personApplicationId}&propertyId=${propertyId}&token=${token}`,
          ),
        };
        resolve(fakeResponse);
      }, rand(5000)),
    );
  }

  async getTransactionsFromProvider() {
    return new Promise(resolve => setTimeout(() => resolve(fakeProviderOptions.fakeTransactions), rand(5000)));
  }

  async getTransactions(ctx, options = {}) {
    const targetIds = await this.getTargetIds(ctx, options);
    return Promise.all(
      targetIds.map(async targetId => ({
        targetId,
        transactions: await this.getTransactionsFromProvider(targetId),
      })),
    );
  }

  getPaymentTargetAccounts = ctx => this.getTargetAccounts(ctx);

  /**
   * Gets all accounts and associated data accessible by the api user. Each account can have many payment targets.
   * A targetId will be required for most API calls.
   * @param {string} tenantName - Tenant name.
   * @return {Object[]} Output is the collection of accounts.
   * */
  async getAccounts() {
    return new Promise(resolve =>
      setTimeout(() => {
        const fakeAccounts = {
          accounts: [
            {
              id: 101141,
              name: 'harris',
              clientId: 100091,
              clientName: 'Reva',
              active: true,
              targets: [
                {
                  id: 12007954,
                  type: 'holdAccount',
                },
                {
                  id: 12007959,
                  type: 'applicationAccount',
                },
              ],
            },
            {
              id: 101142,
              name: 'swparkme',
              clientId: 100091,
              clientName: 'Reva',
              active: true,
              targets: [
                {
                  id: 12007955,
                  type: 'holdAccount',
                },
                {
                  id: 12007960,
                  type: 'applicationAccount',
                },
              ],
            },
          ],
        };
        resolve(fakeAccounts);
      }, rand(5000)),
    );
  }
}
