/*
 * Copyright (c) 2022 Reva Technology Inc., all rights reserved.
 * Unauthorized copying of this file, via any medium is strictly prohibited
 * Licensed under the Elastic License 2.0; you may not use this file except
 * in compliance with the Elastic License 2.0.
 */

import { saveCommsTemplate } from '../../dal/commsTemplateRepo.js';
import { validate, Validation, getValueToPersist } from './util.js';
import DBColumnLength from '../../utils/dbConstants.js';
import { spreadsheet } from '../../../common/helpers/spreadsheet';

const INVALID_DUPLICATED_COMMS_TEMPLATE_NAME = 'INVALID_DUPLICATED_COMMS_TEMPLATE_NAME';

const COMMS_TEMPLATE_REQUIRED_FIELDS = [
  {
    fieldName: 'name',
    validation: [Validation.NOT_EMPTY, Validation.ALPHANUMERIC],
    maxLength: DBColumnLength.Name,
  },
  {
    fieldName: 'displayName',
    validation: [Validation.NOT_EMPTY, Validation.ALPHANUMERIC],
    maxLength: DBColumnLength.Name,
  },
  {
    fieldName: 'emailTemplate',
    validation: [Validation.NOT_EMPTY],
  },
  {
    fieldName: 'smsTemplate',
    validation: [Validation.NOT_EMPTY],
  },
  {
    fieldName: 'inactiveFlag',
    validation: [Validation.BOOLEAN],
  },
];

const validateUniqueName = (commsTemplateName, commsTemplatesNames) => {
  if (commsTemplatesNames.filter(name => commsTemplateName === name).length < 2) return [];

  return [
    {
      name: commsTemplateName,
      message: INVALID_DUPLICATED_COMMS_TEMPLATE_NAME,
    },
  ];
};

const saveCommsTemplateData = async (ctx, commsTemplate) =>
  await saveCommsTemplate(ctx, {
    name: getValueToPersist(commsTemplate.name, null),
    displayName: getValueToPersist(commsTemplate.displayName, null),
    description: getValueToPersist(commsTemplate.description, null),
    emailSubject: getValueToPersist(commsTemplate.emailSubject, null),
    emailTemplate: getValueToPersist(commsTemplate.emailTemplate, null),
    smsTemplate: getValueToPersist(commsTemplate.smsTemplate, null),
    inactive: getValueToPersist(commsTemplate.inactiveFlag, null),
  });

export const importCommsTemplates = async (ctx, commsTemplates) => {
  const commsTemplatesNames = commsTemplates.map(({ data }) => data.name);
  const invalidFields = await validate(
    commsTemplates,
    {
      requiredFields: COMMS_TEMPLATE_REQUIRED_FIELDS,
      async onValidEntity(commsTemplate) {
        await saveCommsTemplateData(ctx, commsTemplate);
      },
      customCheck(commsTemplate) {
        return validateUniqueName(commsTemplate.name, commsTemplatesNames);
      },
    },
    ctx,
    spreadsheet.CommsTemplate.columns,
  );

  return {
    invalidFields,
  };
};
