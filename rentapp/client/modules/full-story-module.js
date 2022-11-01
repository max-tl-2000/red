/*
 * Copyright (c) 2022 Reva Technology Inc., all rights reserved.
 * Unauthorized copying of this file, via any medium is strictly prohibited
 * Licensed under the Elastic License 2.0; you may not use this file except
 * in compliance with the Elastic License 2.0.
 */

import { observe } from 'mobx';
import cfg from 'helpers/cfg';
import { apiClient } from './api-client';
import FullStory from '../../../common/helpers/fullStory';

const fullStoryConfig = cfg('fullStoryConfig') || {};
const { includeAllConsumer } = fullStoryConfig;
const refreshFullStoryPeriod = fullStoryConfig.refreshPeriod || 600000;
const fullStory = new FullStory({ window, document, config: fullStoryConfig });
const AUTH_TOKEN_PROP_NAME = 'token';
const AUTH_IMPERSONATOR_PROP_NAME = 'impersonatorUserId';

const refreshFullStory = async store => {
  const isImpersonatedApplication = store.isAuthenticated && store.isImpersonation;
  if (!includeAllConsumer && !isImpersonatedApplication) return;

  try {
    const content = await apiClient.get('/fullStory/content');
    fullStory.addOrUpdateWidget({ id: content.personId, content });
  } catch (e) {
    console.error('error on refreshFullStory', e);
  }
  setTimeout(() => refreshFullStory(store), refreshFullStoryPeriod);
};

export const init = store => {
  refreshFullStory(store);

  observe(store, change => {
    if ([AUTH_TOKEN_PROP_NAME, AUTH_IMPERSONATOR_PROP_NAME].includes(change.name)) {
      if (change.newValue == null) {
        fullStory.removeWidget();
        return;
      }
      refreshFullStory(store);
    }
  });
};
