/*
 * Copyright (c) 2022 Reva Technology Inc., all rights reserved.
 * Unauthorized copying of this file, via any medium is strictly prohibited
 * Licensed under the Elastic License 2.0; you may not use this file except
 * in compliance with the Elastic License 2.0.
 */

import stringify from 'json-stringify-safe';

import { escapeSingleQuotes, serializeAndEscapeSingleQuotes } from '../escape.js';

describe('escape tests', () => {
  describe('when escaping single quotes in string', () => {
    it('should double the quotes', () => {
      expect(escapeSingleQuotes("that's it, it' enough")).toEqual("that''s it, it'' enough");
    });
  });
  describe('when escaping single quotes in non-string value', () => {
    it('should not alter the value', () => {
      expect(escapeSingleQuotes(42)).toEqual(42);
    });
  });
  describe('when escaping single quotes in an object', () => {
    it('should double the quotes in every string property value', () => {
      const obj = {
        a: "that's it",
        b: "who's there",
        c: 42,
      };
      const expected = {
        a: "that''s it",
        b: "who''s there",
        c: 42,
      };
      expect(escapeSingleQuotes(obj)).toEqual(expected);
    });
  });
  describe('when escaping single quotes in an array', () => {
    it('should double the quotes in every string element', () => {
      const array = [
        42,
        "it's time",
        {
          a: "that's it",
          b: "who's there",
          c: 42,
        },
      ];

      const expected = [
        42,
        "it''s time",
        {
          a: "that''s it",
          b: "who''s there",
          c: 42,
        },
      ];
      expect(escapeSingleQuotes(array)).toEqual(expected);
    });
  });

  describe('when escaping single quotes in an object cicular object', () => {
    it('should not throw', () => {
      const array = [
        42,
        "it's time",
        {
          a: "that's it",
          b: "who's there",
          c: 42,
        },
      ];

      array[2].arr = array;

      expect(stringify(escapeSingleQuotes(array), null, 2)).toMatchSnapshot();
    });
    describe('serializeAndEscapeSingleQuotes', () => {
      it('should detect cycles if any', () => {
        const array = [
          42,
          "it's time",
          {
            a: "that's it",
            b: "who's there",
            c: 42,
          },
        ];

        array[2].arr = array;

        const { serialized, hasCycles } = serializeAndEscapeSingleQuotes(array);

        expect(serialized).toMatchSnapshot();
        expect(hasCycles).toEqual(true);
      });

      it('should not detect cycles if none', () => {
        const array = [
          42,
          "it's time",
          {
            a: "that's it",
            b: "who's there",
            c: 42,
          },
        ];

        const { serialized, hasCycles } = serializeAndEscapeSingleQuotes(array);

        expect(serialized).toMatchSnapshot();
        expect(hasCycles).toEqual(false);
      });
    });
  });
});
