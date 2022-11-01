/*
 * Copyright (c) 2022 Reva Technology Inc., all rights reserved.
 * Unauthorized copying of this file, via any medium is strictly prohibited
 * Licensed under the Elastic License 2.0; you may not use this file except
 * in compliance with the Elastic License 2.0.
 */

import newId from 'uuid/v4';
import { saveTemplateShortCodes } from '../../dal/commsTemplateRepo.js';
import { validate, Validation, getValueToPersist } from './util.js';
import DBColumnLength from '../../utils/dbConstants.js';
import { spreadsheet } from '../../../common/helpers/spreadsheet';

const INVALID_DUPLICATED_TEMPLATE_SHORT_CODE = 'INVALID_DUPLICATED_TEMPLATE_SHORT_CODE';

const TEMPLATE_SHORT_CODE_REQUIRED_FIELDS = [
  {
    fieldName: 'property',
    validation: [Validation.NOT_EMPTY, Validation.ALPHANUMERIC],
    maxLength: DBColumnLength.Name,
  },
  {
    fieldName: 'shortCode',
    validation: [Validation.NOT_EMPTY, Validation.ALPHANUMERIC],
    maxLength: DBColumnLength.Name,
  },
  {
    fieldName: 'templateName',
    validation: [Validation.NOT_EMPTY, Validation.ALPHANUMERIC],
    maxLength: DBColumnLength.Name,
  },
  {
    fieldName: 'inactiveFlag',
    validation: [Validation.BOOLEAN],
  },
];

const PREREQUISITES = [
  {
    field: 'property',
    tableFieldName: 'name',
    table: 'Property',
    idReceiver: 'propertyId',
  },
  {
    field: 'templateName',
    tableFieldName: 'name',
    table: 'CommsTemplate',
    idReceiver: 'templateId',
  },
];

const validateUniqueShortCode = (templateShortCode, templateShortCodes) => {
  const { shortCode: currentShortCode, property: currentProperty } = templateShortCode;
  if (
    templateShortCodes.filter(({ data: { shortCode, property } }) => currentShortCode.trim() === shortCode.trim() && currentProperty.trim() === property.trim())
      .length < 2
  ) {
    return [];
  }

  return [
    {
      name: currentShortCode,
      message: INVALID_DUPLICATED_TEMPLATE_SHORT_CODE,
    },
  ];
};

const getTemplateShortCodeObject = template => ({
  id: newId(),
  propertyId: getValueToPersist(template.propertyId, null),
  shortCode: getValueToPersist(template.shortCode, null),
  templateId: getValueToPersist(template.templateId, null),
  inactive: getValueToPersist(template.inactiveFlag, null),
});

export const importTemplateShortCodes = async (ctx, templateShortCodes) => {
  const validTemplateShortCodes = [];

  const invalidFields = await validate(
    templateShortCodes,
    {
      requiredFields: TEMPLATE_SHORT_CODE_REQUIRED_FIELDS,
      prerequisites: PREREQUISITES,
      async onValidEntity(templateShortCode) {
        validTemplateShortCodes.push(getTemplateShortCodeObject(templateShortCode));
      },
      customCheck(templateShortCode) {
        return validateUniqueShortCode(templateShortCode, templateShortCodes);
      },
    },
    ctx,
    spreadsheet.TemplateShortCode.columns,
  );

  await saveTemplateShortCodes(ctx, validTemplateShortCodes);

  return {
    invalidFields,
  };
};
