/*
 * Copyright (c) 2022 Reva Technology Inc., all rights reserved.
 * Unauthorized copying of this file, via any medium is strictly prohibited
 * Licensed under the Elastic License 2.0; you may not use this file except
 * in compliance with the Elastic License 2.0.
 */

import values from 'lodash/values';
import { isValidPhoneNumber } from '../../helpers/phoneUtils';
import { validate, Validation } from './util';
import DBColumnLength from '../../utils/dbConstants';
import { saveVoiceMenuItem } from '../../dal/voiceMessageRepo';
import { DALTypes } from '../../../common/enums/DALTypes';
import { spreadsheet } from '../../../common/helpers/spreadsheet';

const INVALID_ACTION = 'Invalid action';
const INVALID_ACTION_TYPE = 'Invalid action type. Valid types are:';
const INVALID_PHONE_NUMBER = 'Invalid phone number';
const TRANSFER_NUMBER_IS_NULL = 'Phone number can not be null';
const TRANSFER_NUMBER_IS_INVALID = 'Phone number is invalid';
const INVALID_NAME = 'Invalid name';
const DUPLICATE_NAME = 'Name is used more than once';
const INVALID_DISPLAY_NAME = 'Invalid display name';
const DUPLICATE_DISPLAY_NAME = 'Display name is used more than once';
const MISSING_VALUE = 'A value is missing';
const DISPLAY_NAME_OR_NUMBER_MISSING = 'Display name has to be used for items with phone number';

const voiceMenuItemsRequiredFields = [
  {
    fieldName: 'name',
    validation: [Validation.NOT_EMPTY, Validation.ALPHANUMERIC],
    maxLength: DBColumnLength.Name,
  },
  {
    fieldName: 'key',
    validation: [Validation.NOT_EMPTY, Validation.INTEGER],
    maxLength: 1,
  },
  {
    fieldName: 'action',
    validation: [Validation.NOT_EMPTY, Validation.ALPHANUMERIC],
    maxLength: DBColumnLength.Name,
  },
  {
    fieldName: 'number',
    validation: [Validation.ALPHANUMERIC],
    maxLength: DBColumnLength.Phone,
  },
  {
    fieldName: 'displayName',
    validation: [Validation.ALPHANUMERIC],
    maxLength: DBColumnLength.Name,
  },
];

const actionValidation = menuItem => {
  const actions = values(DALTypes.VoiceMenuAction);
  const menuAction = menuItem.action.toString().trim();
  if (!actions.includes(menuAction)) {
    return [
      {
        name: INVALID_ACTION,
        message: `${INVALID_ACTION_TYPE} ${actions}`,
      },
    ];
  }
  return [];
};

const nameValidation = (menuItem, importItemNames) => {
  const itemName = menuItem.name.toString().trim();
  const identicNames = importItemNames.filter(n => n === itemName);
  if (identicNames.length > 1) {
    return [
      {
        name: INVALID_NAME,
        message: DUPLICATE_NAME,
      },
    ];
  }
  return [];
};

const phoneNumberValidation = menuItem => {
  const isTransferToNumber = menuItem.action === DALTypes.VoiceMenuAction.TRANSFER_TO_PHONE_NUMBER;
  const phoneNumber = menuItem.number.toString().trim();
  const validationErrors = [];
  if (isTransferToNumber && !phoneNumber) {
    validationErrors.push({
      name: INVALID_PHONE_NUMBER,
      message: TRANSFER_NUMBER_IS_NULL,
    });
  }
  if (isTransferToNumber && !isValidPhoneNumber(phoneNumber)) {
    validationErrors.push({
      name: INVALID_PHONE_NUMBER,
      message: TRANSFER_NUMBER_IS_INVALID,
    });
  }
  return validationErrors;
};

const displayNameValidation = (menuItem, importItemDisplayNames) => {
  const hasTransferNumber = !!menuItem.number;
  const itemDisplayName = menuItem.displayName.toString().trim();
  const duplicateName = importItemDisplayNames.filter(i => i !== '' && i === itemDisplayName);
  const validationErrors = [];

  if (duplicateName.length > 1) {
    validationErrors.push({
      name: INVALID_DISPLAY_NAME,
      message: DUPLICATE_DISPLAY_NAME,
    });
  }

  if ((hasTransferNumber && itemDisplayName === '') || (!hasTransferNumber && itemDisplayName !== '')) {
    validationErrors.push({
      name: MISSING_VALUE,
      message: DISPLAY_NAME_OR_NUMBER_MISSING,
    });
  }
  return validationErrors;
};

const customValidation = (menuItem, importItemNames, importItemDisplayNames) => [
  ...actionValidation(menuItem),
  ...phoneNumberValidation(menuItem),
  ...nameValidation(menuItem, importItemNames),
  ...displayNameValidation(menuItem, importItemDisplayNames),
];

export const importVoiceMenuItems = async (ctx, rows) => {
  const importItemNames = rows.map(i => i.data.name.toString().trim());
  const importItemDisplayNames = rows.map(i => i.data.displayName.toString().trim());

  const invalidFields = await validate(
    rows,
    {
      requiredFields: voiceMenuItemsRequiredFields,
      async onValidEntity(menuItem) {
        await saveVoiceMenuItem(ctx, menuItem);
      },
      customCheck(menuItem) {
        return customValidation(menuItem, importItemNames, importItemDisplayNames);
      },
    },
    ctx,
    spreadsheet.VoiceMenuItems.columns,
  );

  return {
    invalidFields,
  };
};
