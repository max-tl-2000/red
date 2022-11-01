/*
 * Copyright (c) 2022 Reva Technology Inc., all rights reserved.
 * Unauthorized copying of this file, via any medium is strictly prohibited
 * Licensed under the Elastic License 2.0; you may not use this file except
 * in compliance with the Elastic License 2.0.
 */

import { t } from 'i18next';
import React from 'react';
import { MsgBox, Typography as T } from 'components';

const RerunScreeningDialog = ({ open, closeDialog, onRerunScreening, expiredDays }) => (
  <MsgBox
    open={open}
    title={t('RERUN_SCREENING')}
    lblOK={t('PROCEED')}
    onOKClick={() => onRerunScreening && onRerunScreening()}
    lblCancel={t('CANCEL')}
    onCloseRequest={closeDialog}
    content={
      <div>
        <T.Text>{t('RERUN_SCREENING_PROPERTY_CHARGED')}</T.Text>
        <br />
        <T.Text>{t('RERUN_SCREENING_PROSPECT_CREDIT_CHECK', { count: expiredDays })}</T.Text>
        <br />
        <T.Text>{t('RERUN_SCREENING_CONFIRMATION')}</T.Text>
      </div>
    }
  />
);

export default RerunScreeningDialog;
