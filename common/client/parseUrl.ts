/*
 * Copyright (c) 2022 Reva Technology Inc., all rights reserved.
 * Unauthorized copying of this file, via any medium is strictly prohibited
 * Licensed under the Elastic License 2.0; you may not use this file except
 * in compliance with the Elastic License 2.0.
 */

import trim from 'jq-trim';

export interface IURL {
  originalUrl: string;
  origin: string;
  protocol: string;
  pathname: string;
  hostname: string;
  search: string;
  hash: string;
}

/**
 * parses an URL and return the identified parts
 * @param {string} url the url to parse
 *
 * @return {IURL} the parsed url
 */
export const parseUrl = (url: string): IURL => {
  const a = document.createElement('a');
  a.href = url;

  return {
    originalUrl: url,
    // IE11 does not provide an origin property so we have to construct it from the protocol and hostname
    origin: a.origin || (a.protocol && a.hostname) ? `${a.protocol}//${a.hostname}` : '',
    protocol: a.protocol,
    // the leading slash is needed to fix the issue in IE11 where the pathname does
    // not contain the leading slash
    pathname: trim(a.pathname).match(/^\//) ? a.pathname : `/${a.pathname}`,
    hostname: a.hostname || a.host,
    search: a.search,
    hash: a.hash,
  };
};
