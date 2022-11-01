/*
 * Copyright (c) 2022 Reva Technology Inc., all rights reserved.
 * Unauthorized copying of this file, via any medium is strictly prohibited
 * Licensed under the Elastic License 2.0; you may not use this file except
 * in compliance with the Elastic License 2.0.
 */

import i18next from 'i18next';
import { request } from '../../../common/helpers/httpUtils';

const LOAD_TEMPLATE = 'templates/LOAD_TEMPLATE';
const LOAD_TEMPLATE_SUCCESS = 'template/LOAD_TEMPLATE_SUCCESS';
const LOAD_TEMPLATE_FAIL = 'persons/LOAD_TEMPLATE_FAIL';

const initialState = {
  templates: {},
};

export default function reducer(state = initialState, action = {}) {
  switch (action.type) {
    case LOAD_TEMPLATE_SUCCESS: {
      const newTemplates = { ...state.templates };
      newTemplates[action.templateName] = action.result;
      return {
        ...state,
        templates: newTemplates,
      };
    }
    default:
      return state;
  }
}

const getTemplate = templateName => {
  const lang = i18next.language;
  const url = `${window.location.protocol}//${window.location.hostname}/${lang}-${templateName}`;
  try {
    return request(url);
  } catch (e) {
    console.error(`Unable to retrieve sms template ${templateName}: `, e);
  }
  return '';
};

// we can also use a cached version of the template such we don't make the call each time
export function getCommTemplate(templateName) {
  return {
    types: [LOAD_TEMPLATE, LOAD_TEMPLATE_SUCCESS, LOAD_TEMPLATE_FAIL],
    promise: () => getTemplate(templateName),
    templateName,
  };
}
