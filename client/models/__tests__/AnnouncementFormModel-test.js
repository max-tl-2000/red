/*
 * Copyright (c) 2022 Reva Technology Inc., all rights reserved.
 * Unauthorized copying of this file, via any medium is strictly prohibited
 * Licensed under the Elastic License 2.0; you may not use this file except
 * in compliance with the Elastic License 2.0.
 */

import { expect } from 'chai';
import { createAnnouncementFormModel } from '../AnnouncementFormModel';

describe('createAnnouncementFormModel', () => {
  it('should not be a valid form if the title is greater than 100 characters', async () => {
    const initialState = {
      title: 'xxxxxxxxxxxxxxxxx xx xxxx xx xxxxx xxxxxx xxxxxx xxxxxxxxxxxxxxxxxx xxxxxxxxxxxx xxxxxx xxxxxxxxxxxxx',
      message: 'kasmdkasmdakkdm',
    };
    const form = createAnnouncementFormModel(initialState);
    await form.validate();
    expect(form.valid).to.equal(false);
  });

  it('should not be a valid form if one of the fields is missing', async () => {
    const initialState = {
      title: 'xxxxxxxxxxxxxxxxx xx xxxx xx xxxxx xxxxxx xxxxxx xxxxxxxxxxxxxxxxxx',
    };
    const form = createAnnouncementFormModel(initialState);
    await form.validate();
    expect(form.valid).to.equal(false);
  });

  it('should not be a valid form if all fields are set and the title is not greater than 100 characters', async () => {
    const initialState = {
      title: 'xxxxxxxxxxxxxxxxx xx xxxx xx xxxxx xxxxxx xxxxxx xxxxxxxxxxxxxxxxxx',
      message: 'kasmdkasmdakkdm',
    };
    const form = createAnnouncementFormModel(initialState);
    await form.validate();
    expect(form.valid).to.equal(true);
  });

  describe('when calling isFormDirty function without initial values', () => {
    const form = createAnnouncementFormModel();

    describe('and none of form fields have changed', () => {
      it('should return false', () => {
        expect(form.isDirty).to.equal(false);
      });
    });
    describe('and at least one of the form fields have changed', () => {
      it('should return true', () => {
        form.fields.message.setValue('New message');
        expect(form.isDirty).to.equal(true);
        form.fields.message.setValue('');
        expect(form.isDirty).to.equal(false);
      });
    });
  });

  describe('when calling isFormDirty function with a title as initial values', () => {
    const form = createAnnouncementFormModel({ title: 'My title' });

    describe('and the title changed and then the value goes back to the initial state', () => {
      it('should return false', () => {
        form.fields.title.setValue('New title');
        expect(form.isDirty).to.equal(true);
        form.fields.title.setValue('My title');
        expect(form.isDirty).to.equal(false);
      });
    });
    describe('and the message is updated and then return it to the initial state', () => {
      it('should return true', () => {
        form.fields.message.setValue('New message');
        expect(form.isDirty).to.equal(true);
        form.fields.message.setValue('');
        expect(form.isDirty).to.equal(false);
      });
    });
    describe('and the title and message are updated and then return it to the initial state', () => {
      it('should return true', () => {
        form.fields.title.setValue('My new title');
        form.fields.message.setValue('New message');
        expect(form.isDirty).to.equal(true);
        form.fields.title.setValue('My title');
        form.fields.message.setValue('');
        expect(form.isDirty).to.equal(false);
      });
    });
  });

  describe('when calling atLeastOneFieldValid function', () => {
    describe('and all fields are invalid ', () => {
      it('should return false', async () => {
        const initialState = {
          title: 'xxxxxxxxxxxxxxxxx xx xxxx xx xxxxx xxxxxx xxxxxx xxxxxxxxxxxxxxxxxx xxxxxxxxxxxx xxxxxx xxxxxxxxxxxxx',
          message: '',
        };
        const form = createAnnouncementFormModel(initialState);
        await form.validate();

        expect(form.atLeastOneRequiredFieldValid).to.equal(false);
      });
    });
    describe('and at least one of the form fields is valid', () => {
      it('should return true', () => {
        const initialState = {
          title: 'xxxxxxxxxxxxxxxxx xx xxxx xx xxxxx xxxxxx xxxxxx xxxxxxxxxxxxxxxxxx xxxxxxxxxxxx',
          message: 'My message',
        };
        const form = createAnnouncementFormModel(initialState);
        expect(form.atLeastOneRequiredFieldValid).to.equal(true);
      });
    });
  });
});
