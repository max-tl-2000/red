/*
 * Copyright (c) 2022 Reva Technology Inc., all rights reserved.
 * Unauthorized copying of this file, via any medium is strictly prohibited
 * Licensed under the Elastic License 2.0; you may not use this file except
 * in compliance with the Elastic License 2.0.
 */

import React, { Component } from 'react';
import { observer, inject } from 'mobx-react';
import { computed, observable, action } from 'mobx';
import { Dialog, DialogOverlay, DialogHeader, Button, PreloaderBlock } from 'components';
import { t } from 'i18next';
import { logger } from 'client/logger';
import { cf } from './payment-dialog.scss';
import tryParse from '../../../../common/helpers/try-parse';
import { PAYMENT_TRANSACTION_REDIRECTED, PAYMENT_TRANSACTION_CANCELED } from '../../../common/fake-aptexx-constants';
import { PaymentConfirmation } from './payment-confirmation';
import { INITIATE_PAYMENT_STATUS } from '../../../common/payment-constants';

const TIMEOUT_NOTIFICATION_PAYMENT = 60000;

@inject('application', 'auth', 'screen')
@observer
export class PaymentDialog extends Component {
  @observable
  displayingPaymentDialog;

  @observable
  waitingForPaymentConfirmation;

  @observable
  listeningForMessage;

  @observable
  isPaymentIframeLoadingCompleted;

  @action
  resetState = () => {
    this.displayingPaymentDialog = true;
    this.waitingForPaymentConfirmation = true;
  };

  // This is called when we get a postMessage from payment-success or
  // payment-canceled
  handleSuccessfulPay = e => {
    const { onCanceledPay } = this.props;
    logger.debug('got postMessage after redirect');
    if (e.origin.indexOf(window.location.host) >= 0) {
      const message = tryParse(e.data.message, {});
      if (message.action === PAYMENT_TRANSACTION_REDIRECTED) {
        logger.debug('postMessage was success redirect');
        this.onTransactionCompleted();
      }
      if (message.action === PAYMENT_TRANSACTION_CANCELED) {
        logger.debug('postMessage was cancel redirect');
        onCanceledPay && onCanceledPay();
      }
    } else {
      logger.warn({ event: e }, 'Unexpected origin');
    }
  };

  @action
  startListening = () => {
    logger.trace('listening for message events');
    const { listeningForMessage } = this;
    if (!listeningForMessage) {
      // sometimes during debugging, it's possible to have multiple listeners installed
      window.addEventListener('message', this.handleSuccessfulPay, false);

      this.listeningForMessage = true;

      logger.trace('back from adding listener');
    }
  };

  @action
  stopListening = () => {
    logger.trace('no longer listening for message events');
    window.removeEventListener('message', this.handleSuccessfulPay, false);
    this.listeningForMessage = false;
    this.isPaymentIframeLoadingCompleted = false;
  };

  @computed
  get model() {
    return this.props.model || {};
  }

  initiatePayment = () => {
    const {
      applicantDetails,
      application: {
        personApplicationId,
        quoteId,
        propertyInfo: { propertyId },
      },
    } = this.props;
    const { model } = this;

    const { holdDepositFees, applicationFees, waiverApplicationFees } = this.props.application.details.applicationFees;
    const applicationFee = applicationFees[0] || {};
    const holdDepositFee = holdDepositFees[0] || {};
    const applicationFeeWaiver = waiverApplicationFees[0] || {};

    model.initiatePayment(
      {
        invoice: {
          quoteId: quoteId || null,
          propertyId: propertyId || '',
          applicationFeeId: applicationFee.feeId,
          applicationFeeName: applicationFee.feeName,
          applicationFeeAmount: applicationFee.amount,
          holdDepositFeeId: holdDepositFee.selected ? holdDepositFee.feeId : null,
          holdDepositFeeName: holdDepositFee.selected ? holdDepositFee.feeName : null,
          holdDepositFeeIdAmount: holdDepositFee.selected ? holdDepositFee.amount : null,
          applicationFeeWaiverAmount: applicationFeeWaiver.amount || null,
          applicationWaiverFeeName: applicationFeeWaiver.feeName,
        },
        ...applicantDetails,
      },
      personApplicationId,
    );
  };

  onOpening = () => {
    this.startListening();
    this.resetState();
    this.initiatePayment();
  };

  @action
  handleConfirmationTimeout = async () => {
    logger.warn('Timed out waiting for confirmation - will poll one time');
    const paymentCompleted = await this.props.application.fetchPaymentCompleted();
    logger.debug({ paymentCompleted }, 'Back from fetchPaymentCompleted');
    if (paymentCompleted) {
      logger.warn('payment completed but got no notification');
      // parent will be responsible for closing us in this case
      this.props.application.redirectToAdditionalInfo(this.props.auth.token);
    } else {
      logger.warn('payment not completed but got redirect');
      this.waitingForPaymentConfirmation = false;
    }
  };

  // this is called when we get the postMessage from payment-success
  @action
  onTransactionCompleted = () => {
    logger.debug('onTransactionCompleted');
    this.displayingPaymentDialog = false;
    this.props.application.setPaymentDialogToWaitingMode(true);
    // NOTE: Apparently we might be receiving more than one postMessage
    // to avoid creating 3 timers, just clear the previous created one
    // last timer will be honored in this case
    clearTimeout(this.confirmationTimeoutTimer);
    this.confirmationTimeoutTimer = setTimeout(() => this.handleConfirmationTimeout(), TIMEOUT_NOTIFICATION_PAYMENT);
    logger.debug('timeout has been set');
  };

  cancelPayment = () => {
    logger.trace('cancelPayment');
    const { onCanceledPay } = this.props;
    onCanceledPay && onCanceledPay();
  };

  renderDialogHeader = () => (
    <DialogHeader key="paymentHeader" title={t('PAYMENT')} className={cf('payment-header')}>
      <Button type="flat" btnRole="primary" label={t('CLOSE')} onClick={this.cancelPayment} />
    </DialogHeader>
  );

  @computed
  get isAptxUrl() {
    const { paymentProviderUrl } = this.model;
    return paymentProviderUrl && (paymentProviderUrl.search('aptexx') > 0 || paymentProviderUrl.search('aptx') > 0);
  }

  handleOnLoadPaymentIframe = () => {
    this.isPaymentIframeLoadingCompleted = true;
  };

  renderIframe = isXSmall => {
    const { isPaymentInProgress, paymentProviderUrl, initiatePaymentFailed } = this.model;
    const paymentIframe = this.isAptxUrl ? 'aptx-iframe' : 'fake-iframe';
    if (initiatePaymentFailed) return undefined;

    if (!isPaymentInProgress) {
      return (
        <div key="paymentFrame" style={{ height: '100%' }}>
          {!this.isPaymentIframeLoadingCompleted && <PreloaderBlock key="paymentPreloader" className={cf('iframe-preloader', { isXSmall })} />}
          <iframe
            title="paymentFrame"
            id="paymentFrame"
            data-component="payment-iframe"
            src={paymentProviderUrl}
            className={cf(paymentIframe, { isXSmall })}
            onLoad={this.handleOnLoadPaymentIframe}
            onError={this.handleErrorPaymentIframe}
          />
        </div>
      );
    }

    return <PreloaderBlock key="paymentPreloader" className={cf('iframe-preloader', { isXSmall })} />;
  };

  redirectIfAlreadyPaid = paymentStatus => {
    if (paymentStatus !== INITIATE_PAYMENT_STATUS.ALREADY_PAID) return;

    logger.info('user already paid - redirecting to part 2');
    this.props.application.redirectToAdditionalInfo(this.props.auth.token);
  };

  checkPayment() {
    const { paymentStatus } = this.model;
    this.redirectIfAlreadyPaid(paymentStatus);
  }

  componentDidMount() {
    this.checkPayment();
  }

  componentDidUpdate() {
    this.checkPayment();
  }

  render = () => {
    const { dialogOpen, application, screen } = this.props;
    const { displayingPaymentDialog, waitingForPaymentConfirmation, isAptxUrl } = this;

    const { paymentStatus, errorMessage } = this.model;

    const initiatePaymentFailed = paymentStatus === INITIATE_PAYMENT_STATUS.FAILED;

    const dialogBody = isAptxUrl ? 'aptx-dialog-body' : 'fake-dialog-body';
    const { leasingAgent } = application;

    const { isXSmall } = screen;
    const dialogType = isXSmall ? 'fullscreen' : 'modal';

    return (
      <Dialog type={dialogType} open={dialogOpen} onOpening={this.onOpening} onClose={this.stopListening} onCloseRequest={this.cancelPayment}>
        <DialogOverlay id="paymentDialog" className={cf(dialogBody)} container={false} noMaxWidth={isXSmall} noMaxHeight={isXSmall}>
          {displayingPaymentDialog && [this.renderDialogHeader(), this.renderIframe(isXSmall)]}
          {!displayingPaymentDialog && <PaymentConfirmation agent={leasingAgent} confirmingPayment={waitingForPaymentConfirmation} />}
          {initiatePaymentFailed && <PaymentConfirmation agent={leasingAgent} confirmingPayment={false} errorMessage={errorMessage} />}
          {!waitingForPaymentConfirmation && this.renderDialogHeader()}
        </DialogOverlay>
      </Dialog>
    );
  };
}
