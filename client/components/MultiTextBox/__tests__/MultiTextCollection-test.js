/*
 * Copyright (c) 2022 Reva Technology Inc., all rights reserved.
 * Unauthorized copying of this file, via any medium is strictly prohibited
 * Licensed under the Elastic License 2.0; you may not use this file except
 * in compliance with the Elastic License 2.0.
 */

import MultiTextCollection from '../MultiTextCollection';

describe('MultiTextCollection', () => {
  describe('constructor', () => {
    it('should construct an instance of a collection with optional initial values', () => {
      const m = new MultiTextCollection({
        items: [
          { value: 'Some', id: 1 },
          { value: 'label', id: 2 },
          { value: 'here', id: 3 },
        ],
      });
      expect(m.serialized).toEqual([
        { value: 'Some', id: 1 },
        { value: 'label', id: 2 },
        { value: 'here', id: 3 },
      ]);
    });
  });

  describe('add', () => {
    it('should allow to add items to the collection', () => {
      const m = new MultiTextCollection({ items: [] });

      m.add('hello world');

      expect(m.serialized.length).toEqual(1);
      expect(m.serialized[0].value).toEqual('hello world');
    });
    it('should return the instance created to be added to the collection', () => {
      const m = new MultiTextCollection({ items: [] });

      const item = m.add('hello world');
      expect(m.serialized[0].value).toEqual(item.value);
    });
  });

  describe('replaceItems', () => {
    it('should allow to replace the items', () => {
      const m = new MultiTextCollection({
        items: [
          { id: 1, value: 'some val' },
          { id: 2, value: 'from here' },
        ],
      });
      m.replaceItems([
        { id: 2, value: 'changed val' },
        { id: 3, value: 'to here' },
      ]);

      expect(m.serialized).toEqual([
        { id: 2, value: 'changed val' },
        { id: 3, value: 'to here' },
      ]);
    });
  });

  describe('notEmpty', () => {
    it('should remove the entries with empty value', () => {
      const m = new MultiTextCollection({
        items: [
          { id: 1, value: 'some val' },
          { id: 2, value: '' },
          { id: 3, value: 'from here' },
          { id: 4, value: '' },
          { id: 5, value: 'another value' },
        ],
      });

      expect(m.nonEmptySerialized).toEqual([
        { id: 1, value: 'some val' },
        { id: 3, value: 'from here' },
        { id: 5, value: 'another value' },
      ]);
    });
  });

  describe('remove', () => {
    it('should allow to remove an item from the collection', () => {
      const m = new MultiTextCollection({ items: [] });
      const item = m.add('new item to be added');

      m.add('second item');

      expect(m.serialized[0].value).toEqual('new item to be added');
      m.remove(item);
      expect(m.serialized.length).toEqual(1);
      expect(m.serialized[0].value).toEqual('second item');
    });
  });
});
