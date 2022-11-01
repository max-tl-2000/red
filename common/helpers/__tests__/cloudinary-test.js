/*
 * Copyright (c) 2022 Reva Technology Inc., all rights reserved.
 * Unauthorized copying of this file, via any medium is strictly prohibited
 * Licensed under the Elastic License 2.0; you may not use this file except
 * in compliance with the Elastic License 2.0.
 */

import * as overrider from '../../test-helpers/overrider';
/* eslint-disable global-require */

describe('cloudinary', () => {
  let cloudinary;
  let ov;
  let globals;

  beforeEach(() => {
    jest.resetModules();
    globals = require('../globals');
    ov = overrider.create(globals);
  });

  afterEach(() => {
    overrider.restore();
  });

  describe('getUrlFromCloudinary', () => {
    it('should get same url back if an attempt to use the module is done without calling init', () => {
      cloudinary = require('../cloudinary');

      const url = cloudinary.getUrlFromCloudinary('http://handle/path/to/image.png');
      expect(url).toEqual('http://handle/path/to/image.png');
    });

    it('should return a wrapped url if cloudinary cloudName is set', () => {
      cloudinary = require('../cloudinary');
      cloudinary.init({ cloudName: 'roy' });
      const url = cloudinary.getUrlFromCloudinary('http://some/path/to/image.jpg');
      expect(url).toMatchSnapshot();
    });

    it('should handle passing optional options as well', () => {
      cloudinary = require('../cloudinary');
      cloudinary.init({ cloudName: 'roy' });
      const url = cloudinary.getUrlFromCloudinary('http://some/path/to/image.jpg', ['w_200', 'h_400']);
      expect(url).toMatchSnapshot();
    });

    it('should return a wrapped url when not running from a cucumber like environmet', () => {
      ov.override('location', {
        hostname: 'some.env.reva.tech',
      });

      cloudinary = require('../cloudinary');

      cloudinary.init({ cloudName: 'testCloud' });

      const url = cloudinary.getUrlFromCloudinary('http://handle/path/to/image.png');
      expect(url).toMatchSnapshot();
    });

    it('should return the original url when running from a cucumber like environmet', () => {
      ov.override('location', {
        hostname: 'cucumber-1.env.reva.tech',
      });

      cloudinary = require('../cloudinary');

      cloudinary.init({ cloudName: 'testCloud' });

      const url = cloudinary.getUrlFromCloudinary('http://handle/path/to/image.png');
      expect(url).toEqual('http://handle/path/to/image.png');
    });
  });

  describe('getBigAvatar', () => {
    it('should create the url to retrieve big avatars', () => {
      cloudinary = require('../cloudinary');
      cloudinary.init({ cloudName: 'roy' });
      const url = cloudinary.getBigAvatar('http://some/path/to/image.jpg');
      expect(url).toMatchSnapshot();
    });
  });

  describe('getSmallAvatar', () => {
    it('should create the url to retrieve small avatars', () => {
      cloudinary = require('../cloudinary');
      cloudinary.init({ cloudName: 'roy' });
      const url = cloudinary.getSmallAvatar('http://some/path/to/image.jpg');
      expect(url).toMatchSnapshot();
    });
  });

  describe('getImageForEmail', () => {
    it('should create the url to retrieve images for email templates', () => {
      cloudinary = require('../cloudinary');
      cloudinary.init({ cloudName: 'test' });
      const url = cloudinary.getImageForEmail('http://some/path/to/image.jpg', [
        { key: 'w', value: 2 },
        { key: 'h', value: 3 },
        { key: 'unkown', value: 'somevalue' },
      ]);
      expect(url).toContain('w_2,h_3');
      expect(url).not.toContain('unkown');
    });
  });
});
