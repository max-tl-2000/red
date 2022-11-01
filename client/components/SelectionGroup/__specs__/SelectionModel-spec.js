/*
 * Copyright (c) 2022 Reva Technology Inc., all rights reserved.
 * Unauthorized copying of this file, via any medium is strictly prohibited
 * Licensed under the Elastic License 2.0; you may not use this file except
 * in compliance with the Elastic License 2.0.
 */

import { expect } from '../../../../common/test-helpers';
import SelectionModel from '../SelectionModel';
import { data } from './fixtures/data';

describe('SelectionModel', () => {
  let model;

  beforeEach(() => {
    model = new SelectionModel({
      items: data,
      valueField: 'id',
      textField: 'title',
    });
  });

  afterEach(() => {
    model && model.destroy();
  });

  it('should allow create a model from a dataset setting valueField and textField', () => {
    const items = model.items.toJS();
    expect(items.length).to.equal(data.length);
  });

  describe('filteredItems', () => {
    it('should return all the elements if query is nullish', () => {
      model.setQuery('');
      const filteredItems = model.items;
      expect(filteredItems.length).to.equal(data.length);
    });

    it('should return only one match if the query matches only 1 element', () => {
      model.setQuery('The Lock');
      const filteredItems = model.items;
      expect(filteredItems.length).to.equal(1);
    });

    it('should return several results if the query matches more than on', () => {
      model.setQuery('Mon');
      const filteredItems = model.items;
      expect(filteredItems.length).to.equal(4);
    });
  });
});
