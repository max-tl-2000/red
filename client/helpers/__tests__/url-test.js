/*
 * Copyright (c) 2022 Reva Technology Inc., all rights reserved.
 * Unauthorized copying of this file, via any medium is strictly prohibited
 * Licensed under the Elastic License 2.0; you may not use this file except
 * in compliance with the Elastic License 2.0.
 */

import { getOrigin, setQueryParams, parseQueryString, parseUrl } from '../url';

describe('url', () => {
  describe('parseUrl', () => {
    const url = 'https://roommates.local.env.reva.tech/register?token=1&anotherProp=2#/path/to/example';
    const { search, hostname, origin, protocol, hash, pathname } = parseUrl(url);

    expect(search).toEqual('?token=1&anotherProp=2');
    expect(hostname).toEqual('roommates.local.env.reva.tech');
    expect(origin).toEqual('https://roommates.local.env.reva.tech');
    expect(protocol).toEqual('https:');
    expect(hash).toEqual('#/path/to/example');
    expect(pathname).toEqual('/register');
  });

  describe('getOrigin', () => {
    it('should return the origin part of a given url', () => {
      const origin = getOrigin('http://www.google.com/some/path');
      expect(origin).toEqual('http://www.google.com');
    });

    it('should return the origin part of a given secure url', () => {
      const origin = getOrigin('https://www.google.com/some/path');
      expect(origin).toEqual('https://www.google.com');
    });
  });

  describe('setQueryParams', () => {
    it('should set the queryParams to the provided url', () => {
      const url = 'https://roommates.local.env.reva.tech/register';
      const expected = 'https://roommates.local.env.reva.tech/register?token=xyz';

      expect(setQueryParams({ url, params: { token: 'xyz' } })).toEqual(expected);
    });

    it('should encode parameters', () => {
      const url = 'https://roommates.local.env.reva.tech/register';
      const expected = 'https://roommates.local.env.reva.tech/register?token=xyz&anotherProp=some%20text';

      expect(
        setQueryParams({
          url,
          params: { token: 'xyz', anotherProp: 'some text' },
        }),
      ).toEqual(expected);
    });
  });

  describe('parseQueryString', () => {
    it('should parse the query string and return an object with key values', () => {
      const url = 'https://roommates.local.env.reva.tech/register?token=xyz&anotherProp=some%20text';
      const { search } = parseUrl(url);
      expect(parseQueryString(search)).toEqual({
        token: 'xyz',
        anotherProp: 'some text',
      });
    });

    it('should parse values as strings', () => {
      const url = 'https://roommates.local.env.reva.tech/register?token=1&anotherProp=2';
      const { search } = parseUrl(url);
      expect(parseQueryString(search)).toEqual({
        token: '1',
        anotherProp: '2',
      });
    });
  });
});
