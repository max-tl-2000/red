/*
 * Copyright (c) 2022 Reva Technology Inc., all rights reserved.
 * Unauthorized copying of this file, via any medium is strictly prohibited
 * Licensed under the Elastic License 2.0; you may not use this file except
 * in compliance with the Elastic License 2.0.
 */

import { t } from 'i18next';
import React from 'react';
import { MsgBox } from 'components';

const NoLeaseTemplateWarningDialog = ({ open, closeDialog }) => (
  <MsgBox
    open={open}
    title={t('NO_LEASE_TEMPLATE_AVAILABLE_TITLE')}
    lblOK={t('OK')}
    hideCancelButton
    onCloseRequest={closeDialog}
    content={t('NO_LEASE_TEMPLATE_AVAILABLE_TEXT')}
  />
);

export default NoLeaseTemplateWarningDialog;
