/*
 * Copyright (c) 2022 Reva Technology Inc., all rights reserved.
 * Unauthorized copying of this file, via any medium is strictly prohibited
 * Licensed under the Elastic License 2.0; you may not use this file except
 * in compliance with the Elastic License 2.0.
 */

import Twig from 'twig';
import path from 'path';
import serveStatic from 'serve-static';
import favicon from 'serve-favicon';
import trim from '../../common/helpers/trim';

const WEB_UTILS_MODULE_NAME = 'web';

export const getModuleNameFromHostName = hostname => (hostname && hostname.split('.')[0].toLowerCase()) || '';

const skipIfNoWebUtils = cb => (req, res, next) => {
  const moduleName = getModuleNameFromHostName(req.hostname);

  if (moduleName !== WEB_UTILS_MODULE_NAME) {
    next();
    return;
  }

  cb && cb(req, res, next);
};

const _renderView = ({ getView, getData, req, res, next, config }) => {
  if (getData && typeof getData !== 'function') throw new Error('getData is not a function');
  if (typeof getView !== 'function') throw new Error('getView is not a function');

  const {
    webUtils: { authToken: TOKEN, tenantHost: TENANT_HOST, googleMapsToken: GOOGLE_MAPS_API_TOKEN, googleTagManagerId: GTM_ID },
  } = config;

  const ua = trim(req.headers['user-agent']);

  const useLegacy = ua.match(/Trident.*/);

  const jsResource = useLegacy ? '/out/website-utils-legacy.min.js' : '/out/website-utils.min.js';
  const cssResource = useLegacy ? '/out/website-utils-legacy.min.css' : '/out/website-utils.min.css';

  const data = getData ? getData(req) || {} : {};

  const view = getView();
  if (!view) throw new Error('view not defined');

  const templateFile = path.join(__dirname, '../../node_modules/@redisrupt/website-utils/server/views/', view);
  const ASSETS_BASE_PATH = '/out/';

  Twig.renderFile(
    templateFile,
    { TOKEN, TENANT_HOST, GOOGLE_MAPS_API_TOKEN, ASSETS_BASE_PATH, dev: false, jsResource, cssResource, GTM_ID, ...data },
    (err, html) => {
      if (err) {
        next(err);
        return;
      }
      res.status(200).send(html);
    },
  );
};

const renderView = ({ getView, getData, req, res, next, config }) => {
  try {
    _renderView({ getView, getData, req, res, next, config });
  } catch (err) {
    next(err);
  }
};

export const registerWebUtilsRoutes = (app, config) => {
  if (config.isProdEnv) return; // Do not serve this in production

  Twig.cache(config.env === 'production');

  const setCacheControlHeader = timeInMinutes => res => {
    res.setHeader('Cache-Control', `public, max-age=${timeInMinutes * 60}, must-revalidate`);
  };

  const THRESHOLD_TO_CACHE_WEBSITE_UTILS_STATIC_ASSETS = 0;
  const setHeaders = setCacheControlHeader(THRESHOLD_TO_CACHE_WEBSITE_UTILS_STATIC_ASSETS);

  const faviconMiddlewareFn = favicon(path.join(__dirname, '../../node_modules/@redisrupt/website-utils/server/assets', 'favicon.ico'), {
    maxAge: '1y',
  });

  app.use(skipIfNoWebUtils(faviconMiddlewareFn));

  const staticMiddlewareFn = serveStatic(path.join(__dirname, '../../node_modules/@redisrupt/website-utils/server/assets'), { setHeaders });
  const staticMiddlewareStorybookAsetsFn = serveStatic(path.join(__dirname, '../../node_modules/@redisrupt/website-utils/storybook/resources/assets'), {
    setHeaders,
  });

  const staticMiddlewareStorybookFn = serveStatic(path.join(__dirname, '../../static/thirdparty/website-utils/storybook'), { setHeaders });
  const staticThirdpartyFn = serveStatic(path.join(__dirname, '../../static/thirdparty/website-utils'), {
    setHeaders: (res, path_) => {
      if (path_.match(/\.js$/) || path_.match(/\.css$/)) {
        res.header('Access-Control-Allow-Origin', '*');
      }
      setHeaders(res);
    },
  });

  app.use('/out/', skipIfNoWebUtils(staticThirdpartyFn));

  app.use('/assets/', skipIfNoWebUtils(staticMiddlewareFn));

  app.use('/assets/', skipIfNoWebUtils(staticMiddlewareStorybookAsetsFn));

  app.use('/storybook/', skipIfNoWebUtils(staticMiddlewareStorybookFn));

  const getPageCSS = req => {
    const { templateName = 'home' } = req.params;
    const map = {
      'phone-replacement': '/out/pages/phone-replacement.min.css',
      'sharon-green': '/out/pages/sharon-green.min.css',
    };

    return map[templateName] || '/out/pages/website.min.css';
  };

  app.get(
    '/property/:propertyId*',
    skipIfNoWebUtils((req, res, next) => {
      const logoMap = {
        '/denver/dylan-rino-apartments': '/assets/logos/Dylan_BlackLogo.png',
        '/denver/westend-apartments': '/assets/logos/Westend_BlackLogo.png',
        '/st-cloud-metro/regency-park-estates': '/notFound.png',
      };

      const key = req.params[0];

      const propertyLogoURL = logoMap[key] || '';

      renderView({
        req,
        res,
        next,
        config,
        getView: () => 'property.twig',
        getData: () => ({
          slug: `${req.params.propertyId}${req.params[0]}`,
          // needed to simulate the way the property and tenant logo will be defined in the SS template
          propertyLogoURL,
          tenantLogoURL: '/assets/logos/logo.svg',
          pageCSS: getPageCSS(req),
        }),
      });
    }),
  );

  app.get(
    '/communities/:type?/:state?/:city?/:name?',
    skipIfNoWebUtils((req, res, next) => {
      renderView({
        req,
        res,
        next,
        config,
        getData: () => ({ tenantLogoURL: '/assets/logos/logo.svg', pageCSS: getPageCSS(req) }),
        getView: () => 'communities.twig',
      });
    }),
  );

  app.get(
    '/:templateName?',
    skipIfNoWebUtils((req, res, next) => {
      renderView({
        req,
        res,
        next,
        config,
        // needed to simulate the way the tenant logo will be defined in the SS template
        getData: () => ({ tenantLogoURL: '/assets/logos/logo.svg', pageCSS: getPageCSS(req) }),
        getView: () => {
          const { templateName = 'home' } = req.params;
          if (!templateName.match(/home|about|book-appointment|phone-replacement|sharon-green|booker|investors|login|residents/)) {
            throw new Error(`Route not allowed: ${templateName}`);
          }

          return `${templateName}.twig`;
        },
      });
    }),
  );
};
