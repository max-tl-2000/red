/*
 * Copyright (c) 2022 Reva Technology Inc., all rights reserved.
 * Unauthorized copying of this file, via any medium is strictly prohibited
 * Licensed under the Elastic License 2.0; you may not use this file except
 * in compliance with the Elastic License 2.0.
 */

import { readFileSync } from 'fs'; // had to use readFileSync, for some reason xfs.read was not working
import path from 'path';
import expand from 'glob-expand';
import { when } from '../../test-helpers';
import objectFormatter from '../object-formatter';
import tryParse from '../try-parse';

/**
 * reads the sample json files from the provided glob
 *
 * @param      {string}  glob   the glob to match files from
 * @return     {Array}          array of objects with the following structure:
 * {
 *   name,         // the name of the record key. This is inferred from the first
 *                 // part of the filename before the -- mark
 *   rec,          // the parsed JSON entity to be passed to objectFormatter
 * }
 */
const readSampleRecords = () => {
  const pattern = path.join(__dirname, './fixtures/objs/**/*.json');
  const recordFiles = expand(pattern);
  return recordFiles.map(f => ({
    name: path.basename(f, '.json').split('--')[0],
    rec: tryParse(readFileSync(f, { encoding: 'utf8' }), {}),
  }));
};

describe('objectFormatter.format', () => {
  when('format receives an object like:', () => {
    const recordExamples = readSampleRecords();

    recordExamples.forEach(entry => {
      it(`should format ${entry.name} as expected`, async () => {
        const result = objectFormatter.format(entry.name, entry.rec);
        expect(result).toMatchSnapshot(entry.name);
      });
    });
  });
});
