/*
 * Copyright (c) 2022 Reva Technology Inc., all rights reserved.
 * Unauthorized copying of this file, via any medium is strictly prohibited
 * Licensed under the Elastic License 2.0; you may not use this file except
 * in compliance with the Elastic License 2.0.
 */

import { expect } from 'test-helpers';
import { objectToQueryString } from '../serialize';

describe('serialize', () => {
  describe('objectToQueryString()', () => {
    const f = objectToQueryString;

    describe('result should be an empty string', () => {
      it('param eq {}', () => {
        expect(f({})).to.equal('');
      });

      it('param eq []', () => {
        expect(f([])).to.equal('');
      });

      it('param eq ""', () => {
        expect(f('')).to.equal('');
      });

      it('param eq { foo: "" }', () => {
        expect(f({ foo: '' })).to.equal('');
      });

      it('array w/ no item', () => {
        expect(f({ foo: [] })).to.equal('');
      });
    });

    describe('simple objects', () => {
      it('string w/ spaces', () => {
        expect(f({ foo: 'a string with spaces' })).to.equal('foo=a%20string%20with%20spaces');
      });
    });

    describe('arrays', () => {
      it('array w/ one item', () => {
        expect(f({ foo: [1] })).to.equal('foo=1');
      });

      it('array w/ mutiple items', () => {
        expect(f({ foo: [1, 2] })).to.equal('foo=1&foo=2');
      });
    });

    describe('nested objects', () => {
      it('object w/ one item', () => {
        expect(f({ foo: { bar: 1 } })).to.equal('foo-bar=1');
      });

      it('object w/ multiple items', () => {
        expect(f({ foo: { bar: 1, baz: 2 } })).to.equal('foo-bar=1&foo-baz=2');
      });
    });
  });
});
