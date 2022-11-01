/*
 * Copyright (c) 2022 Reva Technology Inc., all rights reserved.
 * Unauthorized copying of this file, via any medium is strictly prohibited
 * Licensed under the Elastic License 2.0; you may not use this file except
 * in compliance with the Elastic License 2.0.
 */

import { createDemoFormModel } from '../DemoFormModel';

describe('DemoFormModel', () => {
  it('should create a new demo model', () => {
    const model = createDemoFormModel({ firstName: 'juan', lastName: 'vento' });
    expect(model).toBeDefined();
  });

  it('should create a new demo model with the right values', () => {
    const mock = { firstName: 'juan', lastName: 'vento' };
    const model = createDemoFormModel(mock);
    expect(model.firstName).toEqual(mock.firstName);
    expect(model.lastName).toEqual(mock.lastName);
  });

  it('should restore the initial values if restoreInitialValues is used', () => {
    const mock = { firstName: 'juan', lastName: 'vento' };
    const model = createDemoFormModel(mock);

    model.updateFrom({ firstName: 'John', lastName: 'Doe' });

    expect(model.firstName).toEqual('John');
    expect(model.lastName).toEqual('Doe');

    model.restoreInitialValues();

    expect(model.id).toEqual(undefined);
    expect(model.firstName).toEqual('juan');
    expect(model.lastName).toEqual('vento');
  });

  it('should update the form values', () => {
    const mock = { firstName: 'juan', lastName: 'vento' };
    const model = createDemoFormModel(mock);
    const newValues = { firstName: 'pier', lastName: 'castañeda' };
    model.updateFrom(newValues);
    expect(model.id).toEqual(undefined);
    expect(model.firstName).toEqual(newValues.firstName);
    expect(model.lastName).toEqual(newValues.lastName);
  });

  it('should get the same data from the model and the serialize fn', () => {
    const mock = { firstName: 'juan', lastName: 'vento' };
    const model = createDemoFormModel(mock);
    const serializeModel = {
      id: undefined,
      firstName: mock.firstName,
      lastName: mock.lastName,
    };
    expect(model.serializedData).toEqual(serializeModel);
  });

  it('should be an invalid form if firstName is not provided', async () => {
    const mock = { lastName: 'vento' };
    const model = createDemoFormModel(mock);
    await model.validate();
    expect(model.valid).toEqual(false);
    expect(model.errorOf('firstName')).toEqual('FirstName is required');
  });

  it('should be a valid form if firstName provided when model created', async () => {
    const mock = { firstName: 'juan', lastName: 'vento' };
    const model = createDemoFormModel(mock);
    model.updateField('firstName', 'juan');
    await model.validate();
    expect(model.valid).toEqual(true);
  });

  it('should be a valid form if firstName provided after create the model', async () => {
    const mock = { lastName: 'vento' };
    const model = createDemoFormModel(mock);
    model.updateField('firstName', 'juan');
    await model.validate();
    expect(model.valid).toEqual(true);
  });

  describe('interacted property', () => {
    it('should be false if user have not touch the form', () => {
      const mock = { lastName: 'vento' };
      const model = createDemoFormModel(mock);
      expect(model.interacted).toEqual(false);
    });

    it('should be false if user have not touch the form', async () => {
      const mock = { lastName: 'vento' };
      const model = createDemoFormModel(mock);
      model.updateField('firstName', 'juan');
      expect(model.interacted).toEqual(true);
    });
  });
});
