/*
 * Copyright (c) 2022 Reva Technology Inc., all rights reserved.
 * Unauthorized copying of this file, via any medium is strictly prohibited
 * Licensed under the Elastic License 2.0; you may not use this file except
 * in compliance with the Elastic License 2.0.
 */

import { expect } from 'chai';
import { replaceSpecialChar } from '../searchUtils';

describe('replaceSpecialChar', () => {
  const emptyResult = '';
  const scapedResult = '\\+\\-';
  const charAndLetterResult = 'test done';
  const scapedLetterResult = 'test\\-done\\+';

  it('when query is a character except - or + it should return an empty space', () => {
    const res = replaceSpecialChar('=&|><!(){}[]^~":*?/\\');
    expect(res).to.equal(emptyResult);
  });

  it('when query is a - or + it should return the query scaped', () => {
    const res = replaceSpecialChar('+-');
    expect(res).to.equal(scapedResult);
  });

  it('when query has letters and special characters except - or +, it should return the query without the characters', () => {
    const res = replaceSpecialChar('test(done)');
    expect(res).to.equal(charAndLetterResult);
  });

  it('when query has letters and  - or +, it should return - and + scaped', () => {
    const res = replaceSpecialChar('test-done+');
    expect(res).to.equal(scapedLetterResult);
  });
});
