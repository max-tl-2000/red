/*
 * Copyright (c) 2022 Reva Technology Inc., all rights reserved.
 * Unauthorized copying of this file, via any medium is strictly prohibited
 * Licensed under the Elastic License 2.0; you may not use this file except
 * in compliance with the Elastic License 2.0.
 */

import React from 'react';
import { MsgBox, Typography } from 'components';
import { t } from 'i18next';

const { Text } = Typography;

const ClosePartyAsResidentDialog = ({ open, onClosePartyAsResident, onCancelRequest }) => (
  <MsgBox
    open={open}
    appendToBody
    style={{ maxWidth: '35rem' }}
    closeOnTapAway={false}
    lblOK={t('CLOSE_AS_RESIDENT')}
    onOKClick={() => onClosePartyAsResident && onClosePartyAsResident()}
    title={t('CLOSE_PARTY_AS_RESIDENT_TITLE_DIALOG')}
    onCloseRequest={onCancelRequest}>
    <Text>{t('CLOSE_PARTY_AS_RESIDENT_TEXT_DIALOG')}</Text>
  </MsgBox>
);

export default ClosePartyAsResidentDialog;
