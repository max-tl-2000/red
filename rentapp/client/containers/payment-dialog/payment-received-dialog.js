/*
 * Copyright (c) 2022 Reva Technology Inc., all rights reserved.
 * Unauthorized copying of this file, via any medium is strictly prohibited
 * Licensed under the Elastic License 2.0; you may not use this file except
 * in compliance with the Elastic License 2.0.
 */

import { t } from 'i18next';
import React from 'react';
import { MsgBox } from 'components';
import SubHeader from 'components/Typography/SubHeader';
import Text from 'components/Typography/Text';
import { cf } from './payment-received-dialog.scss';

const PaymentReceivedDialog = ({ open, closeDialog, onPaymentReceived, onOpening, countDownSeconds }) => (
  <MsgBox
    open={open}
    closeOnEscape={false}
    title={t('PAYMENT_RECEIVED')}
    lblOK={t('OK_GOT_IT')}
    onOKClick={onPaymentReceived}
    onOpening={onOpening}
    lblCancel=""
    onCloseRequest={closeDialog}>
    <div className={cf('payment-received')}>
      <SubHeader>{t('PAYMENT_RECEIVED_MESSAGE')}</SubHeader>
      <Text className={cf('count-down')}>{t('PAYMENT_RECEIVED_TIMER', { seconds: countDownSeconds })}</Text>
    </div>
  </MsgBox>
);

export default PaymentReceivedDialog;
