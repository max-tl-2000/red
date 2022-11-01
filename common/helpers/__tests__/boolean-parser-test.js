/*
 * Copyright (c) 2022 Reva Technology Inc., all rights reserved.
 * Unauthorized copying of this file, via any medium is strictly prohibited
 * Licensed under the Elastic License 2.0; you may not use this file except
 * in compliance with the Elastic License 2.0.
 */

import { expect, when } from '../../test-helpers';
import parse from '../booleanParser';

describe('bool parser', () => {
  when('a falsy value is provided', () => {
    it('should return boolean false', () => {
      expect(parse()).to.equal(false);
    });
  });

  when('string `false` is provided', () => {
    it('should return boolean false', () => {
      expect(parse('false')).to.equal(false);
    });
  });

  when('a truthy value is provided', () => {
    it('should return boolean true', () => {
      expect(parse('not-false')).to.equal(true);
    });
  });
});
