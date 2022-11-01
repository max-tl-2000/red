/*
 * Copyright (c) 2022 Reva Technology Inc., all rights reserved.
 * Unauthorized copying of this file, via any medium is strictly prohibited
 * Licensed under the Elastic License 2.0; you may not use this file except
 * in compliance with the Elastic License 2.0.
 */

import { createModel } from 'mobx-form';
import { extendObservable } from 'mobx';
import { t } from 'i18next';
import { EMERGENCY_MESSAGE_CHARACTERS_LIMIT, POST_TITLE_CHARACTERS_LIMIT } from '../mobx/helpers/post';
import trim from '../../common/helpers/trim';
import { getValidDraftFieldValues } from './helpers/fields';

export const createAlertFormModel = (initialState = { title: '', message: '', category: 'alert' }) => {
  const descriptors = {
    category: {},
    title: {
      required: 'TITLE_REQUIRED',
      validator: field => {
        if (trim(field.value).length > POST_TITLE_CHARACTERS_LIMIT) {
          throw new Error('TITLE_EXCEEDED_ERROR');
        }
      },
    },
    message: {
      required: 'MESSAGE_REQUIRED',
      validator: field => {
        if (trim(field.value).length > EMERGENCY_MESSAGE_CHARACTERS_LIMIT) {
          throw new Error(t('EMERGENCY_MESSSAGE_EXCEEDED_ERROR', { charactersLimit: EMERGENCY_MESSAGE_CHARACTERS_LIMIT }));
        }
      },
    },
  };

  let form = createModel({ descriptors, initialState });

  form = extendObservable(form, {
    get allRequiredFieldsAreEmpty() {
      return form.requiredFields.every(fieldName => !form.fields[fieldName].hasValue);
    },
    get getValidDraftFieldValues() {
      return getValidDraftFieldValues(form);
    },
    get getValidFieldValues() {
      return Object.keys(form.fields).reduce((acc, fieldName) => {
        if (form.fields[fieldName].valid) acc[fieldName] = form.fields[fieldName].value;

        return acc;
      }, {});
    },
    get atLeastOneRequiredFieldValid() {
      return form.requiredFields.some(fieldName => form.fields[fieldName].valid);
    },
    get isDirty() {
      // initial states and fields are only string
      return Object.keys(form.fields).some(fieldName => form.fields[fieldName].interacted && (initialState[fieldName] || '') !== form.fields[fieldName].value);
    },
  });

  return form;
};
