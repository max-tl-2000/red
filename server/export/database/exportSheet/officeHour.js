/*
 * Copyright (c) 2022 Reva Technology Inc., all rights reserved.
 * Unauthorized copying of this file, via any medium is strictly prohibited
 * Licensed under the Elastic License 2.0; you may not use this file except
 * in compliance with the Elastic License 2.0.
 */

import { getTeamsOfficeHoursToExport } from '../../../dal/teamsRepo';
import { buildDataPumpFormat } from '../../helpers/export';

const convertMinToFloatNumber = timeInMinutes => timeInMinutes / (24 * 60);

const buildOfficeHours = teams =>
  teams.reduce((acc, team) => {
    const { officeHours, name } = team;
    const officeHoursByDay = Object.keys(officeHours).reduce((officeHourAcc, officeHour) => {
      const day = officeHours[officeHour];

      if (day.startTimeOffsetInMin === 0 && day.endTimeOffsetInMin === 0) return officeHourAcc;

      officeHourAcc.push({
        team: name,
        day: officeHour,
        start: convertMinToFloatNumber(day.startTimeOffsetInMin),
        end: convertMinToFloatNumber(day.endTimeOffsetInMin),
      });
      return officeHourAcc;
    }, []);
    return acc.concat(officeHoursByDay);
  }, []);

export const exportOfficeHours = async (ctx, { propertyIdsToExport, columnHeaders: columnHeadersOrdered }) => {
  const teams = await getTeamsOfficeHoursToExport(ctx, propertyIdsToExport);
  const officeHours = buildOfficeHours(teams);

  return buildDataPumpFormat(officeHours, columnHeadersOrdered);
};
