/*
 * Copyright (c) 2022 Reva Technology Inc., all rights reserved.
 * Unauthorized copying of this file, via any medium is strictly prohibited
 * Licensed under the Elastic License 2.0; you may not use this file except
 * in compliance with the Elastic License 2.0.
 */

import { validate, Validation, getValueToPersist } from './util';
import DBColumnLength from '../../utils/dbConstants';
import { saveTeamMemberSalesTarget } from '../../dal/teamMemberSalesTargetRepo.js';
import { spreadsheet } from '../../../common/helpers/spreadsheet';

const TEAM_MEMBER_SALES_TARGET_REQUIRED_FIELDS = [
  {
    fieldName: 'team',
    validation: [Validation.NOT_EMPTY, Validation.ALPHANUMERIC],
    maxLength: DBColumnLength.Name,
  },
  {
    fieldName: 'registrationEmail',
    validation: [Validation.NOT_EMPTY, Validation.MAIL],
    maxLength: DBColumnLength.Email,
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
    fieldName: 'contactsToSalesConv',
    validation: [Validation.PERCENTAGE],
  },
  {
    fieldName: 'leadsToSalesConv',
    validation: [Validation.PERCENTAGE],
  },
  {
    fieldName: 'prospectsToSalesConv',
    validation: [Validation.PERCENTAGE],
  },
  {
    fieldName: 'applicantsToSalesConv',
    validation: [Validation.PERCENTAGE],
  },
  {
    fieldName: 'leasesToSalesConv',
    validation: [Validation.PERCENTAGE],
  },
];

const PREREQUISITES = [
  {
    field: 'team',
    tableFieldName: 'name',
    table: 'Teams',
    idReceiver: 'teamId',
  },
  {
    field: 'registrationEmail',
    tableFieldName: 'email',
    table: 'Users',
    idReceiver: 'userId',
  },
];

const saveTeamMemberSalesTargetData = async (ctx, teamMemberSalesTarget) =>
  await saveTeamMemberSalesTarget(ctx, {
    teamId: teamMemberSalesTarget.teamId,
    userId: teamMemberSalesTarget.userId,
    month: teamMemberSalesTarget.month,
    year: teamMemberSalesTarget.year,
    salesTarget: getValueToPersist(teamMemberSalesTarget.salesTarget, null),
    contactsToSalesConv: getValueToPersist(teamMemberSalesTarget.contactsToSalesConv, null),
    leadsToSalesConv: getValueToPersist(teamMemberSalesTarget.leadsToSalesConv, null),
    prospectsToSalesConv: getValueToPersist(teamMemberSalesTarget.prospectsToSalesConv, null),
    applicantsToSalesConv: getValueToPersist(teamMemberSalesTarget.applicantsToSalesConv, null),
    leasesToSalesConv: getValueToPersist(teamMemberSalesTarget.leasesToSalesConv, null),
  });

export const importTeamMemberSalesTargets = async (ctx, teamMemberSalesTargets) => {
  const invalidFields = await validate(
    teamMemberSalesTargets,
    {
      requiredFields: TEAM_MEMBER_SALES_TARGET_REQUIRED_FIELDS,
      prerequisites: PREREQUISITES,
      async onValidEntity(teamMemberSalesTarget) {
        await saveTeamMemberSalesTargetData(ctx, teamMemberSalesTarget);
      },
    },
    ctx,
    spreadsheet.TeamMemberSalesTarget.columns,
  );

  return {
    invalidFields,
  };
};
