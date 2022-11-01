/*
 * Copyright (c) 2022 Reva Technology Inc., all rights reserved.
 * Unauthorized copying of this file, via any medium is strictly prohibited
 * Licensed under the Elastic License 2.0; you may not use this file except
 * in compliance with the Elastic License 2.0.
 */

import { validate, Validation, getValueToPersist } from './util';
import DBColumnLength from '../../utils/dbConstants';
import { saveTeamSalesTarget } from '../../dal/teamSalesTargetRepo.js';
import { spreadsheet } from '../../../common/helpers/spreadsheet';

const TEAM_SALES_TARGET_REQUIRED_FIELDS = [
  {
    fieldName: 'name',
    validation: [Validation.NOT_EMPTY, Validation.ALPHANUMERIC],
    maxLength: DBColumnLength.Name,
  },
  {
    fieldName: 'month',
    validation: [Validation.NOT_EMPTY, Validation.POSITIVE_INTEGER],
  },
  {
    fieldName: 'year',
    validation: [Validation.NOT_EMPTY, Validation.POSITIVE_INTEGER],
  },
  {
    fieldName: 'salesTarget',
    validation: [Validation.POSITIVE_INTEGER],
  },
  {
    fieldName: 'salesCycleDays',
    validation: [Validation.POSITIVE_INTEGER],
  },
];

const PREREQUISITES = [
  {
    field: 'name',
    tableFieldName: 'name',
    table: 'Teams',
    idReceiver: 'teamId',
  },
];

const saveTeamSalesTargetData = (ctx, teamSalesTarget) =>
  saveTeamSalesTarget(ctx, {
    teamId: teamSalesTarget.teamId,
    month: teamSalesTarget.month,
    year: teamSalesTarget.year,
    salesTarget: getValueToPersist(teamSalesTarget.salesTarget, null),
    salesCycleDays: getValueToPersist(teamSalesTarget.salesCycleDays, null),
  });

export const importTeamSalesTargets = async (ctx, teamSalesTargets) => {
  const invalidFields = await validate(
    teamSalesTargets,
    {
      requiredFields: TEAM_SALES_TARGET_REQUIRED_FIELDS,
      prerequisites: PREREQUISITES,
      async onValidEntity(teamSalesTarget) {
        await saveTeamSalesTargetData(ctx, teamSalesTarget);
      },
    },
    ctx,
    spreadsheet.TeamSalesTarget.columns,
  );

  return {
    invalidFields,
  };
};
