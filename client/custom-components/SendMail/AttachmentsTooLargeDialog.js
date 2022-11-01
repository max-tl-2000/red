/*
 * Copyright (c) 2022 Reva Technology Inc., all rights reserved.
 * Unauthorized copying of this file, via any medium is strictly prohibited
 * Licensed under the Elastic License 2.0; you may not use this file except
 * in compliance with the Elastic License 2.0.
 */

import React from 'react';
import { t } from 'i18next';
import { Dialog, DialogOverlay, Button, DialogActions, DialogHeader, DialogTitle, FormattedMarkdown } from 'components';
import { maximumAttachmentSizeInMB } from 'helpers/emailAttachmentHelper';
import { cf } from './AttachmentsTooLargeDialog.scss';

export default function AttachmentsTooLargeDialog({ open, onCloseRequest }) {
  return (
    <Dialog open={open} onCloseRequest={onCloseRequest}>
      <DialogOverlay>
        <DialogHeader className={cf('dialog-header')}>
          <DialogTitle>{t('FILES_TOO_LARGE')}</DialogTitle>
        </DialogHeader>
        <FormattedMarkdown>
          {`${t('ATTACHMENTS_TOO_LARGE_TEXT', {
            sizeInMB: maximumAttachmentSizeInMB,
          })}`}
        </FormattedMarkdown>
        <DialogActions>
          <Button type="flat" label={t('MSG_BOX_BTN_OK')} data-action="close" />
        </DialogActions>
      </DialogOverlay>
    </Dialog>
  );
}
