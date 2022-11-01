/*
 * Copyright (c) 2022 Reva Technology Inc., all rights reserved.
 * Unauthorized copying of this file, via any medium is strictly prohibited
 * Licensed under the Elastic License 2.0; you may not use this file except
 * in compliance with the Elastic License 2.0.
 */

import isEmpty from 'lodash/isEmpty';

export const getValidDraftFieldValues = form =>
  Object.keys(form.fields).reduce((acc, fieldName) => {
    if (form.fields[fieldName].valid || isEmpty(form.fields[fieldName].value)) acc[fieldName] = form.fields[fieldName].value;
    return acc;
  }, {});
