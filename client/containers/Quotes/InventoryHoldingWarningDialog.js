/*
 * Copyright (c) 2022 Reva Technology Inc., all rights reserved.
 * Unauthorized copying of this file, via any medium is strictly prohibited
 * Licensed under the Elastic License 2.0; you may not use this file except
 * in compliance with the Elastic License 2.0.
 */

import React from 'react';
import { MsgBox, Typography } from 'components';

const { Text } = Typography;

export const InventoryHoldingWarningDialog = ({ isOpen, model }) => {
  const { title, lblAction, handleOnActionClick, lblCancel, handleOnCancelClick, text, handleCloseRequest } = model;
  return (
    <MsgBox
      id="inventory-holding-warning-dialog"
      open={isOpen}
      title={title}
      lblOK={lblAction}
      onOKClick={handleOnActionClick}
      lblCancel={lblCancel}
      onCancelClick={handleOnCancelClick}
      onCloseRequest={handleCloseRequest}>
      <Text>{text}</Text>
    </MsgBox>
  );
};
