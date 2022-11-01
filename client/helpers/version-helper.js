/*
 * Copyright (c) 2022 Reva Technology Inc., all rights reserved.
 * Unauthorized copying of this file, via any medium is strictly prohibited
 * Licensed under the Elastic License 2.0; you may not use this file except
 * in compliance with the Elastic License 2.0.
 */

import { t } from 'i18next';
import mediator from './mediator';
import { notifyVersion } from './notify-version';
import cfg from './cfg';
import { window } from '../../common/helpers/globals';

window.mediator = mediator;

export const initVersionHelper = apiClient => {
  let reloadMessageDisplayed = false;

  const checkVersion = args => {
    const buildVersion = cfg('buildVersion');

    if (`${buildVersion}` === `${args.version}` || reloadMessageDisplayed) return;

    reloadMessageDisplayed = true;
    const refreshWindow = () => window.location.reload(true);
    const close = () => {
      reloadMessageDisplayed = false;
    };

    notifyVersion({
      text: t('RELOAD_MESSAGE'),
      buttonLabel: t('RELOAD_ACTION_LABEL'),
      onRefresh: refreshWindow,
      onHide: close,
    });
  };

  mediator.on('user:login', async () => {
    const { buildVersion: version } = await apiClient.post('/buildVersion', { noPrefix: true });
    checkVersion({ version });
  });

  mediator.on('red-server:start', (e, args) => checkVersion(args));
};
