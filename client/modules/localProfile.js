/*
 * Copyright (c) 2022 Reva Technology Inc., all rights reserved.
 * Unauthorized copying of this file, via any medium is strictly prohibited
 * Licensed under the Elastic License 2.0; you may not use this file except
 * in compliance with the Elastic License 2.0.
 */

import debounce from 'debouncy';
import mediator from '../helpers/mediator';
import tryParse from '../../common/helpers/try-parse';
import clsc from '../../common/helpers/coalescy';
import { lsGet, lsSave } from '../helpers/ls';

let userId;
const cachedProfile = {};
const THRESHOLD_TO_SAVE = 400;

const createProfile = (id = userId, data = {}) => {
  const sync = debounce(() => {
    if (!id) {
      throw new Error('Cannot sync the profile without a userId. Probably a missing call to init or user is not logged in');
    }
    lsSave(`profile-${id}`, JSON.stringify(data));
  }, THRESHOLD_TO_SAVE);

  return {
    get(key, def) {
      return clsc(data[key], def);
    },
    set(key, val) {
      data[key] = val;
      sync();
    },
  };
};

export const getProfile = (id = userId) => {
  if (!id) {
    id = 'anonymous';
  }

  if (!cachedProfile[id]) {
    if (id === 'anonymous') {
      console.warn('loading anonymous profile');
    } else {
      console.info('loading profile for', id);
    }

    const userProfileAsString = lsGet(`profile-${id}`, '');
    cachedProfile[id] = createProfile(id, tryParse(userProfileAsString, {}));
  }

  return cachedProfile[id];
};

const removeProfileObject = id => {
  if (id) {
    cachedProfile[id] = null;
  }
};

export const init = () => {
  mediator.on('user:login', (e, { user }) => {
    userId = user.id;
    getProfile(userId);
  });

  mediator.on('user:logout', (e, { user = {} }) => {
    removeProfileObject(user.id);
  });
};
