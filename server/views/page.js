/*
 * Copyright (c) 2022 Reva Technology Inc., all rights reserved.
 * Unauthorized copying of this file, via any medium is strictly prohibited
 * Licensed under the Elastic License 2.0; you may not use this file except
 * in compliance with the Elastic License 2.0.
 */

import React from 'react';
import Layout from '../../common/layout/layout';

const Page = props => {
  let {
    t,
    getResource,
    jsAssets,
    pagePaths,
    useSelfHostedAssets,
    assetsHostname,
    sisenseDomain,
    envHostPart,
    tenantName,
    pageCSSAssets,
    pageJSAssets,
    pageAppData,
    children,
    ...rest
  } = props;

  const fontResource = useSelfHostedAssets ? `//${assetsHostname}/libs/font/roboto/roboto.css` : '//fonts.googleapis.com/css?family=Roboto:300,400,500';
  const jQueryResource = useSelfHostedAssets
    ? `//${assetsHostname}/libs/jquery/jquery_1494301536.js`
    : '//cdnjs.cloudflare.com/ajax/libs/jquery/3.0.0/jquery.min.js';

  const momentResource = useSelfHostedAssets
    ? `//${assetsHostname}/libs/moment/moment_1494301536.min.js`
    : '//cdnjs.cloudflare.com/ajax/libs/moment.js/2.17.1/moment.min.js';

  pageCSSAssets = [fontResource, getResource('vendors.css'), ...pageCSSAssets];
  pageJSAssets = [...jsAssets, momentResource, jQueryResource, getResource('vendors.js'), ...pageJSAssets];

  const appData = {
    tenantName,
    urls: {
      ...pagePaths,
    },
    ...pageAppData,
  };

  children = children || <div id="content" />;

  return (
    <Layout appData={appData} cssAssets={pageCSSAssets} jsAssets={pageJSAssets} {...rest}>
      {children}
    </Layout>
  );
};

export default Page;
