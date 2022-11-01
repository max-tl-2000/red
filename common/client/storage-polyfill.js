/*
 * Copyright (c) 2022 Reva Technology Inc., all rights reserved.
 * Unauthorized copying of this file, via any medium is strictly prohibited
 * Licensed under the Elastic License 2.0; you may not use this file except
 * in compliance with the Elastic License 2.0.
 */

export const isStorageSupported = storageName => {
  const storage = window[storageName];
  const key = '__red__testKey';
  try {
    storage.removeItem(key);
    const storageCount = storage.length;
    storage.setItem(key, 'test-value');
    return storage.length - storageCount === 1;
  } catch (err) {
    return false;
  } finally {
    try {
      storage && storage.removeItem && storage.removeItem(key);
    } catch (err) {
      console.error(`Cannot remove the test key from ${storageName}`, err);
    }
  }
};

export const polyfillStorage = () => {
  if (isStorageSupported('localStorage')) return;

  const { CookieStorage } = require('cookie-storage'); // eslint-disable-line
  const cookieStorage = new CookieStorage({
    path: '/',
    domain: location.hostname,
    expires: new Date(2030, 0, 1),
    secure: true,
  });

  const SPrototype = Storage.prototype;

  SPrototype.getItem = key => cookieStorage.getItem(key);
  SPrototype.setItem = (key, val) => cookieStorage.setItem(key, val);
  SPrototype.removeItem = key => cookieStorage.removeItem(key);
  SPrototype.clear = () => cookieStorage.clear();
  SPrototype.key = index => cookieStorage.key(index);
};
