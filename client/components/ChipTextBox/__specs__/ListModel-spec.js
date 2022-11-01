/*
 * Copyright (c) 2022 Reva Technology Inc., all rights reserved.
 * Unauthorized copying of this file, via any medium is strictly prohibited
 * Licensed under the Elastic License 2.0; you may not use this file except
 * in compliance with the Elastic License 2.0.
 */

import { expect } from '../../../../common/test-helpers';
import { ListModel } from '../ListModel';
import { data } from './fixtures/data';

describe('ListModel', () => {
  const invalidItem = 'invalid.jp';
  let model;

  afterEach(() => {
    model && model.destroy && model.destroy();
  });

  it('should allow create a model from a dataset', () => {
    model = new ListModel({
      items: data,
    });
    const values = model.values;
    expect(values.length).to.equal(data.length);
  });

  describe('validation', () => {
    it('should only flag as valid if the item passed the regex validation', () => {
      model = new ListModel({
        items: data,
        validation: /^\w+@[a-zA-Z_]+?\.[a-zA-Z]{2,3}$/,
      });
      const validItems = model.values.filter(item => item.valid);
      expect(validItems.length).to.equal(8);
      expect(validItems.filter(item => item.text === invalidItem).length).to.equal(0);
    });

    it('should only flag as valid if the item passed the func validation', () => {
      model = new ListModel({
        items: data,
        validation: text => text.indexOf('@') > -1,
      });
      const validItems = model.values.filter(item => item.valid);
      expect(validItems.length).to.equal(9);
      expect(validItems.filter(item => item.text === invalidItem).length).to.equal(0);
    });
  });
});
