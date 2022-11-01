/*
 * Copyright (c) 2022 Reva Technology Inc., all rights reserved.
 * Unauthorized copying of this file, via any medium is strictly prohibited
 * Licensed under the Elastic License 2.0; you may not use this file except
 * in compliance with the Elastic License 2.0.
 */

import { MsgBox, Typography } from 'components';
import React from 'react';
import { t } from 'i18next';
const { Text } = Typography;

export const UnavailablePriceWarning = ({
  open,
  message,
  inventoryStatus,
  leaseTermsLengths,
  leaseStartDate,
  okLabel,
  cancelLabel,
  onOKClick,
  onCancelClick,
  onClose,
}) => (
  <MsgBox
    open={open}
    title={t('PRICE_NOT_AVAILABLE')}
    lblOK={t(okLabel)}
    onOKClick={onOKClick}
    lblCancel={t(cancelLabel)}
    onCancelClick={onCancelClick}
    onClose={onClose}>
    <Text>{t(message, { inventoryStatus, leaseTermLength: leaseTermsLengths && leaseTermsLengths.join(', '), leaseStartDate })}</Text>
  </MsgBox>
);
