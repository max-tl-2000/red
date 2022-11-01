/*
 * Copyright (c) 2022 Reva Technology Inc., all rights reserved.
 * Unauthorized copying of this file, via any medium is strictly prohibited
 * Licensed under the Elastic License 2.0; you may not use this file except
 * in compliance with the Elastic License 2.0.
 */

import helmet from 'helmet';
import { resolveWebSocketURL } from '../../common/server/resolve-helper';

const oneYearInMillis = 60 * 60 * 24 * 365 * 1000;
let isContentPolicySet = false;

/*
Helmet will add by default 7/10 recommended security headers, leaving out Content-Security-Policy,
Public-Key-Pins and Cache-Control for the developer to configure and enable if needed.

Strict-Transport-Security:max-age=31536000; includeSubDomains; preload
Get user agent to enforce the use of HTTPS.

X-Frame-Options:DENY
By preventing a browser from framing our site we can defend against clickjacking. Can be set to SAMEORIGIN.

X-XSS-Protection:1; mode=block
Sets the configuration for the cross-site scripting filter built into most browsers.

X-Content-Type-Options:nosniff
It reduces exposure to drive-by downloads and the risks of user uploaded content that, with clever naming,
could be treated as a different content-type, like an executable.
This is disabled, some of our app's content is not providing correct mime types yet.

X-Download-Options:noopen
Prevent IE users from executing downloads in app's context like untrusted html pages.

X-DNS-Prefetch-Control:off
Some browsers can start doing DNS lookups of other domains before visiting those domains. This can improve
performance but can worsen security with DNS lookup abuse. This hurts performance so it's disabled for now.

X-Powered-By: Express
Helmet removes this header to hide underlying technology stack which attackers can use
to exploit known security holes. Ideally the Server header should also be removed, but the ELB is taking
care of that.
*/
export const setDefaultHeaderSecurity = app =>
  app.use(
    helmet({
      frameguard: {
        action: 'deny', // X-Frame-Options: DENY
      },
      hsts: {
        maxAge: oneYearInMillis, // 31536000000
        includeSubdomains: true,
        preload: true,
      },
      dnsPrefetchControl: false, // disable X-DNS-Prefetch-Control header
      noSniff: false, // disable X-Content-Type-Options: nosniff
    }),
  );

/*
Content-Security-Policy
The Content security policy is an effective measure to protect against XSS attacks. By whitelisting sources
of approved content, you can prevent the browser from loading malicious assets.

Special considerations:
raw lead page requires unsafe-inline
jquery, react, fbjs requires unsafe-inline
*/
const contentSecurityPolicy = {
  directives: {
    defaultSrc: ["'none'"],
    scriptSrc: ["'self'", 'cdnjs.cloudflare.com', 's3.amazonaws.com', 'code.jquery.com', "'unsafe-inline'"],
    styleSrc: ["'self'", 'fonts.googleapis.com', 'cdnjs.cloudflare.com', 'blob:', "'unsafe-inline'"],
    imgSrc: ["'self'", 's3.amazonaws.com', 'lorempixel.com'], // external images should be removed
    connectSrc: ["'self'", 'wss://phone.plivo.com:5063'],
    fontSrc: ['cdnjs.cloudflare.com', 'fonts.gstatic.com'],
    mediaSrc: ["'self'", 's3.amazonaws.com'],
    objectSrc: [],
    reportUri: '/report-violation',
  },
  disableAndroid: false, // Set to true if you want to disable CSP on Android where it can be buggy
  reportOnly: true,
};

const setContentSecurityPolicyHeader = config => (req, res, next) => {
  const webSocketUrl = resolveWebSocketURL(req.get('Host'), req.get('X-Forwarded-Proto'), config.wsPort);

  if (!isContentPolicySet) {
    if (config.isDevelopment) {
      // this is needed to make sure
      // the app works ok using WP_DEVTOOL=eval, eval-source-map, cheap-eval-source-map, etc
      contentSecurityPolicy.directives.scriptSrc.push("'unsafe-eval'");
    }
    contentSecurityPolicy.directives.connectSrc.push(webSocketUrl); // add app websocket url
    isContentPolicySet = true;
  }

  return helmet.contentSecurityPolicy(contentSecurityPolicy)(req, res, next);
};

export const setContentSecurityPolicy = (app, config) => app.use(setContentSecurityPolicyHeader(config));

/*
The server configuration takes care of most of the configured headers, but calls to /api/ still show the
X-Powered-By header.
*/
export const setDefaultAPIHeaderSecurity = app => app.use(helmet.hidePoweredBy());
