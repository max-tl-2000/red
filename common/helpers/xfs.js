/*
 * Copyright (c) 2022 Reva Technology Inc., all rights reserved.
 * Unauthorized copying of this file, via any medium is strictly prohibited
 * Licensed under the Elastic License 2.0; you may not use this file except
 * in compliance with the Elastic License 2.0.
 */

import globModule from 'glob';
import path from 'path';
import mkdir from 'mkdirp';
import fs from 'fs';
import del from 'del';
import thenify from './thenify';
import tryParse from './try-parse';

const readFile = thenify(fs.readFile);
const writeFile = thenify(fs.writeFile);

export { del };
export const mkdirp = thenify(mkdir);
export const read = (file, opts = { encoding: 'utf8' }) => readFile(file, opts);
export const glob = thenify(globModule);

export const write = async (file, contents, options) => {
  const dir = path.dirname(file);
  await mkdirp(dir);
  return await writeFile(file, contents, options);
};

export const readJSON = async file => {
  const content = await read(file, { encoding: 'utf8' });
  return tryParse(content);
};

export const readDirectory = thenify(fs.readdir);

export const tryReadJSON = async (file, def) => {
  try {
    return readJSON(file);
  } catch (error) {
    return def;
  }
};

export const tryReadJSONSync = (file, def) => {
  let content = '';
  try {
    content = fs.readFileSync(file);
  } catch (err) {
    content = '';
  }

  if (!content) return def;

  return tryParse(content);
};

export const stat = thenify(fs.stat);

export const deleteFile = thenify(fs.unlink);

export const exists = async file => {
  try {
    await stat(file);
    return true;
  } catch (err) {
    return false;
  }
};
