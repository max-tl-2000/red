/*
 * Copyright (c) 2022 Reva Technology Inc., all rights reserved.
 * Unauthorized copying of this file, via any medium is strictly prohibited
 * Licensed under the Elastic License 2.0; you may not use this file except
 * in compliance with the Elastic License 2.0.
 */

import { getMetaFromName } from '../avatar-helpers';
import { data } from './fixtures/names-initials/data';

describe('avatar-helpers/getMetaFromName', () => {
  describe('when a fullName is provided with name and lastName', () => {
    it('should return the first character of each part as initials', () => {
      const { initials } = getMetaFromName('Scooby Doo');
      expect(initials).toEqual('SD');
    });
  });

  describe('when fullName has more name, second name and last name', () => {
    it('should return the first char of first part and first char of the last part', () => {
      const { initials } = getMetaFromName('Scooby Marc Doo');
      expect(initials).toEqual('SD');
    });
  });

  describe('when a fullName contains only one name', () => {
    it('should return only one initial', () => {
      const { initials } = getMetaFromName('Scooby');
      expect(initials).toEqual('S');
    });
  });

  describe('when a fullName contains an email', () => {
    it('should return a question ?', () => {
      const { initials } = getMetaFromName('scooby@doo.com');
      expect(initials).toEqual('?');
    });
  });

  describe('when a fullName contains numbers', () => {
    it('should return a question ?', () => {
      const { initials } = getMetaFromName('(408) 655 3232');
      expect(initials).toEqual('?');
    });
  });

  describe('when a fullName contains a firstName and lastname regardless the middle name', () => {
    it('should return the proper initials', () => {
      const { initials } = getMetaFromName('Snoopy 4084801322 Brown');
      expect(initials).toEqual('SB');
    });
  });

  describe('when a fullName contains a firstName with numbers', () => {
    it('should return the proper initials', () => {
      const { initials } = getMetaFromName('4084801322 Brown');
      expect(initials).toEqual('?');
    });
  });

  describe('when a fullName contains a lastName with numbers', () => {
    it('should return the proper initials', () => {
      const { initials } = getMetaFromName('Brown 4084801322');
      expect(initials).toEqual('?');
    });
  });

  describe('when a fullName contains prefixes and/or suffixes', () => {
    it('should ignore suffixes and prefixes', () => {
      data.forEach(([fullName, expectedInitials]) => {
        const { initials } = getMetaFromName(fullName);
        expect(initials).toEqual(expectedInitials);
      });
    });
  });
});
