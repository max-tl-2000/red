/*
 * Copyright (c) 2022 Reva Technology Inc., all rights reserved.
 * Unauthorized copying of this file, via any medium is strictly prohibited
 * Licensed under the Elastic License 2.0; you may not use this file except
 * in compliance with the Elastic License 2.0.
 */

/* eslint-disable global-require */
const { mockModules } = require('test-helpers/mocker').default(jest);

describe('assetsReader', () => {
  let assetsReader;
  let loggerMock;
  let mockFS;

  beforeEach(() => {
    jest.resetModules();

    loggerMock = {
      error: jest.fn(),
      info: jest.fn(),
    };

    mockFS = {
      readJSON: jest.fn(manifest => {
        let res;
        if (manifest === 'main-manifest.json') {
          res = Promise.resolve({
            'main.css': 'main-1231231.css',
            'main.js': 'main-1231231.js',
          });
        } else if (manifest === 'vendors-manifest.json') {
          res = Promise.resolve({
            'vendors.js': 'vendors-1231231.js',
            'leasing.js': 'leasing-1231231.js',
          });
        } else {
          throw new Error(`not found: ${manifest}`);
        }

        return res;
      }),
    };

    mockModules({
      '../helpers/logger': {
        child: () => loggerMock,
      },
      '../helpers/xfs': mockFS,
    });

    assetsReader = require('../assets-reader').default;
  });

  describe('provided a list of manifest files, when none of them fails to be read', () => {
    it('should cache the results of the reads so no no more reads are performed', async () => {
      let result = await assetsReader.read(['main-manifest.json', 'vendors-manifest.json']);

      const cachedResults = result;
      // since results were cached it doesn't matter what we pass here as parameters
      result = await assetsReader.read(['main-manifest.json', 'vendors-manifest.json']);

      // we expect it to only have been called twice and no more than 2 times given the same set of files
      expect(mockFS.readJSON).toHaveBeenCalledTimes(2);

      expect(cachedResults).toEqual(result);
      expect(result).toMatchSnapshot();
    });
  });

  describe('provided a list of manifest files that are different from the ones used the first time', () => {
    it('should read the content of the file that was not in the cache and add the results to the cache', async () => {
      // only caches main-manifest.json
      let result = await assetsReader.read(['main-manifest.json']);

      const results1 = result;

      // now it caches vendors-manifest.json
      result = await assetsReader.read(['main-manifest.json', 'vendors-manifest.json']);

      const results2 = result;

      // this should not produce new reads, as both files should be in the cache by now
      result = await assetsReader.read(['main-manifest.json', 'vendors-manifest.json']);

      expect(mockFS.readJSON).toHaveBeenCalledTimes(2);
      expect(results1).not.toEqual(result);
      expect(results2).toEqual(result);
      expect(result).toMatchSnapshot();
    });
  });

  describe('provided a list of manifest files, when one of them fails to be read', () => {
    it('should not cache the results of the reads until all manifests are valid', async () => {
      let result = await assetsReader.read(['main-manifest.json', 'notfound-manifest.json']);

      const cachedResults = result;

      result = await assetsReader.read(['main-manifest.json', 'vendors-manifest.json']);

      // it should be called 3 times, 1 for main-manifest, one of the not-found-manifest.json and
      // one for vendors-manifest.json
      expect(mockFS.readJSON).toHaveBeenCalledTimes(3);
      expect(cachedResults).not.toEqual(result);
      expect(result).toMatchSnapshot();
    });
  });
});
