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
import recordFormatter from '../record-formatter';
import tryParse from '../try-parse';

/**
 * reads the sample json files from the provided glob
 *
 * @return     {Array}          array of objects with the following structure:
 * {
 *   name,          the name of the record key. This is inferred from the first
 *                  part of the filename before the -- mark
 *   expectedFile,  the name of the expected file to compare the result against
 *   rec,           the parsed JSON entity to be passed to objectFormatter
 * }
 */
const readSampleRecords = () => {
  const pattern = path.join(__dirname, './fixtures/recs/**/*.json');
  const recordFiles = expand(pattern);
  return recordFiles.map(f => ({
    name: path.basename(f, '.json'),
    rec: tryParse(readFileSync(f, { encoding: 'utf8' }), {}),
  }));
};

describe('recordFormatter.format', () => {
  when('format receives an object like:', () => {
    const recordExamples = readSampleRecords();

    recordExamples.forEach(entry => {
      it(`should format ${entry.name} as expected`, async () => {
        // the formatter return an array that is passed to console.log
        // console.log will just concatenate it and send it to stdout

        const { rec } = entry;
        // this is needed since the Buffer type is not serializable
        if (rec.subType === 'AMQP' && rec.amqpMessage.content && rec.amqpMessage.content.type === 'Buffer') {
          rec.amqpMessage.content = Buffer.from(rec.amqpMessage.content.data);
        }
        const formatted = recordFormatter.format(rec);
        const result = formatted.join(' ');
        expect(result).toMatchSnapshot(entry.name);
      });
    });
  });
});
