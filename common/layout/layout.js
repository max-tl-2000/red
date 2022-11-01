/*
 * Copyright (c) 2022 Reva Technology Inc., all rights reserved.
 * Unauthorized copying of this file, via any medium is strictly prohibited
 * Licensed under the Elastic License 2.0; you may not use this file except
 * in compliance with the Elastic License 2.0.
 */

import React from 'react';
import serialize from 'serialize-javascript';
import { isString } from '../helpers/type-of';
import { getFaviconLibrary } from '../helpers/favicon-library';

const renderCssAssets = (assets = []) => assets.filter(a => !!a).map(asset => <link key={asset} rel="stylesheet" href={asset} />);

const renderJSAssets = (assets = []) =>
  assets
    .filter(a => !!a)
    .map(asset => {
      if (isString(asset)) {
        asset = { src: asset, crossOrigin: 'anonymous' };
      }
      const crossOrigin = !asset.crossOrigin ? undefined : asset.crossOrigin;
      return <script key={asset.src} src={asset.src} crossOrigin={crossOrigin} />;
    });

const Layout = ({ title, cssAssets, jsAssets, children, header, appData = '', detectedBrowser = {}, cloudEnv }) => {
  const { unknownBrowser, supported, name, version } = detectedBrowser;
  const showUnsupportedBanner = !supported;
  let bannerContent;

  if (unknownBrowser || showUnsupportedBanner) {
    let bannerRecommendation;
    if (name && version) {
      bannerRecommendation = (
        <p>
          Reva works best in a modern browser on your desktop. You appear to be using {name}, version {version}.
        </p>
      );
    } else {
      bannerRecommendation = <p>Reva works best in a modern browser on your desktop. You're using a browser we don't recognize.</p>;
    }

    bannerContent = (
      <div style={{ padding: 20, background: '#fff' }}>
        <h2 style={{ margin: '0 0 .5rem 0' }}>Unsupported Browser</h2>
        {bannerRecommendation}
        <p>
          We strongly suggest installing an{' '}
          <a href="http://outdatedbrowser.com/" target="_blank" rel="noopener noreferrer">
            alternative browser
          </a>{' '}
          to take advantage of Reva.
        </p>
        <br />
      </div>
    );
  }

  if (appData && typeof appData !== 'string') {
    appData = serialize(appData, { isJSON: true });
  }

  const { color } = getFaviconLibrary({ cloudEnv });

  return (
    <html lang="en">
      <head>
        <meta charSet="utf-8" />
        <title>{title}</title>

        <meta name="HandheldFriendly" content="True" />
        <meta name="MobileOptimized" content="320" />

        <meta name="apple-mobile-web-app-capable" content="yes" />
        <meta name="apple-mobile-web-app-status-bar-style" content="black-translucent" />
        <meta name="viewport" content="initial-scale=1.0,user-scalable=no,maximum-scale=1,width=device-width" />
        <meta name="viewport" content="initial-scale=1.0,user-scalable=no,maximum-scale=1" media="(device-height: 568px)" />

        <meta httpEquiv="X-UA-Compatible" content="IE=edge" />

        {/* <!-- Mobile name (work in conjunction with the app icons on Android and iOS) --> */}
        <meta name="apple-mobile-web-app-title" content="Reva" />
        <meta name="application-name" content="Reva" />

        {/* <!-- Basic favicon resources --> */}
        <link rel="icon" type="image/png" href="/favicon-32x32.png" sizes="32x32" />
        <link rel="icon" type="image/png" href="/favicon-16x16.png" sizes="16x16" />

        {/* <!-- Google TV, Opera, and browser future proofing --> */}
        <link rel="icon" type="image/png" href="/favicon-96x96.png" sizes="96x96" />
        <link rel="icon" type="image/png" href="/favicon-128x128.png" sizes="128x128" />
        <link rel="icon" type="image/png" href="/favicon-194x194.png" sizes="194x194" />
        <link rel="icon" type="image/png" href="/favicon-196x196.png" sizes="196x196" />

        {/* <!-- iOS app icons (iOS7+) --> */}
        <link rel="apple-touch-icon" sizes="60x60" href="/apple-touch-icon-60x60.png" />
        <link rel="apple-touch-icon" sizes="76x76" href="/apple-touch-icon-76x76.png" />
        <link rel="apple-touch-icon" sizes="120x120" href="/apple-touch-icon-120x120.png" />
        <link rel="apple-touch-icon" sizes="152x152" href="/apple-touch-icon-152x152.png" />
        <link rel="apple-touch-icon" sizes="180x180" href="/apple-touch-icon-180x180.png" />

        {/* <!-- Safari --> */}
        <link rel="mask-icon" href="/safari-pinned-tab.svg" color={color} />

        {/* <!-- Android app icons --> */}
        <link rel="manifest" href="/manifest.json" />
        <meta name="theme-color" content={color} />
        {/* <!-- Explicit delaration for older versions of Android Chrome --> */}
        <link rel="icon" type="image/png" href="/android-chrome-192x192.png" sizes="192x192" />

        {/* <!-- Windows 8.1 / 10 --> */}
        <meta name="msapplication-TileColor" content={color} />
        <meta name="msapplication-TileImage" content="/mstile-144x144.png" />

        <link rel="shortcut icon" href="/favicon.ico" />
        {renderCssAssets(cssAssets)}
        {header}
      </head>
      <body>
        {bannerContent}
        {children}
        {appData && <script dangerouslySetInnerHTML={{ __html: `window.__appData = ${appData}` }} />}
        {renderJSAssets(jsAssets)}
      </body>
    </html>
  );
};

export default Layout;
