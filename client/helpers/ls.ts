/*
 * Copyright (c) 2022 Reva Technology Inc., all rights reserved.
 * Unauthorized copying of this file, via any medium is strictly prohibited
 * Licensed under the Elastic License 2.0; you may not use this file except
 * in compliance with the Elastic License 2.0.
 */

import tryParse from '../../common/helpers/try-parse';

// Adding the following methods to the window object as well, so that it can be accessed in injected code as well
const WindowLocalStorage = window as any;

export const REVATECH_AUTH = 'revatech-auth';

const { localStorage } = window;

/**
 * Save to localStorage a given value serializing it as a JSON string
 * @param {string} key    the key of the value to be stored
 * @param {object} value  the value to be serialized as a JSON string
 */
export const lsSave = (key: string, value: any): void => {
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch (err) {
    console.error('lsSave error', key, value);
  }
};
WindowLocalStorage.lsSave = lsSave;

/**
 * Get a value stored in the localStorage
 * @param {string} key  the key of the value to retrieve
 * @param {*} defVal    the default value if no value is found
 */
export const lsGet = (key: string, defVal: any): any => tryParse(localStorage.getItem(key), defVal);
WindowLocalStorage.lsGet = lsGet;

/**
 * Clear the value from the localStorage
 * @param {string} key
 */
export const lsClear = (key: string): void => localStorage.removeItem(key);
WindowLocalStorage.lsClear = lsClear;
