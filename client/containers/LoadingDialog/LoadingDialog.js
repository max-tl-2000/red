/*
 * Copyright (c) 2022 Reva Technology Inc., all rights reserved.
 * Unauthorized copying of this file, via any medium is strictly prohibited
 * Licensed under the Elastic License 2.0; you may not use this file except
 * in compliance with the Elastic License 2.0.
 */

import React from 'react';
import { Dialog, DialogOverlay, Typography as T, PreloaderBlock } from 'components';
import { cf } from './LoadingDialog.scss';

export const LoadingDialog = props => {
  const { open, id, label } = props;

  return (
    <Dialog open={open} id={id} forceFocusOnDialog closeOnEscape>
      <DialogOverlay className={cf('loading-dialog')} container={false}>
        <PreloaderBlock className={cf('spinner')} />
        <T.Title className={cf('loading-label')}>{label}</T.Title>
      </DialogOverlay>
    </Dialog>
  );
};
