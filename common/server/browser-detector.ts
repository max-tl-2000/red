/*
 * Copyright (c) 2022 Reva Technology Inc., all rights reserved.
 * Unauthorized copying of this file, via any medium is strictly prohibited
 * Licensed under the Elastic License 2.0; you may not use this file except
 * in compliance with the Elastic License 2.0.
 */

import UAParser from 'ua-parser-js';
import { Request } from 'express';
import trim from '../helpers/trim';

interface ISupportedBrowsersHash {
  [key: string]: number;
}

interface IBrowserAliases {
  [key: string]: string;
}

interface IDectedBrowser {
  isABot: boolean;
  unknownBrowser: boolean;
  name: string;
  version: number;
  supported: boolean;
}

export const consumerSupportedBrowsers: ISupportedBrowsersHash = {
  Safari: 11,
  Chrome: 56,
  Firefox: 52,
  IE: 11,
  Edge: 12,
  Opera: 43,
  Vivaldi: 1.9,
  Brave: 1.0,
  'Samsung Browser': 7.2,
};

export const internalSupportedBrowsers: ISupportedBrowsersHash = {
  Safari: 13, // will support webRTC
  Chrome: 80,
  Firefox: 74,
  Vivaldi: 3,
  // IE is no supported
  Edge: 80,
  Opera: 67,
  Brave: 1.9,
  'Samsung Browser': 11,
};

const defaultSupported = consumerSupportedBrowsers;

// Browser flavors whose required version is the same as the base
const browserAliases: IBrowserAliases = {
  Chromium: 'Chrome',
  'Mobile Safari': 'Safari',
};

export const detectBrowserFromUserAgent = (ua: string, supportedBrowsers: ISupportedBrowsersHash = defaultSupported) => {
  ua = trim(ua);

  const result = new UAParser(ua).getResult();
  const { browser = {} } = result;

  const effectiveBrowserName = browserAliases[browser.name] || browser.name;

  const supportedVersion = supportedBrowsers[effectiveBrowserName];

  const currentBrowserVersion = parseInt(result.browser.major, 10);

  const unknownBrowser = typeof supportedVersion === 'undefined';

  const supported = unknownBrowser ? false : currentBrowserVersion >= supportedVersion;

  return {
    isABot: !!ua.match(/googlebot|AhrefsBot|robot|bingbot/i),
    unknownBrowser,
    name: browser.name,
    version: currentBrowserVersion,
    supported,
  };
};

export const detectBrowserFromReq = (req: Request, supportedBrowsers: ISupportedBrowsersHash = defaultSupported): IDectedBrowser =>
  detectBrowserFromUserAgent(req.headers['user-agent'] || '', supportedBrowsers);

export const isRequestFromABot = (req: Request): boolean => detectBrowserFromReq(req).isABot;
