/*
 * Copyright (c) 2022 Reva Technology Inc., all rights reserved.
 * Unauthorized copying of this file, via any medium is strictly prohibited
 * Licensed under the Elastic License 2.0; you may not use this file except
 * in compliance with the Elastic License 2.0.
 */

import { DALTypes } from '../../../common/enums/DALTypes';
import { spreadsheet } from '../../../common/helpers/spreadsheet';
import { saveLeaseDocumentTemplate } from '../../dal/leaseDocumentTemplateRepo';
import DBColumnLength from '../../utils/dbConstants';
import { validate, Validation } from './util';

// The sheet name is 'Lease Templates' and database table is LeaseDocumentTemplate
const LEASE_DOCUMENT_TEMPLATE = 'Lease Templates';
const LEASE_DOCUMENT_TEMPLATE_EQUAL_SANDBOX_PROD_ERROR = 'The sandboxTemplateId and prodTemplateId should not be the same';

const REQUIRED_FIELDS = [
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
    fieldName: 'category',
    validation: [Validation.ALPHANUMERIC, Validation.EXISTS_IN],
    validValues: DALTypes.LeaseDocumentTemplateCategories,
    maxLength: DBColumnLength.Type,
  },
  {
    fieldName: 'manuallySelectedFlag',
    validation: [Validation.BOOLEAN],
  },
  {
    fieldName: 'sandboxTemplateId',
    validation: [Validation.ALPHANUMERIC],
    maxLength: DBColumnLength.Name,
  },
  {
    fieldName: 'prodTemplateId',
    validation: [Validation.ALPHANUMERIC],
    maxLength: DBColumnLength.Name,
  },
];

const customLeaseDocumentTemplateValidations = async (ctx, leaseDocumentTemplate) => {
  const validation = [];

  if (leaseDocumentTemplate.sandboxTemplateId === leaseDocumentTemplate.prodTemplateId) {
    validation.push({
      name: LEASE_DOCUMENT_TEMPLATE,
      message: LEASE_DOCUMENT_TEMPLATE_EQUAL_SANDBOX_PROD_ERROR,
    });
  }
  return validation;
};

const saveLeaseDocumentTemplateData = async (ctx, leaseTemplate) =>
  await saveLeaseDocumentTemplate(ctx, {
    name: leaseTemplate.name,
    displayName: leaseTemplate.displayName,
    category: leaseTemplate.category,
    manuallySelectedFlag: leaseTemplate.manuallySelectedFlag,
    sandboxTemplateId: leaseTemplate.sandboxTemplateId,
    prodTemplateId: leaseTemplate.prodTemplateId,
  });

export const importLeaseDocumentTemplate = async (ctx, leaseTemplateData) => {
  const invalidFields = await validate(
    leaseTemplateData,
    {
      requiredFields: REQUIRED_FIELDS,
      async onValidEntity(leaseTemplate) {
        await saveLeaseDocumentTemplateData(ctx, leaseTemplate);
      },
      async customCheck(leaseTemplate) {
        return await customLeaseDocumentTemplateValidations(ctx, leaseTemplate);
      },
    },
    ctx,
    spreadsheet.LeaseTemplates.columns,
  );

  return {
    invalidFields,
  };
};
