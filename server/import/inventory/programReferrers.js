/*
 * Copyright (c) 2022 Reva Technology Inc., all rights reserved.
 * Unauthorized copying of this file, via any medium is strictly prohibited
 * Licensed under the Elastic License 2.0; you may not use this file except
 * in compliance with the Elastic License 2.0.
 */

import newId from 'uuid/v4';

import { saveProgramReferrers } from '../../dal/programsRepo';
import { validate, Validation } from './util';
import DBColumnLength from '../../utils/dbConstants';
import { spreadsheet } from '../../../common/helpers/spreadsheet';

const requiredFields = [
  {
    fieldName: 'program',
    validation: [Validation.NOT_EMPTY, Validation.ALPHANUMERIC],
    maxLength: DBColumnLength.Name,
  },
  {
    fieldName: 'order',
    validation: [Validation.NOT_EMPTY, Validation.DECIMAL],
  },
  {
    fieldName: 'currentUrl',
    validation: [Validation.NOT_EMPTY, Validation.REGEX],
  },
  {
    fieldName: 'referrerUrl',
    validation: [Validation.NOT_EMPTY, Validation.REGEX],
  },
  {
    fieldName: 'description',
    validation: [Validation.ALPHANUMERIC],
    maxLength: DBColumnLength.Description,
  },
  {
    fieldName: 'defaultFlag',
    validation: [Validation.BOOLEAN],
  },
  {
    fieldName: 'inactiveFlag',
    validation: [Validation.BOOLEAN],
  },
];

const prerequisites = [
  {
    field: 'program',
    tableFieldName: 'name',
    table: 'Programs',
    idReceiver: 'programId',
  },
];

const createProgramReferrerRecord = ({ program, defaultFlag, inactiveFlag, ...referrer }) => ({
  id: newId(),
  ...referrer,
  isDefault: defaultFlag,
  inactive: inactiveFlag,
});

export const importProgramReferrers = async (ctx, programReferrers) => {
  const referrersToSave = [];

  const invalidFields = await validate(
    programReferrers,
    {
      requiredFields,
      prerequisites,
      onValidEntity(referrer) {
        referrersToSave.push(createProgramReferrerRecord(referrer));
      },
    },
    ctx,
    spreadsheet.ProgramReferrer.columns,
  );

  programReferrers.length && (await saveProgramReferrers(ctx, referrersToSave));

  return {
    invalidFields,
  };
};
