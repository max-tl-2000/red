/*
 * Copyright (c) 2022 Reva Technology Inc., all rights reserved.
 * Unauthorized copying of this file, via any medium is strictly prohibited
 * Licensed under the Elastic License 2.0; you may not use this file except
 * in compliance with the Elastic License 2.0.
 */

import { validate, Validation } from './util';
import DBColumnLength from '../../utils/dbConstants';
import { savePartyCohort } from '../../dal/partyCohortRepo';
import { spreadsheet } from '../../../common/helpers/spreadsheet';

const partyCohortsRequiredFields = [
  {
    fieldName: 'name',
    validation: [Validation.NOT_EMPTY, Validation.ALPHANUMERIC],
    maxLength: DBColumnLength.Name,
  },
  {
    fieldName: 'description',
    validation: [Validation.ALPHANUMERIC],
    maxLength: DBColumnLength.Name,
  },
];

export const importPartyCohorts = async (ctx, rows) => {
  const invalidFields = await validate(
    rows,
    {
      requiredFields: partyCohortsRequiredFields,
      async onValidEntity(partyCohort) {
        await savePartyCohort(ctx, partyCohort);
      },
    },
    ctx,
    spreadsheet.PartyCohorts.columns,
  );

  return {
    invalidFields,
  };
};
