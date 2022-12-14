/*
 * Copyright (c) 2022 Reva Technology Inc., all rights reserved.
 * Unauthorized copying of this file, via any medium is strictly prohibited
 * Licensed under the Elastic License 2.0; you may not use this file except
 * in compliance with the Elastic License 2.0.
 */

import sleep from 'helpers/sleep';
import { createModel } from '../Form/FormModel';
import { VALIDATION_TYPES } from '../Form/Validation';

describe('form-model', () => {
  describe('restoreInitialValues', () => {
    it('should reset the initial values on the form', () => {
      const model = createModel({ valueA: '', valueB: '' });

      model.updateField('valueA', 'some');
      model.updateField('valueB', 'b');

      expect(model.valueOf('valueA')).toEqual('some');
      expect(model.valueOf('valueB')).toEqual('b');

      model.restoreInitialValues();

      expect(model.valueOf('valueA')).toEqual('');
      expect(model.valueOf('valueB')).toEqual('');
    });

    it('should reset the initial values on the form even if not empty strings', () => {
      const model = createModel({ valueA: [], valueB: [] });

      model.updateField('valueA', [1, 2, 3]);
      model.updateField('valueB', [4, 5, 6]);

      expect(model.valueOf('valueA')).toEqual([1, 2, 3]);
      expect(model.valueOf('valueB')).toEqual([4, 5, 6]);

      model.restoreInitialValues();

      expect(model.valueOf('valueA')).toEqual([]);
      expect(model.valueOf('valueB')).toEqual([]);
    });
  });

  describe('serializedData', () => {
    it('should return always the data serialized as a Javascript object', () => {
      const model = createModel({ name: 'John', lastName: 'Doe' });
      expect(model.serializedData).toEqual({ name: 'John', lastName: 'Doe' });

      model.updateField('name', 'Jane');
      model.updateField('lastName', 'Martins');

      expect(model.serializedData).toEqual({
        name: 'Jane',
        lastName: 'Martins',
      });
    });
  });

  describe('validate', () => {
    it('should perform the validation. After executed, the valid flag can be used to determine if data is valid or not', async () => {
      const model = createModel(
        { name: 'Jonh', lastName: 'Doe', email: '' },
        {
          // using generic validation
          name: {
            validationType: VALIDATION_TYPES.REQUIRED,
            errorMessage: 'name is required',
          },
          // using a custom validation functiont that returns a Boolean
          lastName: {
            fn: field => field.value.length > 4,
            errorMessage: 'lastName must have at least 4 chars',
          },
          // using an async function that throws when it fails, since throws are converted to rejections
          // this just works. If validation passed no need to return anything.
          email: {
            fn: async ({ value }) => {
              await sleep(100);

              if (value === 'johndoe@gmail.com') {
                throw new Error('Email already used');
              }
            },
          },
        },
      );

      await model.validate();

      expect(model.valid).toEqual(false);
      expect(model.summary).toEqual(['lastName must have at least 4 chars']);

      model.updateField('lastName', 'Doe Run');
      await model.validate();

      expect(model.valid).toEqual(true);
      expect(model.summary).toEqual([]);

      model.updateField('email', 'johndoe@gmail.com');
      await model.validate();

      expect(model.valid).toEqual(false);
      expect(model.summary).toEqual(['Email already used']);

      model.updateField('email', 'bob@gmail.com');
      await model.validate();

      expect(model.valid).toEqual(true);
      expect(model.summary).toEqual([]);
    });
  });

  describe('requiredAreFilled', () => {
    it('should be true if all required fields have a value', () => {
      const model = createModel(
        { name: '', lastName: '', email: '' },
        {
          name: { required: true, requiredMessage: 'The name is required' },
          lastName: {
            required: ({ fields }) => !!fields.name.value,
            requiredMessage: 'lastName is required',
          },
          email: {
            required: ({ fields }) => fields.lastName.value === 'Doo',
            requiredMessage: 'Email is required for all Doos',
          }, // only required when last name is Doo
        },
      );

      expect(model.requiredAreFilled).toBe(false);
      expect(model.requiredFields).toEqual(['name']);

      model.updateField('name', 'John');

      expect(model.requiredAreFilled).toBe(false); // now lastName is also required!
      expect(model.requiredFields.sort()).toEqual(['name', 'lastName'].sort());

      model.updateField('lastName', 'Doo');

      expect(model.requiredFields.sort()).toEqual(['name', 'lastName', 'email'].sort());
      expect(model.requiredAreFilled).toBe(false);

      model.updateField('email', 'some@email.com');
      expect(model.requiredAreFilled).toBe(true);
    });

    it('should allow the creation of a form that will track if all required fields are filled', async () => {
      const model = createModel(
        { name: '', lastName: '', email: '' },
        {
          // using generic validation
          name: { required: 'Name is required' },
          // using a custom validation functiont that returns a Boolean
          lastName: {
            required: 'lastName is required',
            fn: field => field.value !== 'Doe',
            errorMessage: 'Please do not enter Doe',
          },
          // using an async function that throws when it fails, since throws are converted to rejections
          // this just works. If validation passed no need to return anything.
          email: {
            fn: async ({ value }) => {
              await sleep(100);

              if (value === 'johndoe@gmail.com') {
                throw new Error('Email already used');
              }
            },
          },
        },
      );

      expect(model.requiredAreFilled).toEqual(false);

      model.updateField('name', 'Snoopy');
      expect(model.requiredAreFilled).toEqual(false);

      model.updateField('lastName', 'Doo');
      expect(model.requiredAreFilled).toEqual(true);

      await model.validate();
      expect(model.valid).toEqual(true);

      model.updateFrom({
        name: '',
        lastName: 'Doe',
        email: 'johndoe@gmail.com',
      });

      await model.validate();
      expect(model.valid).toEqual(false);

      expect(model.summary).toEqual(['Name is required', 'Please do not enter Doe', 'Email already used']);
    });

    it('CPM-9593 - errors thrown inside the validator execution should not break the validation when validation is not async', async () => {
      const model = createModel(
        { name: '', lastName: '', email: '' },
        {
          // using generic validation
          name: { required: 'Name is required' },
          // using a custom validation functiont that returns a Boolean
          lastName: {
            required: 'lastName is required',
            fn: field => field.value !== 'Doe',
            errorMessage: 'Please do not enter Doe',
          },
          // using an async function that throws when it fails, since throws are converted to rejections
          // this just works. If validation passed no need to return anything.
          email: {
            fn: ({ value }) => {
              if (value === 'johndoe@gmail.com') {
                throw new Error('Email already used');
              }
            },
          },
        },
      );

      expect(model.requiredAreFilled).toEqual(false);

      model.updateField('name', 'Snoopy');
      expect(model.requiredAreFilled).toEqual(false);

      model.updateField('lastName', 'Doo');
      expect(model.requiredAreFilled).toEqual(true);

      await model.validate();
      expect(model.valid).toEqual(true);

      model.updateFrom({
        name: '',
        lastName: 'Doe',
        email: 'johndoe@gmail.com',
      });

      await model.validate();
      expect(model.valid).toEqual(false);

      expect(model.summary).toEqual(['Name is required', 'Please do not enter Doe', 'Email already used']);
    });
  });
});
