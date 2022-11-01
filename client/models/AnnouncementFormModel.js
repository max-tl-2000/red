/*
 * Copyright (c) 2022 Reva Technology Inc., all rights reserved.
 * Unauthorized copying of this file, via any medium is strictly prohibited
 * Licensed under the Elastic License 2.0; you may not use this file except
 * in compliance with the Elastic License 2.0.
 */

import { createModel } from 'mobx-form';
import { extendObservable } from 'mobx';
import { t } from 'i18next';
import trim from '../../common/helpers/trim';
import { ANNOUNCEMENT_MESSAGE_CHARACTERS_LIMIT, POST_TITLE_CHARACTERS_LIMIT, ANNOUNCEMENT_MESSAGE_DETAILS_CHARACTERS_LIMIT } from '../mobx/helpers/post';
import { areRichTextFieldsEqual, removeExtraNewLineBlocks } from '../helpers/richTextHelpers';

export const createAnnouncementFormModel = (initialState = { title: '', message: '', messageDetails: '', category: 'announcement' }) => {
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
      required: t('MESSAGE_REQUIRED'),
      validator: field => {
        if (field.value && field?.text?.length > ANNOUNCEMENT_MESSAGE_CHARACTERS_LIMIT) {
          throw new Error(t('ANNOUNCEMENT_MESSAGE_EXCEEDED_ERROR', { charactersLimit: ANNOUNCEMENT_MESSAGE_CHARACTERS_LIMIT }));
        }
      },
      meta: { isRichTextField: true },
    },
    messageDetails: {
      validator: field => {
        if (field.value && field?.text?.length > ANNOUNCEMENT_MESSAGE_DETAILS_CHARACTERS_LIMIT) {
          throw new Error(t('ANNOUNCEMENT_MESSAGE_EXCEEDED_ERROR', { charactersLimit: ANNOUNCEMENT_MESSAGE_DETAILS_CHARACTERS_LIMIT }));
        }
      },
      meta: { isRichTextField: true },
    },
    rawMessage: {},
    rawMessageDetails: {},
    rawMessageDetailsEditorContent: {},
    rawMessageEditorContent: {},
  };

  let form = createModel({ descriptors, initialState });

  form = extendObservable(form, {
    get allRequiredFieldsAreEmpty() {
      return form.requiredFields.every(fieldName => !form.fields[fieldName].hasValue);
    },
    get getValidFieldValues() {
      const messageHTMLValue = removeExtraNewLineBlocks(form.fields?.rawMessageEditorContent?.value, true, true);
      const additionalMessageHTMLValue = removeExtraNewLineBlocks(form.fields?.rawMessageDetailsEditorContent?.value, true, true);
      const messageJsonBlocks = removeExtraNewLineBlocks(form.fields?.rawMessageEditorContent?.value, true, false, true);
      const additionalMessageJsonBlocks = removeExtraNewLineBlocks(form.fields?.rawMessageDetailsEditorContent?.value, true, false, true);
      return Object.keys(form.fields).reduce((acc, fieldName) => {
        // allows updating a field with null/empty value if they have a stored value on the db
        const hasInitialValue = !!initialState[fieldName];
        if (form.fields[fieldName].valid || hasInitialValue) {
          if (fieldName === 'message') {
            acc[fieldName] = messageHTMLValue;
          } else if (fieldName === 'messageDetails') {
            acc[fieldName] = additionalMessageHTMLValue;
          } else if (fieldName === 'rawMessage') {
            acc[fieldName] = messageJsonBlocks;
          } else if (fieldName === 'rawMessageDetails') {
            acc[fieldName] = additionalMessageJsonBlocks;
          } else {
            acc[fieldName] = form.fields[fieldName].value || '';
          }
        }
        return acc;
      }, {});
    },
    get atLeastOneRequiredFieldValid() {
      return form.requiredFields.some(fieldName => form.fields[fieldName].valid);
    },
    get isDirty() {
      // initial states and fields are only string
      return Object.keys(form.fields).some(fieldName =>
        form.fields[fieldName]?.meta?.isRichTextField
          ? !areRichTextFieldsEqual(initialState[fieldName] || '', form.fields[fieldName].value)
          : form.fields[fieldName].interacted && (initialState[fieldName] || '') !== form.fields[fieldName].value,
      );
    },
  });

  return form;
};
