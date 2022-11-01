/*
 * Copyright (c) 2022 Reva Technology Inc., all rights reserved.
 * Unauthorized copying of this file, via any medium is strictly prohibited
 * Licensed under the Elastic License 2.0; you may not use this file except
 * in compliance with the Elastic License 2.0.
 */

import React from 'react';
import { MsgBox, FormattedMarkdown } from 'components';
import { t } from 'i18next';

const ContactBlockedPreviouslyDialog = ({ open, onClosePartyAsSpam, onCancelRequest }) => (
  <MsgBox
    open={open}
    appendToBody
    style={{ maxWidth: '35rem' }}
    closeOnTapAway={false}
    lblOK={t('CLOSE_AS_SPAM')}
    onOKClick={() => onClosePartyAsSpam && onClosePartyAsSpam()}
    title={t('CLOSE_AS_SPAM_TITLE_DIALOG')}
    onCloseRequest={onCancelRequest}>
    <FormattedMarkdown>{t('CLOSE_AS_SPAM_TEXT_DIALOG')}</FormattedMarkdown>
  </MsgBox>
);

export default ContactBlockedPreviouslyDialog;
