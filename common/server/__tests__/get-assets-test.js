/*
 * Copyright (c) 2022 Reva Technology Inc., all rights reserved.
 * Unauthorized copying of this file, via any medium is strictly prohibited
 * Licensed under the Elastic License 2.0; you may not use this file except
 * in compliance with the Elastic License 2.0.
 */

import { override, restore } from '../../test-helpers/overrider';
const { mockModules } = require('test-helpers/mocker').default(jest);

const expect = global.expect;

describe('get-assets-test', () => {
  beforeEach(() => {
    override(
      process.env,
      {
        USE_ASSETS_PROD_DIST_FOLDER: 'true',
      },
      true /* allow non existend props */,
    );
  });

  afterEach(() => {
    restore();
    jest.resetModules();
  });

  describe('when useDevMode = true and query.local = undefined', () => {
    it('should return the list of files from local and no min extensions for main.js and vendors.js', async () => {
      mockModules({
        '../../helpers/xfs': {
          readJSON: manifest => {
            let res;
            if (manifest === 'main') {
              res = Promise.resolve({
                'main.css': 'main.css',
                'main.js': 'main.js',
              });
            }
            if (manifest === 'vendors') {
              res = Promise.resolve({
                'vendors.js': 'vendors.js',
              });
            }
            return res;
          },
        },
      });
      const { getAssets } = require('../get-assets'); // eslint-disable-line global-require
      const result = await getAssets({
        host: 'demo.local.env.reva.tech',
        query: {},
        useDevMode: true,
        jsManifests: ['vendors', 'main'],
        cssFiles: ['main.css'],
        jsFiles: ['vendors.js', 'main.js'],
      });
      expect(result).toMatchSnapshot();
    });
  });

  describe('when useDevMode = false and one of them contain the local flag', () => {
    it('should return the list of files from local and no min extensions for main.js and vendors.js', async () => {
      mockModules({
        '../../helpers/xfs': {
          readJSON: manifest => {
            let res;
            if (manifest === 'main') {
              res = Promise.resolve({
                'main.css': 'main.css',
                'main.js': 'main.js',
              });
            }
            if (manifest === 'vendors') {
              res = Promise.resolve({
                'vendors.js': 'vendors.js',
              });
            }
            return res;
          },
        },
      });
      const { getAssets } = require('../get-assets'); // eslint-disable-line global-require
      const result = await getAssets({
        host: 'demo.local.env.reva.tech',
        query: {},
        useDevMode: false,
        jsManifests: ['vendors', 'main'],
        cssFiles: [{ name: 'main.css', local: true }],
        jsFiles: ['vendors.js', { name: 'main.js', local: true }],
      });
      expect(result).toMatchSnapshot();
    });
  });

  describe('when useDevMode = true and one of them contain the local flag', () => {
    it('should return the list of files from local and min extensions for main.js and vendors.js', async () => {
      mockModules({
        '../../helpers/xfs': {
          readJSON: manifest => {
            let res;
            if (manifest === 'main') {
              res = Promise.resolve({
                'main.css': 'main.css',
                'main.js': 'main.js',
              });
            }
            if (manifest === 'vendors') {
              res = Promise.resolve({
                'vendors.js': 'vendors.js',
              });
            }
            return res;
          },
        },
      });
      const { getAssets } = require('../get-assets'); // eslint-disable-line global-require
      const result = await getAssets({
        host: 'demo.local.env.reva.tech',
        query: {},
        useDevMode: false,
        jsManifests: ['vendors', 'main'],
        cssFiles: [{ name: 'main.css', local: true }],
        jsFiles: ['vendors.js', { name: 'main.js', local: true }],
      });
      expect(result).toMatchSnapshot();
    });
  });

  describe('when NODE_ENV = production and query.local = undefined', () => {
    it('should return the list of files from cdn, min extensions for main.js and vendors.js and main.css and vendor.css', async () => {
      mockModules({
        '../../helpers/xfs': {
          readJSON: manifest => {
            let res;
            if (manifest === 'main') {
              res = Promise.resolve({
                'main.css': 'main.css',
                'main.js': 'main.js',
              });
            }
            if (manifest === 'vendors') {
              res = Promise.resolve({
                'vendors.js': 'vendors.js',
              });
            }
            return res;
          },
        },
      });

      const { getAssets } = require('../get-assets'); // eslint-disable-line global-require
      const result = await getAssets({
        host: 'demo.local.env.reva.tech',
        query: {},
        useDevMode: false,
        jsManifests: ['main', 'vendors'],
        cssFiles: ['main.css'],
        jsFiles: ['vendors.js', 'main.js'],
      });
      expect(result).toMatchSnapshot();
    });
  });

  describe('when NODE_ENV = production and query.local = true', () => {
    it('should return the list of files from cdn ignoring local=true, min extensions for main.js and vendors.js and main.css', async () => {
      mockModules({
        '../../helpers/xfs': {
          readJSON: manifest => {
            let res;
            if (manifest === 'main') {
              res = Promise.resolve({
                'main.css': 'main.css',
                'main.js': 'main.js',
              });
            }
            if (manifest === 'vendors') {
              res = Promise.resolve({
                'vendors.js': 'vendors.js',
              });
            }
            return res;
          },
        },
      });

      const { getAssets } = require('../get-assets'); // eslint-disable-line global-require
      const result = await getAssets({
        host: 'demo.local.env.reva.tech',
        query: {},
        useDevMode: false,
        jsManifests: ['main', 'vendors'],
        cssFiles: ['main.css'],
        jsFiles: ['vendors.js', 'main.js'],
      });
      expect(result).toMatchSnapshot();
    });
  });

  describe('when useDevMode = true and query.local = false', () => {
    it('should return the list of files from cdn, no min extensions for main.js and vendors.js and no main.css', async () => {
      mockModules({
        '../../helpers/xfs': {
          readJSON: manifest => {
            let res;
            if (manifest === 'main') {
              res = Promise.resolve({
                'main.css': 'main.css',
                'main.js': 'main.js',
              });
            }
            if (manifest === 'vendors') {
              res = Promise.resolve({
                'vendors.js': 'vendors.js',
              });
            }
            return res;
          },
        },
      });

      const { getAssets } = require('../get-assets'); // eslint-disable-line global-require
      const result = await getAssets({
        host: 'demo.local.env.reva.tech',
        query: {},
        useDevMode: true,
        jsManifests: ['main', 'vendors'],
        cssFiles: ['main.css'],
        jsFiles: ['vendors.js', 'main.js'],
      });
      expect(result).toMatchSnapshot();
    });
  });

  describe('when NODE_ENV = production and query.min = false', () => {
    it('should return the list of files from cdn, no min extensions for main.js and vendors.js and main.css and vendor.css', async () => {
      mockModules({
        '../../helpers/xfs': {
          readJSON: manifest => {
            let res;
            if (manifest === 'main') {
              res = Promise.resolve({
                'main.css': 'main.css',
                'main.js': 'main.js',
              });
            }
            if (manifest === 'vendors') {
              res = Promise.resolve({
                'vendors.js': 'vendors.js',
              });
            }
            return res;
          },
        },
      });

      const { getAssets } = require('../get-assets'); // eslint-disable-line global-require
      const result = await getAssets({
        host: 'demo.local.env.reva.tech',
        query: { min: 'false' },
        useDevMode: false,
        jsManifests: ['main', 'vendors'],
        cssFiles: ['main.css'],
        jsFiles: ['vendors.js', 'main.js'],
      });
      expect(result).toMatchSnapshot();
    });
  });

  describe('when NODE_ENV = production and query.dMode = true', () => {
    describe('and host is production host', () => {
      it('should return the assets from local', async () => {
        mockModules({
          '../../helpers/xfs': {
            readJSON: manifest => {
              let res;
              if (manifest === 'main') {
                res = Promise.resolve({
                  'main.css': 'main.css',
                  'main.js': 'main.js',
                });
              }
              if (manifest === 'vendors') {
                res = Promise.resolve({
                  'vendors.js': 'vendors.js',
                });
              }
              return res;
            },
          },
        });

        const { getAssets } = require('../get-assets'); // eslint-disable-line global-require
        const result = await getAssets({
          host: 'demo.reva.tech',
          query: { dMode: 'true' },
          useDevMode: false,
          jsManifests: ['main', 'vendors'],
          cssFiles: ['main.css'],
          jsFiles: ['vendors.js', 'main.js'],
        });
        expect(result).toMatchSnapshot();
      });
    });

    describe('and host is production host and query.min = false ', () => {
      it('should return the assets from local and should return no min extensions for main.js and vendors.js and main.css and vendor.css ', async () => {
        mockModules({
          '../../helpers/xfs': {
            readJSON: manifest => {
              let res;
              if (manifest === 'main') {
                res = Promise.resolve({
                  'main.css': 'main.css',
                  'main.js': 'main.js',
                });
              }
              if (manifest === 'vendors') {
                res = Promise.resolve({
                  'vendors.js': 'vendors.js',
                });
              }
              return res;
            },
          },
        });

        const { getAssets } = require('../get-assets'); // eslint-disable-line global-require
        const result = await getAssets({
          host: 'demo.reva.tech',
          query: { min: 'false', dMode: 'true' },
          useDevMode: false,
          jsManifests: ['main', 'vendors'],
          cssFiles: ['main.css'],
          jsFiles: ['vendors.js', 'main.js'],
        });
        expect(result).toMatchSnapshot();
      });
    });

    describe('and host is a local host ', () => {
      it('should return omit the useLocalAssets and return the local assets ', async () => {
        mockModules({
          '../../helpers/xfs': {
            readJSON: manifest => {
              let res;
              if (manifest === 'main') {
                res = Promise.resolve({
                  'main.css': 'main.css',
                  'main.js': 'main.js',
                });
              }
              if (manifest === 'vendors') {
                res = Promise.resolve({
                  'vendors.js': 'vendors.js',
                });
              }
              return res;
            },
          },
        });

        const { getAssets } = require('../get-assets'); // eslint-disable-line global-require
        const result = await getAssets({
          host: 'demo.local.env.reva.tech',
          query: { dMode: 'true' },
          useDevMode: false,
          jsManifests: ['main', 'vendors'],
          cssFiles: ['main.css'],
          jsFiles: ['vendors.js', 'main.js'],
        });
        expect(result).toMatchSnapshot();
      });
    });
  });

  describe('when NODE_ENV = development and dMode = true ', () => {
    it('should omit the useLocalAssets and return the local assets ', async () => {
      mockModules({
        '../../helpers/xfs': {
          readJSON: manifest => {
            let res;
            if (manifest === 'main') {
              res = Promise.resolve({
                'main.css': 'main.css',
                'main.js': 'main.js',
              });
            }
            if (manifest === 'vendors') {
              res = Promise.resolve({
                'vendors.js': 'vendors.js',
              });
            }
            return res;
          },
        },
      });

      const { getAssets } = require('../get-assets'); // eslint-disable-line global-require
      const result = await getAssets({
        host: 'demo.local.env.reva.tech',
        query: { dMode: 'true' },
        useDevMode: true,
        jsManifests: ['main', 'vendors'],
        cssFiles: ['main.css'],
        jsFiles: ['vendors.js', 'main.js'],
      });
      expect(result).toMatchSnapshot();
    });
  });
});
