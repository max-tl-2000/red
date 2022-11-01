/*
 * Copyright (c) 2022 Reva Technology Inc., all rights reserved.
 * Unauthorized copying of this file, via any medium is strictly prohibited
 * Licensed under the Elastic License 2.0; you may not use this file except
 * in compliance with the Elastic License 2.0.
 */

import { subtle, ok } from 'clix-logger/logger';
import majo from 'majo';
import { transform } from '@babel/core';
import path from 'path';

const compile = async (source, dest, { dryRun, noTransform = [], noCopy = [], justCopy, quiet = true } = {}) => {
  const babelify = ctx => {
    const fileList = ctx.fileList;
    return Promise.all(
      fileList.map(async file => {
        if (noCopy.some(regex => file.match(regex))) {
          !quiet && subtle('[no copy     ]:', file);

          if (!dryRun) {
            ctx.deleteFile(file);
          }

          return;
        }

        const skipTransform = !file.match(/\.js$|\.ts$/) || noTransform.some(regex => file.match(regex)) || justCopy;

        if (!skipTransform) {
          if (dryRun) {
            subtle('[transform   ]: skiping process because of dryRun');
            return;
          }

          const content = ctx.fileContents(file);
          const { code, map } = transform(content, {
            filename: path.basename(file),
            sourceMaps: true,
          });

          const theCodeParts = [code];

          if (map) {
            const mapFile = `${file}.map`;
            const nameOfMap = path.basename(mapFile);
            theCodeParts.push('\n');
            const comment = '//#';
            theCodeParts.push(`${comment} sourceMappingURL=${nameOfMap}`);
            ctx.createFile(mapFile, { contents: JSON.stringify(map) });
          }

          ctx.writeContents(file, theCodeParts.join(''));
        }
      }),
    );
  };

  let stream = majo();

  stream = stream.source(source).use(babelify);

  let res;

  if (dryRun) {
    res = stream.process();
  } else {
    res = stream.dest(dest);
  }

  await res;
  ok('[compile] done.');
};

export default compile;
