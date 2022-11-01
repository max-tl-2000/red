/*
 * Copyright (c) 2022 Reva Technology Inc., all rights reserved.
 * Unauthorized copying of this file, via any medium is strictly prohibited
 * Licensed under the Elastic License 2.0; you may not use this file except
 * in compliance with the Elastic License 2.0.
 */

import { t } from 'i18next';

export const formatSelectedPhoneNumbers = ({ textElements } = {}) => {
  if (!Array.isArray(textElements)) return '';
  let selectedLabel = textElements[0] || '';
  if (textElements.length > 1) {
    selectedLabel += `, +${textElements.length - 1} ${t('PHONE_NUMBERS_SELECTED')}`;
  }

  return selectedLabel;
};
