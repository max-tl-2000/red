/*
 * Copyright (c) 2022 Reva Technology Inc., all rights reserved.
 * Unauthorized copying of this file, via any medium is strictly prohibited
 * Licensed under the Elastic License 2.0; you may not use this file except
 * in compliance with the Elastic License 2.0.
 */

import { expect } from 'chai';
import trim from 'lodash/trim';
import { createModel } from '../Form/FormModel';
import sleep from '../../../common/helpers/sleep';
import { VALIDATION_TYPES } from '../Form/Validation';

const REQUIRED_VALIDATION_MESSAGE = 'The field is required';
const EMAIL_VALIDATION_MESSAGE = 'Please enter a valid email address';
const DATE_VALIDATION_MESSAGE = 'Please enter a valid date';
const DATE_ES_FORMAT = 'DD/MM/YYYY';

describe('Form Model Validations', () => {
  it('Apply valiation after a value is set', async () => {
    const model = createModel(
      {
        name: '',
      },
      {
        name: {
          errorMessage: REQUIRED_VALIDATION_MESSAGE,
          interactive: true,
          validationType: VALIDATION_TYPES.REQUIRED,
        },
      },
    );

    // initially form should be valid even if no value is provided for
    // a required field.
    //
    // This is just to avoid showing an error until the user interacts
    // with the form in any case this is safe because we should always call
    // validate before we attempt to do anything with the form
    // data. We might as well cache the result of the validator
    // so for the same value we don't execute the validator again
    // if the field was already determined to be valid
    expect(model.valid).to.equal(true);

    model.updateField('name', 'some');

    // this is required to wait for the debounced validation
    await sleep(310);

    expect(model.valid).to.equal(true);

    model.updateField('name', '');

    // this is required to wait for the debounced validation
    await sleep(310);

    expect(model.valid).to.equal(false);

    // we should always call validate before we attempt to get the form data
    // we can improve this later to make fields that didn't change and were
    // considered valid to not evaluate the validators
    await model.validate();

    expect(model.valid).to.equal(false);
    expect(model.errorOf('name')).to.equal(REQUIRED_VALIDATION_MESSAGE);
  });

  describe('Custom Validations', () => {
    it('Using required custom validation', async () => {
      const model = createModel(
        {
          name: '',
        },
        {
          name: {
            errorMessage: REQUIRED_VALIDATION_MESSAGE,
            interactive: true,
            fn: ({ value }) => !!trim(value),
          },
        },
      );

      await model.validate();

      expect(model.valid).to.equal(false);
      expect(model.errorOf('name')).to.equal(REQUIRED_VALIDATION_MESSAGE);
    });

    it('Should require an international address if the user have an international address', async () => {
      const model = createModel(
        {
          hasInternationalAddress: true,
          addressLine: 'happy land #123',
        },
        {
          addressLine: {
            errorMessage: 'addressLine required',
            interactive: true,
          fn: (field, fields) => { // eslint-disable-line
              if (fields.hasInternationalAddress.value) {
                return !!trim(field.value);
              }
            },
          },
        },
      );
      await model.validate();
      expect(model.valid).to.equal(true);
      expect(model._getField('addressLine').errorMessage).to.be.empty;
    });

    it('Should not require an international address if the user does not have an international address', async () => {
      const model = createModel(
        {
          hasInternationalAddress: false,
          addressLine: '',
        },
        {
          addressLine: {
            errorMessage: 'addressLine required',
            interactive: true,
          fn: (field, fields) => { // eslint-disable-line
              if (fields.hasInternationalAddress.value) {
                return !!trim(field.value);
              }
            },
          },
        },
      );
      await model.validate();
      expect(model.valid).to.equal(true);
      expect(model._getField('addressLine').errorMessage).to.be.empty;
    });

    it('Should display a validation message if the user have an international address and he does not provide an international address', async () => {
      const model = createModel(
        {
          hasInternationalAddress: true,
          addressLine: '',
        },
        {
          addressLine: {
            errorMessage: 'addressLine required',
            interactive: true,
          fn: (field, fields) => { // eslint-disable-line
              if (fields.hasInternationalAddress.value) {
                return !!trim(field.value);
              }
            },
          },
        },
      );
      await model.validate();
      expect(model.valid).to.equal(false);
      expect(model.errorOf('addressLine')).to.equal('addressLine required');
    });

    it('Should display a validation message if the user does not have an international address and he does not provide a domestic address', async () => {
      const model = createModel(
        {
          hasInternationalAddress: false,
          addressLine1: '',
        },
        {
          addressLine1: {
            errorMessage: 'addressLine1 required',
            interactive: true,
          fn: (field, fields) => { // eslint-disable-line
              if (!fields.hasInternationalAddress.value) {
                return !!trim(field.value);
              }
            },
          },
        },
      );
      await model.validate();
      expect(model.valid).to.equal(false);
      expect(model.errorOf('addressLine1')).to.equal('addressLine1 required');
    });

    it('Should not require a domestic address if the user have an international address', async () => {
      const model = createModel(
        {
          hasInternationalAddress: true,
          addressLine1: '',
        },
        {
          addressLine1: {
            errorMessage: 'addressLine1 required',
            interactive: true,
          fn: (field, fields) => { // eslint-disable-line
              if (!fields.hasInternationalAddress.value) {
                return !!trim(field.value);
              }
            },
          },
        },
      );
      await model.validate();
      expect(model.valid).to.equal(true);
      expect(model._getField('addressLine1').errorMessage).to.be.empty;
    });
  });

  describe('Required Validations', () => {
    it('Using validationType as string without custom validations', async () => {
      const model = createModel(
        {
          name: '',
        },
        {
          name: {
            errorMessage: REQUIRED_VALIDATION_MESSAGE,
            interactive: true,
            validationType: VALIDATION_TYPES.REQUIRED,
          },
        },
      );

      await model.validate();

      expect(model.valid).to.equal(false);
      expect(model._getField('name').errorMessage).to.equal(REQUIRED_VALIDATION_MESSAGE);
    });

    it('Using validationType as string with custom validations', async () => {
      const errorMessage = 'Please enter at least 3 characters';
      const model = createModel(
        {
          name: 'ab',
        },
        {
          name: {
            errorMessage: REQUIRED_VALIDATION_MESSAGE,
            interactive: true,
            validationType: VALIDATION_TYPES.REQUIRED,
            fn: ({ value }) => (value.length < 3 ? { error: errorMessage } : true),
          },
        },
      );

      await model.validate();

      expect(model.valid).to.equal(false);
      expect(model.errorOf('name')).to.equal(errorMessage);
    });

    it('Using validationType as array settings and use custom error message', async () => {
      const model = createModel(
        {
          name: '',
        },
        {
          name: {
            interactive: true,
            validationType: [
              {
                type: VALIDATION_TYPES.REQUIRED,
                errorMessage: REQUIRED_VALIDATION_MESSAGE,
              },
            ],
          },
        },
      );

      await model.validate();

      expect(model.valid).to.equal(false);
      expect(model.errorOf('name')).to.equal(REQUIRED_VALIDATION_MESSAGE);
    });

    it('Using validationType as array settings and use common error message', async () => {
      const errorMessage = 'Common error message';
      const model = createModel(
        {
          name: '',
        },
        {
          name: {
            errorMessage,
            interactive: true,
            validationType: [VALIDATION_TYPES.REQUIRED],
          },
        },
      );

      await model.validate();

      expect(model.valid).to.equal(false);
      expect(model.errorOf('name')).to.equal(errorMessage);
    });
  });

  describe('Email Validations', () => {
    it('Valid and not required email address', async () => {
      const model = createModel(
        {
          email: '',
        },
        {
          email: {
            errorMessage: EMAIL_VALIDATION_MESSAGE,
            interactive: true,
            validationType: VALIDATION_TYPES.EMAIL,
          },
        },
      );

      await model.validate();

      expect(model.valid).to.equal(true);
      expect(model.errorOf('email')).to.be.empty;
    });

    it('Invalid and not required email address', async () => {
      const model = createModel(
        {
          email: 'test@red',
        },
        {
          email: {
            interactive: true,
            validationType: [
              {
                type: VALIDATION_TYPES.EMAIL,
                errorMessage: EMAIL_VALIDATION_MESSAGE,
              },
            ],
            // shorthand
            // errorMessage: EMAIL_VALIDATION_MESSAGE,
            // validationType: VALIDATION_TYPES.EMAIL,
          },
        },
      );

      await model.validate();

      expect(model.valid).to.equal(false);
      expect(model._getField('email').errorMessage).to.equal(EMAIL_VALIDATION_MESSAGE);
    });

    it('Valid and required email address', async () => {
      const model = createModel(
        {
          email: 'test@reva.tech',
        },
        {
          email: {
            interactive: true,
            validationType: [
              {
                type: VALIDATION_TYPES.REQUIRED,
                errorMessage: REQUIRED_VALIDATION_MESSAGE,
              },
              {
                type: VALIDATION_TYPES.EMAIL,
                errorMessage: EMAIL_VALIDATION_MESSAGE,
              },
            ],
          },
        },
      );

      await model.validate();

      expect(model.valid).to.equal(true);
      expect(model._getField('email').errorMessage).to.be.empty;
    });

    it('Invalid and required email address', async () => {
      const model = createModel(
        {
          email: 'test@',
        },
        {
          email: {
            errorMessage: REQUIRED_VALIDATION_MESSAGE,
            interactive: true,
            validationType: [
              VALIDATION_TYPES.REQUIRED,
              {
                type: VALIDATION_TYPES.EMAIL,
                errorMessage: EMAIL_VALIDATION_MESSAGE,
              },
            ],
          },
        },
      );

      await model.validate();

      expect(model.valid).to.equal(false);
      expect(model._getField('email').errorMessage).to.equal(EMAIL_VALIDATION_MESSAGE);
    });
  });

  describe('Date Validations', () => {
    it('Valid and required date', async () => {
      const model = createModel(
        {
          dateOfBirth: '11/21/2016',
        },
        {
          dateOfBirth: {
            errorMessage: REQUIRED_VALIDATION_MESSAGE,
            interactive: true,
            validationType: [
              VALIDATION_TYPES.REQUIRED,
              {
                type: VALIDATION_TYPES.DATE,
                errorMessage: DATE_VALIDATION_MESSAGE,
              },
            ],
          },
        },
      );

      await model.validate();

      expect(model.valid).to.equal(true);
      expect(model._getField('dateOfBirth').errorMessage).to.be.empty;
    });

    it('Invalid and required date', async () => {
      const model = createModel(
        {
          dateOfBirth: '02/29/2017',
        },
        {
          dateOfBirth: {
            errorMessage: REQUIRED_VALIDATION_MESSAGE,
            interactive: true,
            validationType: [
              VALIDATION_TYPES.REQUIRED,
              {
                type: VALIDATION_TYPES.DATE,
                errorMessage: DATE_VALIDATION_MESSAGE,
              },
            ],
          },
        },
      );

      await model.validate();

      expect(model.valid).to.equal(false);
      expect(model._getField('dateOfBirth').errorMessage).to.equal(DATE_VALIDATION_MESSAGE);
    });

    it(`Valid and required date with custom format ${DATE_ES_FORMAT}`, async () => {
      const model = createModel(
        {
          dateOfBirth: '21/11/2016',
        },
        {
          dateOfBirth: {
            errorMessage: REQUIRED_VALIDATION_MESSAGE,
            interactive: true,
            validationType: [
              VALIDATION_TYPES.REQUIRED,
              {
                type: VALIDATION_TYPES.DATE,
                errorMessage: DATE_VALIDATION_MESSAGE,
                args: { format: DATE_ES_FORMAT },
              },
            ],
          },
        },
      );

      await model.validate();

      expect(model.valid).to.equal(true);
      expect(model._getField('dateOfBirth').errorMessage).to.be.empty;
    });
  });
});
