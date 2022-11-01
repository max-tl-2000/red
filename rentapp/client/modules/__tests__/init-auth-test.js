/*
 * Copyright (c) 2022 Reva Technology Inc., all rights reserved.
 * Unauthorized copying of this file, via any medium is strictly prohibited
 * Licensed under the Elastic License 2.0; you may not use this file except
 * in compliance with the Elastic License 2.0.
 */

import * as ov from 'test-helpers/overrider';
import * as globals from '../../../../common/helpers/globals';
import { Auth } from '../../stores/classes/auth';
import { apiClient } from '../api-client';

let initAuth;
let auth;
let storage;
let apiClientMock;

describe('init-auth', () => {
  afterEach(() => ov.restore());
  beforeEach(() => {
    storage = {
      removeItem: jest.fn(),
    };
    ov.override(globals, {
      sessionStorage: storage,
    });

    apiClientMock = {
      setExtraHeaders: jest.fn(),
      clearHeaders: jest.fn(),
    };

    ov.override(apiClient, apiClientMock);

    auth = new Auth({ apiClient });

    initAuth = require('../init-auth').initAuth; // eslint-disable-line
  });

  it('should store the token and the userId if they are received thru the path parameter', () => {
    const dispose = initAuth({
      auth,
      location: { pathname: '/welcome/xyz', search: '?userId=123' },
    });

    expect(auth.isAuthenticated).toEqual(true);
    expect(auth.isUserLogged).toEqual(true);

    // should be stored in the auth instance
    expect(auth.token).toEqual('xyz');

    // should be stored in sessionStorage
    expect(storage.__authData__).toEqual(JSON.stringify({ token: 'xyz', userId: '123' }));

    // should be set in the headers of the apiClient
    expect(apiClient.setExtraHeaders).toHaveBeenCalledWith({
      Authorization: 'Bearer xyz',
    });

    // kill the autorun
    dispose();
  });

  it('should do nothing if the token is not provided as path parameter and it is not in the sessionStorage', () => {
    const onLogout = jest.fn();
    const dispose = initAuth({
      auth,
      location: { pathname: '/welcome' },
      onLogout,
    });

    expect(auth.isAuthenticated).toEqual(false);
    expect(auth.token).toEqual(null);
    expect(onLogout).toHaveBeenCalled();
    dispose();
  });

  describe('when logout is called in the auth instance', () => {
    it('should set the isAuthenticated flag to false', () => {
      const onLogout = jest.fn();
      const dispose = initAuth({
        auth,
        location: { pathname: '/welcome/xyz' },
        onLogout,
      });

      auth.logout();

      expect(auth.isAuthenticated).toEqual(false);
      // kill the autorun
      dispose();
    });

    it('it should clear the token and the userId from the auth instance', () => {
      const onLogout = jest.fn();
      const dispose = initAuth({
        auth,
        location: { pathname: '/welcome/xyz' },
        onLogout,
      });

      auth.logout();

      expect(auth.token).toEqual(null);
      expect(auth.userId).toEqual(null);
      // kill the autorun
      dispose();
    });

    it('should remove the key from the sessionStorage', () => {
      const onLogout = jest.fn();
      const dispose = initAuth({
        auth,
        location: { pathname: '/welcome/xyz' },
        onLogout,
      });

      auth.logout();

      expect(storage.removeItem).toHaveBeenCalledWith('__authData__');

      // kill the autorun
      dispose();
    });

    it('should clear the headers in apiClient instance', () => {
      const onLogout = jest.fn();
      const dispose = initAuth({
        auth,
        location: { pathname: '/welcome/xyz' },
        onLogout,
      });

      auth.logout();

      expect(apiClient.clearHeaders).toHaveBeenCalled();

      // kill the autorun
      dispose();
    });

    it('should fire the onLogout callback', () => {
      const onLogout = jest.fn();
      const dispose = initAuth({
        auth,
        location: { pathname: '/welcome/xyz' },
        onLogout,
      });

      auth.logout();

      expect(onLogout).toHaveBeenCalled();

      // kill the autorun
      dispose();
    });
  });

  describe('when hydrate is called with a new token', () => {
    it('should replace the token in apiClient', () => {
      const dispose = initAuth({
        auth,
        location: { pathname: '/welcome/xyz' }, // token is taken from the pathParameter
      });

      auth.hydrate({ token: 'abc' });

      expect(apiClient.setExtraHeaders).toHaveBeenCalledWith({
        Authorization: 'Bearer abc',
      });
      // kill the autorun
      dispose();
    });

    it('should replace the token in the auth instance', () => {
      const dispose = initAuth({
        auth,
        location: { pathname: '/welcome/xyz' }, // token is taken from the pathParameter
      });

      auth.hydrate({ token: 'abc' });

      expect(auth.token).toEqual('abc');
      // kill the autorun
      dispose();
    });

    it('should replace the token in sessionStorage', () => {
      const dispose = initAuth({
        auth,
        location: { pathname: '/welcome/xyz' }, // token is taken from the pathParameter
      });

      auth.hydrate({ token: 'abc' });

      expect(storage.__authData__).toEqual(JSON.stringify({ token: 'abc', userId: null }));
      // kill the autorun
      dispose();
    });

    it('should report isAuthenticated as true in the auth instance', () => {
      const dispose = initAuth({
        auth,
        location: { pathname: '/welcome/xyz' }, // token is taken from the pathParameter
      });

      auth.hydrate({ token: 'abc' });

      expect(auth.isAuthenticated).toEqual(true);

      // kill the autorun
      dispose();
    });
  });

  describe('when the token is not in the pathParameter but already in sessionStorage', () => {
    it('should hydrate the token from sessionStorage', () => {
      storage.__authData__ = JSON.stringify({ token: 'abcdef', userId: null });

      const dispose = initAuth({
        auth,
        location: { pathname: '/applicationDetails/' }, // token is not in the pathParameter
      });

      expect(auth.isAuthenticated).toEqual(true);
      expect(auth.token).toEqual('abcdef');
      // kill the autorun
      dispose();
    });

    it('should set the headers in apiClient', () => {
      storage.__authData__ = JSON.stringify({ token: 'abcdef', userId: null });

      const dispose = initAuth({
        auth,
        location: { pathname: '/applicationDetails/' }, // token is not in the pathParameter
      });

      expect(apiClient.setExtraHeaders).toHaveBeenCalledWith({
        Authorization: 'Bearer abcdef',
      });
      // kill the autorun
      dispose();
    });
  });
});
