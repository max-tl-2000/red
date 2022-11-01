/*
 * Copyright (c) 2022 Reva Technology Inc., all rights reserved.
 * Unauthorized copying of this file, via any medium is strictly prohibited
 * Licensed under the Elastic License 2.0; you may not use this file except
 * in compliance with the Elastic License 2.0.
 */

import { observable, action, computed } from 'mobx';
import { t } from 'i18next';
import { logger } from 'client/logger';
import { INITIATE_PAYMENT_STATUS } from '../../common/payment-constants';
import { doAndRetry } from '../../../common/helpers/attempt';

export default class PaymentModel {
  @observable
  _errorMessage;

  @observable
  _errorToken;

  @observable
  _status;

  // initial, loading, success, error
  @observable
  _response;

  @computed
  get isPaymentInProgress() {
    return this._status === 'loading';
  }

  @computed
  get success() {
    return this._status === 'success';
  }

  @computed
  get error() {
    return this._status === 'error';
  }

  @computed
  get response() {
    return this._response || {};
  }

  @computed
  get paymentProviderUrl() {
    return this.response.formUrl;
  }

  @computed
  get invoiceId() {
    return this.response.invoiceId;
  }

  constructor({ apiClient } = {}) {
    this.apiClient = apiClient;
  }

  @action
  abort() {
    const { _requestPromise = {} } = this;

    if (_requestPromise.abort) {
      _requestPromise.abort();
    }
  }

  @action
  setSuccessResult(response) {
    this._status = 'success';
    this._response = response;
    this._requestPromise = null;
    this._errorToken = null;
  }

  @action
  setErrorResult({ token }) {
    this._status = 'error';
    // the following should be better as it is better to know which error came from the server
    // this._errorMessage = t(error.token || error.message); could be used if provided
    // if we don't care we can just set here our own error message
    this._errorMessage = t('INITIATE_PAYMENT_ERROR_MESSAGE');
    this._errorToken = token;
    this._response = null;
    this._requestPromise = null;
  }

  @action
  clearErrorToken() {
    this._errorToken = null;
  }

  @computed
  get paymentStatus() {
    if (this.error) {
      return INITIATE_PAYMENT_STATUS.FAILED;
    }

    if (this.success) {
      if (this.response.alreadyPaid) {
        return INITIATE_PAYMENT_STATUS.ALREADY_PAID;
      }

      return INITIATE_PAYMENT_STATUS.SUCCESS;
    }

    return INITIATE_PAYMENT_STATUS.NOT_SUBMITTED;
  }

  @computed
  get initiatePaymentFailed() {
    return this.paymentStatus === INITIATE_PAYMENT_STATUS.FAILED;
  }

  @computed
  get shouldReprocessInitiatePayment() {
    return this.initiatePaymentFailed && this._errorToken === INITIATE_PAYMENT_STATUS.MISSING_WAIVER_AMOUNT;
  }

  doAndRetryPayment = async data =>
    await doAndRetry(
      async () => {
        this._requestPromise = this.apiClient.post('/payment/initiate', { data });
        return await this._requestPromise;
      },
      {
        maxAttempts: 3,
        waitBetweenAttempts: 1000,
        couldBeCancelled: true,
        onAttemptFail: ({ error, attemptNumber }) => {
          const logMessage = `attempt #${attemptNumber}, failed`;
          if (attemptNumber === 1) {
            logger.warn({ error, attemptNumber }, logMessage);
          } else {
            logger.error({ error, attemptNumber }, logMessage);
          }
          return error.token === INITIATE_PAYMENT_STATUS.MISSING_WAIVER_AMOUNT;
        },
        onFail: ({ error, cancelled }) => {
          if (cancelled) {
            throw error;
          }
          logger.error('initiatePayment: no more attempts left');
          throw new Error('Unable to connect the payment provider');
        },
      },
    );

  @action
  async initiatePayment(payment, personApplicationId) {
    try {
      this._status = 'loading';
      this._errorMessage = '';
      this._errorToken = null;

      const data = { ...payment };

      data.invoice = {
        ...data.invoice,
        personApplicationId,
      };

      if (this._requestPromise && this._requestPromise.abort) {
        // abort previous requests if no completed
        // and a new call to initiatePayment was issued
        this._requestPromise.abort();
      }

      const response = await this.doAndRetryPayment(data);

      this.setSuccessResult(response);
    } catch (error) {
      logger.error({ error }, 'initiatePayment error');
      this.setErrorResult(error);
    }
  }
}
