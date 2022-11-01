/*
 * Copyright (c) 2022 Reva Technology Inc., all rights reserved.
 * Unauthorized copying of this file, via any medium is strictly prohibited
 * Licensed under the Elastic License 2.0; you may not use this file except
 * in compliance with the Elastic License 2.0.
 */

import cheerio from 'cheerio';
import path from 'path';

import { subtle, ok, error } from './logger';
import { glob, read, write } from '../common/helpers/xfs';

async function generate(overrideOriginal = false) {
  const files = await glob('./resources/icons/**/*.svg');

  const svgs = {};

  for (let i = 0; i < files.length; i++) {
    const file = files[i];
    const key = path.basename(file, '.svg');
    const text = await read(file, { encoding: 'utf8' });

    const $ = cheerio.load(text);

    const p = $('path');
    const styles = $('style');

    if (styles.length > 0) throw new Error(`Error processing file: "${file}" styles tags are not allowed`);

    p.removeAttr('class');
    p.removeAttr('sketch:type');
    p.removeAttr('stroke');

    svgs[key] = p.toString();

    if (overrideOriginal) {
      const template = `
        <svg width="24" height="24" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
          <g>
            ${svgs[key]}
          </g>
        </svg>`
        .trim()
        .replace(/\n\s{8}/g, '\n');

      const fileName = `./resources/icons/${key}.svg`;

      await write(fileName, template);
      subtle('file created:', fileName);
    }
  }

  const resourceFile = './resources/svgs/sprite.js';
  await write(resourceFile, `module.exports = ${JSON.stringify(svgs, null, 2)}`);

  subtle('file created:', resourceFile);

  ok('done!');
}

generate(process.argv.indexOf('--override-original') > -1).catch(err => {
  error('[svg-sprite]', err);
  process.exit(1); // eslint-disable-line no-process-exit
});
