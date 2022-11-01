/*
 * Copyright (c) 2022 Reva Technology Inc., all rights reserved.
 * Unauthorized copying of this file, via any medium is strictly prohibited
 * Licensed under the Elastic License 2.0; you may not use this file except
 * in compliance with the Elastic License 2.0.
 */

import mediator from '../helpers/mediator';
import cfg from '../helpers/cfg';
import FullStory from '../../common/helpers/fullStory';

const fullStoryConfig = cfg('fullStoryConfig', {});
const refreshFullStoryPeriod = fullStoryConfig.refreshPeriod || 600000;
const fullStory = new FullStory({ window, document, config: fullStoryConfig });

const refreshFullStory = async store => {
  const user = store.getState().auth.user;
  if (!user) return;

  try {
    fullStory.addOrUpdateWidget({ id: user.id, content: { ...user, displayName: user.fullName } });
  } catch (e) {
    console.error('error on refreshFullStory', e);
  }
  setTimeout(() => refreshFullStory(store), refreshFullStoryPeriod);
};

export const init = store => {
  mediator.on('user:login', () => {
    refreshFullStory(store);
  });

  mediator.on('user:logout', () => {
    fullStory.removeWidget();
  });
};
