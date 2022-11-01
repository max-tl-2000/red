/*
 * Copyright (c) 2022 Reva Technology Inc., all rights reserved.
 * Unauthorized copying of this file, via any medium is strictly prohibited
 * Licensed under the Elastic License 2.0; you may not use this file except
 * in compliance with the Elastic License 2.0.
 */

import trim from 'helpers/trim';
import sleep from 'helpers/sleep';
import MultiTextModel from '../MultiTextModel';

describe('MultiTextModel', () => {
  describe('updateValue', () => {
    it('should allow to edit a value of the collection', () => {
      const item = new MultiTextModel({ value: 'hello world', id: 1 });

      item.updateValue('modified text');

      expect(item.value).toEqual('modified text');
    });
  });

  describe('validate', () => {
    it('should not break if validate method is called an no method was provided', async () => {
      const item = new MultiTextModel({ value: 'hello world', id: 1 });

      item.updateValue('modified text');
      await item.validate();

      expect(item.valid).toEqual(true);
    });

    it('should allow to execute simple validation', async () => {
      const item = new MultiTextModel({
        value: 'hello world',
        id: 1,
        validateFn: text => !trim(text),
        defaultError: 'value is required',
      });

      expect(item.valid).toEqual(true);
      await item.validate();

      expect(item.valid).toEqual(false);
      expect(item.error).toEqual('value is required');
    });

    it('should allow to execute async validation', async () => {
      const item = new MultiTextModel({
        value: 'hello world',
        id: 1,
        validateFn: async text => { // eslint-disable-line
          await sleep(1000);
          if (text === 'invalid') return { error: 'Invalid text' };
        },
        defaultError: 'value is required',
      });

      item.updateValue('some text');
      await item.validate();
      expect(item.valid).toEqual(true);

      item.updateValue('invalid');
      await item.validate();

      expect(item.valid).toEqual(false);
      expect(item.error).toEqual('Invalid text');
    });
  });

  describe('clearError', () => {
    it('should clear the error if one is found', async () => {
      const item = new MultiTextModel({
        value: 'hello world',
        id: 1,
        validateFn: async text => { // eslint-disable-line
          await sleep(1000);
          if (text === 'invalid') return { error: 'Invalid text' };
        },
        defaultError: 'value is required',
      });

      item.updateValue('invalid');
      await item.validate();

      expect(item.valid).toEqual(false);
      expect(item.error).toEqual('Invalid text');

      item.clearError();

      expect(item.valid).toEqual(true);
      expect(item.error).toEqual('');
    });
  });

  describe('serialized', () => {
    it('should return the item instance as vanilla JS object', () => {
      const item = new MultiTextModel({
        id: 1,
        value: 'Some text',
      });

      expect(item.serialized).toEqual({ id: 1, value: 'Some text' });
    });
  });
});
