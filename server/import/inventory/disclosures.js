/*
 * Copyright (c) 2022 Reva Technology Inc., all rights reserved.
 * Unauthorized copying of this file, via any medium is strictly prohibited
 * Licensed under the Elastic License 2.0; you may not use this file except
 * in compliance with the Elastic License 2.0.
 */

import { saveDisclosure } from '../../dal/disclosureRepo';
import { validate, Validation } from './util';
import DBColumnLength from '../../utils/dbConstants';
import { spreadsheet } from '../../../common/helpers/spreadsheet';

const DISCLOSURE_REQUIRED_FIELDS = [
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
    fieldName: 'displayOrder',
    validation: [Validation.POSITIVE_INTEGER],
  },
  {
    fieldName: 'displayHelp',
    validation: [Validation.ALPHANUMERIC],
    maxLength: DBColumnLength.Description,
  },
  {
    fieldName: 'descriptionHelper',
    validation: [Validation.NOT_EMPTY, Validation.ALPHANUMERIC],
    maxLength: DBColumnLength.Description,
  },
  {
    fieldName: 'requireApplicationReview',
    validation: [Validation.BOOLEAN],
  },
  {
    fieldName: 'showInApplication',
    validation: [Validation.BOOLEAN],
  },
  {
    fieldName: 'showInParty',
    validation: [Validation.BOOLEAN],
  },
];

export const importDisclosures = async (ctx, disclosures) => {
  const invalidFields = await validate(
    disclosures,
    {
      requiredFields: DISCLOSURE_REQUIRED_FIELDS,
      async onValidEntity(disclosure) {
        await saveDisclosure(ctx, disclosure);
      },
    },
    ctx,
    spreadsheet.Disclosure.columns,
  );

  return {
    invalidFields,
  };
};
