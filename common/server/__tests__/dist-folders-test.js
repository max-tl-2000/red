/*
 * Copyright (c) 2022 Reva Technology Inc., all rights reserved.
 * Unauthorized copying of this file, via any medium is strictly prohibited
 * Licensed under the Elastic License 2.0; you may not use this file except
 * in compliance with the Elastic License 2.0.
 */

/* eslint-disable global-require */
import path from 'path';
import { override, restore } from 'test-helpers/overrider';
const { mockModules } = require('test-helpers/mocker').default(jest);

describe('dist-folders', () => {
  beforeEach(() => {
    mockModules({
      path: {
        resolve: (...args) => path.join('/Users/ubuntu', ...args),
      },
    });
  });

  afterEach(() => {
    restore();
    jest.resetModules();
  });

  describe('in case of dev environmet', () => {
    it('should return `dev-dist`', () => {
      override(process.env, {
        NODE_ENV: 'development',
      });
      const mdl = require('../dist-folders');
      const fName = mdl.getDistFolderName();

      expect(fName).toEqual('dev-dist');
    });
  });

  describe('in case of prod environmet', () => {
    it('should return `dist`', () => {
      override(process.env, {
        NODE_ENV: 'production',
      });
      const mdl = require('../dist-folders');
      const fName = mdl.getDistFolderName();

      expect(fName).toEqual('dist');
    });
  });

  describe('in case of prod environmet', () => {
    it('should return the path including `dist`', () => {
      override(process.env, {
        NODE_ENV: 'production',
      });

      const mdl = require('../dist-folders');
      const fName = mdl.getOutputFolder();

      expect(fName).toEqual('/Users/ubuntu/static/dist');
    });
  });

  describe('in case of prod environmet', () => {
    it('should return the path including `dev-dist`', () => {
      override(process.env, {
        NODE_ENV: 'development',
      });

      const mdl = require('../dist-folders');
      const fName = mdl.getOutputFolder();

      expect(fName).toEqual('/Users/ubuntu/static/dev-dist');
    });
  });

  describe('in case of development and forceProd=true', () => {
    it('should return the path including `dist`', () => {
      override(
        process.env,
        {
          NODE_ENV: 'development',
          USE_ASSETS_PROD_DIST_FOLDER: 'true',
        },
        true,
      );

      const mdl = require('../dist-folders');
      const fName = mdl.getOutputFolder();

      expect(fName).toEqual('/Users/ubuntu/static/dist');
    });
  });

  describe('in case of prod environment and a prefix provided', () => {
    it('should return the path including `dist` and the prefix', () => {
      override(process.env, {
        NODE_ENV: 'production',
      });

      const mdl = require('../dist-folders');
      const fName = mdl.getOutputFolder({ prefix: './auth' });

      expect(fName).toEqual('/Users/ubuntu/auth/static/dist');
    });
  });
});
