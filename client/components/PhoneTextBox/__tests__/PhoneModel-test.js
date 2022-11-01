/*
 * Copyright (c) 2022 Reva Technology Inc., all rights reserved.
 * Unauthorized copying of this file, via any medium is strictly prohibited
 * Licensed under the Elastic License 2.0; you may not use this file except
 * in compliance with the Elastic License 2.0.
 */

import PhoneModel from '../PhoneModel';

describe('PhoneModel', () => {
  describe('When a phone is provided', () => {
    it('should provide a display value that is formatted', () => {
      const model = new PhoneModel();
      model.setValue('4084809389');
      expect(model.displayValue).toEqual('(408) 480-9389');
    });
    it('should also provide a value field with no formatting that contains the country code', () => {
      const model = new PhoneModel();
      model.setValue('4084809389');
      expect(model.qualifiedValue).toEqual('+14084809389');
    });
    it('should parse 2 different formatted numbers and consider then the same', () => {
      const modelA = PhoneModel.create('4084809389');
      const modelB = PhoneModel.create('+14084809389');
      const modelC = PhoneModel.create('(408) 480-9389');

      expect(modelA.isEqual(modelB)).toBe(true);
      expect(modelA.isEqual(modelC)).toBe(true);
      expect(modelB.isEqual(modelC)).toBe(true);
    });
  });
});
