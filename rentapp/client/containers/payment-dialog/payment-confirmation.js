/*
 * Copyright (c) 2022 Reva Technology Inc., all rights reserved.
 * Unauthorized copying of this file, via any medium is strictly prohibited
 * Licensed under the Elastic License 2.0; you may not use this file except
 * in compliance with the Elastic License 2.0.
 */

import PropTypes from 'prop-types';
import React from 'react';
import { observer } from 'mobx-react';
import SubHeader from 'components/Typography/SubHeader';
import { PreloaderBlock, Icon } from 'components';
import { t } from 'i18next';
import { cf } from './payment-confirmation.scss';

export const PaymentConfirmation = observer(({ agent, confirmingPayment = true, errorMessage }) => {
  if (confirmingPayment) {
    return (
      <div className={cf('payment-confirmation')}>
        <PreloaderBlock />
        <SubHeader>{t('CONFIRMING_PAYMENT')}</SubHeader>
        <SubHeader>{t('DONT_CLOSE_THIS_WINDOW')}</SubHeader>
      </div>
    );
  }
  return (
    <div className={cf('payment-confirmation')}>
      <Icon className={cf('alert')} name={'alert'} />
      {errorMessage && <SubHeader>{errorMessage}</SubHeader>}
      {!errorMessage && [
        <SubHeader key="paymentError">{t('PAYMENT_PROCESSED_ERROR')}</SubHeader>,
        <SubHeader key="paymentErrorDescription">{t('PAYMENT_PROCESSED_ERROR_DESCRIPTION')}</SubHeader>,
      ]}
      <div className={cf('agent')}>
        <SubHeader bold>{agent.fullName}</SubHeader>
        <SubHeader>{agent.email}</SubHeader>
        <SubHeader>{agent.displayPhoneNumber}</SubHeader>
      </div>
    </div>
  );
});

PaymentConfirmation.propTypes = {
  agent: PropTypes.object,
};
