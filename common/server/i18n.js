/*
 * Copyright (c) 2022 Reva Technology Inc., all rights reserved.
 * Unauthorized copying of this file, via any medium is strictly prohibited
 * Licensed under the Elastic License 2.0; you may not use this file except
 * in compliance with the Elastic License 2.0.
 */

import i18next from 'i18next';
import FilesystemBackend from 'i18next-node-fs-backend';
import i18nextMiddleware, { LanguageDetector } from 'i18next-express-middleware';
import { findNamespaces } from './i18next-ns-helper';

// make t work when imported like `import { t } from 'i18next';
// otherwise using t this way will throw an error
i18next.t = i18next.t.bind(i18next);

export const initI18N = async ({ logger, debug = false, loadPath, useLanguageDetector, namespaces = ['trans'], namespaceDir }) => {
  i18next.on('failedLoading', (lng, ns, error) => logger.error({ lng, ns, error }, `language ${lng} failed to load`));
  i18next.on('missingKey', (lngs, ns, key) => logger.warn({ lngs, ns, key }, `key ${key} was not found`));

  if (namespaceDir) {
    namespaces = await findNamespaces(namespaceDir);
  }

  return new Promise((resolve, reject) => {
    const i18nModule = useLanguageDetector ? i18next.use(LanguageDetector) : i18next;
    i18nModule.use(FilesystemBackend).init(
      {
        ns: namespaces,
        defaultNS: 'trans',
        debug,
        whitelist: ['en', 'es'],
        preload: ['en'],
        fallbackLng: 'en',
        interpolation: {
          escapeValue: false, // previous version had this value as false
          prefix: '{{',
          suffix: '}}',
        },
        backend: {
          loadPath,
        },
        detection: {
          order: ['path', 'header'],
          lookupPath: 'lng',
          lookupFromPathIndex: 0,
          caches: false,
        },
      },
      err => {
        if (err) {
          logger && logger.error({ err }, 'Error loading languages');
          reject(err);
          return;
        }

        logger && logger.trace('languages loaded!');

        resolve();
      },
    );
  });
};

const i18n = {
  async init(app, options) {
    const middleware = await this.getMiddleware(options);
    app.use(middleware);
  },

  /**
   * relod the provided language
   *
   * @param      {String}   lang    The language to reload
   * @return     {Promise}  The promise will be resolved when the language files were reloaded
   */
  async reload(lang) {
    return new Promise(resolve => {
      i18next.reloadResources([lang], ['trans']);
      // sadly we cannot tell when the languages were reloaded
      // the method lacks a callback, and doesn't return a promise
      // so the only thing we can do is just wait for some time
      setTimeout(() => {
        resolve(i18next.store.data[lang].trans);
      }, 2000);
    });
  },

  async getMiddleware({ logger, debug, loadPath, namespaces, namespaceDir } = {}) {
    await initI18N({ logger, debug, loadPath, namespaces, namespaceDir });
    const i18nFn = i18nextMiddleware.handle(i18next, {
      ignoreRoutes: [],
      removeLngFromUrl: false,
    });

    return (req, res, next) => {
      const { path } = req;
      const ignoredRoutes = [/^\/img\//, /^\/api\//, /^\/dist\//, /^\/dev-dist\//];
      if (ignoredRoutes.some(ignored => path.match(ignored))) {
        next();
        return;
      }
      i18nFn(req, res, next);
    };
  },
};

export default i18n;
