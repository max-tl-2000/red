/*
 * Copyright (c) 2022 Reva Technology Inc., all rights reserved.
 * Unauthorized copying of this file, via any medium is strictly prohibited
 * Licensed under the Elastic License 2.0; you may not use this file except
 * in compliance with the Elastic License 2.0.
 */

import { DALTypes } from '../../../common/enums/DALTypes';
import { validate, Validation } from './util';
import DBColumnLength from '../../utils/dbConstants';
import { updateOne } from '../../database/factory';
import { getTeamBy } from '../../dal/teamsRepo';
import { spreadsheet } from '../../../common/helpers/spreadsheet';
import { execConcurrent } from '../../../common/helpers/exec-concurrent';

const START_TIME = 'start';
const INVALID_START_OR_END_TIME = 'START_TIME_SHOULD_BE_BEFORE_END_TIME';

const sourceRequiredFields = [
  {
    fieldName: 'team',
    validation: [Validation.NOT_EMPTY, Validation.ALPHANUMERIC],
    maxLength: DBColumnLength.Name,
  },
  {
    fieldName: 'day',
    validation: [Validation.NOT_EMPTY, Validation.ALPHANUMERIC, Validation.EXISTS_IN],
    validValues: DALTypes.WeekDays,
    maxLength: DBColumnLength.Name,
  },
  {
    fieldName: 'start',
    validation: [Validation.NOT_EMPTY, Validation.NUMERIC, Validation.MIN_VALUE, Validation.MAX_VALUE],
    minValue: 0,
    maxValue: 1,
  },
  {
    fieldName: 'end',
    validation: [Validation.NOT_EMPTY, Validation.NUMERIC, Validation.MIN_VALUE, Validation.MAX_VALUE],
    minValue: 0,
    maxValue: 1,
  },
];

const formatOfficeHours = entity => {
  // 08:00:00 AM from excel file comes as 0.3333333333333333 (= 8/24)
  // Math.round(num * 100) / 100 - used to round up to 2 decimal places
  const convertFloatValueToMinutes = floatValue => (Math.round(floatValue * 24 * 100) / 100) * 60;

  const upperCaseFirstLetter = text => text.charAt(0).toUpperCase() + text.slice(1);
  const dayName = upperCaseFirstLetter(entity.day);

  return {
    [`${dayName}`]: {
      startTimeOffsetInMin: convertFloatValueToMinutes(entity.start),
      endTimeOffsetInMin: convertFloatValueToMinutes(entity.end),
    },
  };
};

// validEntities array will have the following shape:
// startTimeOffsetInMin - number of minutes since midnight (eg. 8:00 AM => startTimeOffsetInMin = 480)
// [
//   {
//     teamName: BayAreaCenter L,
//     officeHours: {
//       Monday: {
//         startTimeOffsetInMin: 480, // 8:00 AM
//         endTimeOffsetInMin: 1200, // 8:00 PM
//       },
//       Tuesday: {
//         startTimeOffsetInMin: 540, // 9:00 AM
//         endTimeOffsetInMin: 1140, // 7:00 PM
//       },
//     },
//   },
//   {
//     teamName: Cove L,
//     officeHours: {
//       Monday: {
//         startTimeOffsetInMin: 480, // 8:00 AM
//         endTimeOffsetInMin: 1200, // 8:00 PM
//       },
//       Saturday: {
//         startTimeOffsetInMin: 600, // 10:00 AM
//         endTimeOffsetInMin: 840, // 2:00 PM
//       },
//     },
//   },
// ]
let validEntities = [];

const defaultOfficeHours = {
  Monday: { startTimeOffsetInMin: 0, endTimeOffsetInMin: 0 },
  Tuesday: { startTimeOffsetInMin: 0, endTimeOffsetInMin: 0 },
  Wednesday: { startTimeOffsetInMin: 0, endTimeOffsetInMin: 0 },
  Thursday: { startTimeOffsetInMin: 0, endTimeOffsetInMin: 0 },
  Friday: { startTimeOffsetInMin: 0, endTimeOffsetInMin: 0 },
  Saturday: { startTimeOffsetInMin: 0, endTimeOffsetInMin: 0 },
  Sunday: { startTimeOffsetInMin: 0, endTimeOffsetInMin: 0 },
};

const addValidEntity = entity => {
  const teamData = validEntities.find(item => item.teamName === entity.team);

  validEntities = teamData
    ? [
        ...validEntities.filter(item => item.teamName !== entity.team),
        {
          ...teamData,
          officeHours: {
            ...teamData.officeHours,
            ...formatOfficeHours(entity),
          },
        },
      ]
    : [
        ...validEntities,
        {
          teamName: entity.team,
          officeHours: {
            ...defaultOfficeHours,
            ...formatOfficeHours(entity),
          },
        },
      ];
};

const validateStartTime = entity => {
  if (entity.start > entity.end) {
    return [
      {
        name: START_TIME,
        message: INVALID_START_OR_END_TIME,
      },
    ];
  }

  return [];
};

export const importOfficeHours = async (ctx, officeHours) => {
  const invalidFields = await validate(
    officeHours,
    {
      requiredFields: sourceRequiredFields,
      async onValidEntity(entity) {
        await addValidEntity(entity);
      },
      async customCheck(entity) {
        return validateStartTime(entity);
      },
    },
    ctx,
    spreadsheet.OfficeHour.columns,
  );

  if (!invalidFields.length) {
    await execConcurrent(validEntities, async validEntity => {
      const team = await getTeamBy(ctx, { name: validEntity.teamName });
      if (team) {
        return updateOne(ctx.tenantId, 'Teams', team.id, {
          officeHours: validEntity.officeHours,
        });
      }
      return true;
    });
  }

  return {
    invalidFields,
  };
};
