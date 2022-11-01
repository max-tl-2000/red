/*
 * Copyright (c) 2022 Reva Technology Inc., all rights reserved.
 * Unauthorized copying of this file, via any medium is strictly prohibited
 * Licensed under the Elastic License 2.0; you may not use this file except
 * in compliance with the Elastic License 2.0.
 */

import trim from '../../common/helpers/trim';
/**
 * parse a url converting it into an object with the following properties
 * { search, hostname, origin, protocol, hash, pathname } that are the parsed
 * values of an URL.
 * */
export const parseUrl = url => {
  const link = document.createElement('a');
  link.href = url;
  return link;
};

/**
 * Helper function to get the origin part from an URL
 * */
export const getOrigin = url => {
  const parsed = parseUrl(url);
  const origin = parsed.origin;
  return origin;
};

/**
 * Helper function to parse the query string (search) part of an URL
 *
 * Example:
 *
 * ```
 * // Given a search (query string)
 * const params = parseQueryString('?token=xyz&otherProp=someValue');
 * params === { token: 'xyz', otherProp: 'someValue' };
 * ```
 *
 * */
export const parseQueryString = queryStr => {
  queryStr = trim(queryStr);
  const REGEX_TO_REMOVE_EXTRA_QUESTION_MARK = /\?/;

  const query = decodeURI(queryStr.replace(REGEX_TO_REMOVE_EXTRA_QUESTION_MARK, ''));

  if (query === '') {
    return {};
  }

  const parts = query.split(/[;&]/);

  return parts.reduce((seq, str) => {
    const subParts = str.split('=');
    const len = subParts.length;
    const key = subParts[0];

    if (key) {
      seq[key] = len > 1 ? decodeURIComponent(subParts[1]) : '';
    }

    return seq;
  }, {});
};

/**
 * setQueryParams to an URL
 * Example:
 *
 * ```
 * // Given a url:
 * const url = 'https://domain/path';
 * const newUrl = setQueryParams({ url, params: { token: 'xyz' } });
 *
 * newUrl === https://domain/path?token=xyz
 * ```
 * */
export const setQueryParams = ({ url, params = {}, noEncode } = {}) => {
  url = trim(url);

  let queryParams = [];
  const parts1 = url.split('#');

  const parts2 = parts1[0].split('?');
  const trimParts = trim(parts2[1]);

  if (parts2.length > 1 && trimParts !== '') {
    queryParams = parts2[1].split('&');
  }

  Object.keys(params).forEach(param => {
    const value = params[param];
    queryParams = queryParams.filter(ele => ele.indexOf(`${param}=`) === -1);
    queryParams.push(`${param}=${noEncode ? value : encodeURIComponent(value)}`);
  });

  if (queryParams.length > 0) {
    parts2[1] = queryParams.join('&');
  }

  parts1[0] = parts2.join('?');

  return parts1.join('#');
};

// user friendly signature
// TODO: modify the original to support this signature too
export const setQuery = (url, params, encode = true) => setQueryParams({ url, params, noEncode: !encode });

export const getQueryProps = (location, props = []) => {
  const { search } = location;
  const params = parseQueryString(search);

  return props.reduce((acc, prop) => {
    acc[prop] = params[prop];
    return acc;
  }, {});
};
