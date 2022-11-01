/*
 * Copyright (c) 2022 Reva Technology Inc., all rights reserved.
 * Unauthorized copying of this file, via any medium is strictly prohibited
 * Licensed under the Elastic License 2.0; you may not use this file except
 * in compliance with the Elastic License 2.0.
 */

import PropTypes from 'prop-types';
import React from 'react';
import { t } from 'i18next';
import { Typography as T, Button, Dialog, DialogOverlay, DialogActions } from 'components';
import { cf } from './DeleteTenantConfirmationDialog.scss';

const DeleteTenantConfirmationDialog = ({ open, tenant, onClickCancel, onClickDelete }) => (
  <Dialog type="modal" open={open} onCloseRequest={onClickCancel}>
    <DialogOverlay className={cf('mainContent')} title={t('DELETE_TENANT')}>
      <div>
        <T.Text>{t('DELETE_TENANT_CONFIRMATION_MESSAGE', { tenant: tenant.name })}</T.Text>
      </div>
      <DialogActions>
        <Button type="flat" btnRole="secondary" label={t('CANCEL')} data-action="close" />
        <Button type="flat" btnRole="primary" label={t('DELETE')} onClick={() => onClickDelete(tenant)} />
      </DialogActions>
    </DialogOverlay>
  </Dialog>
);

DeleteTenantConfirmationDialog.propTypes = {
  open: PropTypes.bool,
  tenant: PropTypes.object,
  onClickCancel: PropTypes.func,
  onClickDelete: PropTypes.func,
};

export default DeleteTenantConfirmationDialog;
