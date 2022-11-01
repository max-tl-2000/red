/*
 * Copyright (c) 2022 Reva Technology Inc., all rights reserved.
 * Unauthorized copying of this file, via any medium is strictly prohibited
 * Licensed under the Elastic License 2.0; you may not use this file except
 * in compliance with the Elastic License 2.0.
 */

import { expect } from 'chai';
import { prepareDataForSearch } from '../searchRepo';

describe('search data preparation tests', () => {
  describe('given an empty string is received', () => {
    it('should retrieve an empty string for the first and last names', () => {
      const name = '';
      const result = prepareDataForSearch(name);

      expect(result.firstName).to.equal('');
      expect(result.lastName).to.equal('');
    });
  });

  describe('given a name is received that contains dashes', () => {
    it('should retrieve the first name and the last name', () => {
      const name = 'David Smith-Weston';
      const result = prepareDataForSearch(name);

      expect(result.firstName).to.equal('David');
      expect(result.lastName).to.equal('Smith-Weston');
    });
  });

  describe('given a name contains special characters', () => {
    it('should retrieve the name with the special characters removed', () => {
      const name = 'ForRent.com | Lead Insights';
      const result = prepareDataForSearch(name);

      expect(result.firstName).to.equal('ForRent.com');
      expect(result.lastName).to.equal('Insights');
    });

    it('should retrieve the name with the special characters removed', () => {
      const name = 'David Smith \[gmail.com\]'; //eslint-disable-line
      const result = prepareDataForSearch(name);

      expect(result.firstName).to.equal('David');
      expect(result.lastName).to.equal('gmail.com');
    });

    it('should retrieve the name with the special characters removed', () => {
      const name = 'Smith, David M';
      const result = prepareDataForSearch(name);

      expect(result.firstName).to.equal('Smith');
      expect(result.lastName).to.equal('');
    });

    it('should retrieve the name with the special characters removed', () => {
      const name = 'Lenore Wawrzonek, SPHR (NC)';
      const result = prepareDataForSearch(name);

      expect(result.firstName).to.equal('Lenore');
      expect(result.lastName).to.equal('Wawrzonek');
    });
  });

  describe('given a name is received that contains apostrophe', () => {
    it('should retrieve the name with the apostrophe split only by space and with :* appended to all words in the string', () => {
      const name = "David O'Leary";
      const result = prepareDataForSearch(name);

      expect(result.firstName).to.equal('David');
      expect(result.lastName).to.equal("O'Leary");
    });
  });

  describe('given a name is received that contains accents', () => {
    it('should retrieve the name split by space as first and last names and without the accent', () => {
      const name = 'Tamás Wagner';
      const result = prepareDataForSearch(name);

      expect(result.firstName).to.equal('Tamas');
      expect(result.lastName).to.equal('Wagner');
    });
  });

  describe('given a name is received that contains a middle initial', () => {
    it('should retrieve the first name as the first string until space and the last name as the last string from the last space till end', () => {
      const name = 'David I Smith';
      const result = prepareDataForSearch(name);

      expect(result.firstName).to.equal('David');
      expect(result.lastName).to.equal('Smith');
    });
  });

  describe('given a name is received that contains multiple spaces', () => {
    it('should retrieve the names split only by space', () => {
      const name = 'Tamás Wagner                               ';
      const result = prepareDataForSearch(name);

      expect(result.firstName).to.equal('Tamas');
      expect(result.lastName).to.equal('Wagner');
    });

    it('should retrieve the names split only by space', () => {
      const name = '                 Tamás                Wagner                               ';
      const result = prepareDataForSearch(name);

      expect(result.firstName).to.equal('Tamas');
      expect(result.lastName).to.equal('Wagner');
    });
  });

  describe('given a name is received that is a phone number', () => {
    it('should retrieve the empty string as both the names', () => {
      const name = '16197384381';
      const result = prepareDataForSearch(name);

      expect(result.firstName).to.equal('');
      expect(result.lastName).to.equal('');
    });

    it('should retrieve the empty string as both the names', () => {
      const name = '(818) 960-1554';
      const result = prepareDataForSearch(name);

      expect(result.firstName).to.equal('');
      expect(result.lastName).to.equal('');
    });

    it('should retrieve the empty string as both the names', () => {
      const name = '+1 619 7384381';
      const result = prepareDataForSearch(name);

      expect(result.firstName).to.equal('');
      expect(result.lastName).to.equal('');
    });
  });

  describe('given a name is received that is an email address', () => {
    it('should retrieve the empty string as both the names', () => {
      const name = 'mircea@reva.tech';
      const result = prepareDataForSearch(name);

      expect(result.firstName).to.equal('');
      expect(result.lastName).to.equal('');
    });
  });
});
