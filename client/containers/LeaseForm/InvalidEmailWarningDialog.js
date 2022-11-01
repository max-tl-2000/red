/*
 * Copyright (c) 2022 Reva Technology Inc., all rights reserved.
 * Unauthorized copying of this file, via any medium is strictly prohibited
 * Licensed under the Elastic License 2.0; you may not use this file except
 * in compliance with the Elastic License 2.0.
 */

import { t } from 'i18next';
import React from 'react';
import { MsgBox } from 'components';

export const InvalidEmailWarningDialog = ({ open, onCloseDialog, onAddEmailAddress }) => (
  <MsgBox
    open={open}
    title={t('CANNOT_PUBLISH_LEASE')}
    lblOK={t('ADD_EMAIL_ADDRESS')}
    onOKClick={() => onAddEmailAddress && onAddEmailAddress()}
    lblCancel={t('CANCEL')}
    onCloseRequest={() => onCloseDialog && onCloseDialog()}
    content={t('MISSING_EMAIL_WARNING_CONTENT')}
  />
);
