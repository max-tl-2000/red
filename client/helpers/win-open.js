/*
 * Copyright (c) 2022 Reva Technology Inc., all rights reserved.
 * Unauthorized copying of this file, via any medium is strictly prohibited
 * Licensed under the Elastic License 2.0; you may not use this file except
 * in compliance with the Elastic License 2.0.
 */

import React from 'react';
import { t } from 'i18next';
import { window } from '../../common/helpers/globals';
import { showMsgBox } from '../components/MsgBox/showMsgBox';
import * as T from '../components/Typography/Typography';
import FormattedMarkdown from '../components/Markdown/FormattedMarkdown';

const showingPopup = {};

export const windowOpen = (url, target) => {
  if (!url) throw new Error('No url was provided');

  const cleanPopupCache = () => {
    delete showingPopup[url]; // make sure we just remove the entry so the next time the popup can be opened again
  };

  if (showingPopup[url]) return;

  showingPopup[url] = true;

  const otherWindow = window.open(url, target || '_blank');

  if (otherWindow) {
    otherWindow.opener = null;
    otherWindow.location = url;
    cleanPopupCache();
  } else {
    const msgBoxOptions = {
      title: t('WINDOW_COULD_NOT_BE_OPENED'),
      lblOK: '',
      btnCancelRole: 'secondary',
      onClose: cleanPopupCache,
    };

    const close = showMsgBox(
      <div>
        <FormattedMarkdown>{t('IT_SEEMS_THE_LINK_WAS_BLOCKED')}</FormattedMarkdown>
        <T.Link style={{ wordWrap: 'break-word' }} onClick={() => close()} rel="noopener noreferrer" target="_blank" href={url}>
          {t('OPEN_LINK')}
        </T.Link>
      </div>,
      msgBoxOptions,
    );
  }
};
