/*
 * Copyright (c) 2022 Reva Technology Inc., all rights reserved.
 * Unauthorized copying of this file, via any medium is strictly prohibited
 * Licensed under the Elastic License 2.0; you may not use this file except
 * in compliance with the Elastic License 2.0.
 */

import clsc from '../helpers/coalescy';
import { now } from '../helpers/moment-utils';
import assetsReader from '../assets-reader';
import { getDistFolderName } from './dist-folders';

const distFolder = getDistFolderName();

const getStaticHostname = (host, useLocalAssets) => {
  const parts = host.split('.');
  parts.shift();
  if (useLocalAssets && !parts.includes('local')) {
    parts.unshift('local');
  }
  parts.unshift('static');
  return parts.join('.');
};

export const getAssetURL = (uri, host) => {
  const staticHostName = host;
  return `//${staticHostName}${uri}`;
};

export const createAssetsResolver = async (manifests, { host, useMin, useLocalAssets } = {}) => {
  const assetsMap = await assetsReader.read(manifests);
  const assetsHostname = getStaticHostname(host, useLocalAssets);

  return {
    assetsHostname,
    getStaticResource(resourceName, urlPrefix) {
      urlPrefix = clsc(urlPrefix, `//${assetsHostname}`);
      const result = assetsMap[resourceName];

      if (!result) {
        return '';
      }

      if (useMin) {
        return `${urlPrefix}/${distFolder}/${result.replace(/((\.js|\.css))$/, '.min$1')}`;
      }

      return `${urlPrefix}/${distFolder}/${result}`;
    },
  };
};

export const getAssets = async ({ query, useDevMode, includeDefault = true, jsManifests, jsFiles = [], cssFiles = [], host = '' }) => {
  const useMin = query.min !== 'false' && !useDevMode;
  const useLocalAssets = query.dMode === 'true' && !useDevMode;
  const { getStaticResource, assetsHostname } = await createAssetsResolver(jsManifests, { host, useMin, useLocalAssets });

  const getResource = resource => {
    const isObject = typeof resource === 'object';
    const resourceName = isObject ? resource.name : resource;

    const shouldBeServedByDevServer = useDevMode && isObject && resource.dev;
    const shouldBeSkipped = useDevMode && isObject && resource.skipInDev;
    const shouldBePrefixedWithAssetsHost = !resource.local;
    const skipResolver = isObject && resource.skipResolver;

    if (shouldBeSkipped) return '';

    const urlPrefix = shouldBePrefixedWithAssetsHost ? `//${assetsHostname}` : '';

    if (shouldBeServedByDevServer) {
      return `${urlPrefix}/${distFolder}/${resourceName}?${now().toJSON()}`;
    }

    if (skipResolver) {
      let ret = `${urlPrefix}/${resource.name}`;
      if (useMin) {
        ret = ret.replace(/((\.js|\.css))$/, '.min$1');
      }
      return ret;
    }

    return getStaticResource(resourceName, urlPrefix);
  };

  const useSelfHostedAssets = query.local || useDevMode;

  let cssAssets = includeDefault
    ? [
        useSelfHostedAssets ? `//${assetsHostname}/libs/font/roboto/roboto.css` : '//fonts.googleapis.com/css?family=Roboto:300,400,500',
        useSelfHostedAssets
          ? `//${assetsHostname}/libs/fullcalendar/fullcalendar_1494301536.min.css`
          : '//cdnjs.cloudflare.com/ajax/libs/fullcalendar/3.1.0/fullcalendar.min.css',
        `//${assetsHostname}/libs/materialize/materialize_1494301537.min.css`,
        `//${assetsHostname}/libs/materialize-nouislider/nouislider_1494301536.css`,
      ]
    : [];

  const resolvedCSSResources = cssFiles.map(file => getResource(file)).filter(resource => !!resource);
  cssAssets = cssAssets.concat(resolvedCSSResources);

  let jsAssets = includeDefault
    ? [
        `//${assetsHostname}/libs/materialize-nouislider/nouislider_1494301536.min.js`,
        useSelfHostedAssets
          ? `//${assetsHostname}/libs/jquery/jquery_1494301536.js`
          : { src: '//cdnjs.cloudflare.com/ajax/libs/jquery/3.0.0/jquery.min.js', crossDomain: undefined },
        `//${assetsHostname}/libs/materialize/materialize_1494301537.min.js`,
        useSelfHostedAssets
          ? `//${assetsHostname}/libs/moment/moment_1494301536.min.js`
          : { src: '//cdnjs.cloudflare.com/ajax/libs/moment.js/2.17.1/moment.min.js', crossDomain: undefined },
        useSelfHostedAssets
          ? `//${assetsHostname}/libs/fullcalendar/fullcalendar_1494301536.min.js`
          : { src: '//cdnjs.cloudflare.com/ajax/libs/fullcalendar/3.1.0/fullcalendar.min.js', crossDomain: undefined },
      ]
    : [];

  const resolvedResources = jsFiles.map(file => getResource(file)).filter(resource => !!resource);
  jsAssets = jsAssets.concat(resolvedResources);

  return {
    getStaticResource,
    assetsHostname,
    useSelfHostedAssets,
    getResource,
    jsAssets,
    cssAssets,
  };
};
