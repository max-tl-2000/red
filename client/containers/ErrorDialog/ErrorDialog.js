/*
 * Copyright (c) 2022 Reva Technology Inc., all rights reserved.
 * Unauthorized copying of this file, via any medium is strictly prohibited
 * Licensed under the Elastic License 2.0; you may not use this file except
 * in compliance with the Elastic License 2.0.
 */

import React from 'react';
import { Dialog, DialogOverlay, Typography as T, DialogActions, Button, DialogHeader } from 'components';
import { t } from 'i18next';
import { cf } from './ErrorDialog.scss';

export const ErrorDialog = props => {
  const { open, id, onClose, label } = props;

  return (
    <Dialog open={open} id={id} forceFocusOnDialog closeOnEscape>
      <DialogOverlay className={cf('loading-dialog')} container={false}>
        <DialogHeader title={t('SOMETHING_WENT_WRONG')} rightSideIcon={'alert'} rightSideIconClassName={cf('right-icon')} />
        <T.Text className={cf('info-text')}>{label}</T.Text>
        <DialogActions className={cf('actions')}>
          <Button type="flat" btnRole="secondary" id="submitAssignedProperty" onClick={onClose} label={t('CLOSE')} />
        </DialogActions>
      </DialogOverlay>
    </Dialog>
  );
};
