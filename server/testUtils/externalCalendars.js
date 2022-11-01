/*
 * Copyright (c) 2022 Reva Technology Inc., all rights reserved.
 * Unauthorized copying of this file, via any medium is strictly prohibited
 * Licensed under the Elastic License 2.0; you may not use this file except
 * in compliance with the Elastic License 2.0.
 */

import newId from 'uuid/v4';
import { toMoment, DATE_ISO_FORMAT } from '../../common/helpers/moment-utils';
import { EventStatus } from '../../common/enums/calendarTypes';

export const createExternalEvent = (startDate, duration = 30) => {
  const start = toMoment(startDate).toISOString();
  const end = toMoment(startDate).add(duration, 'minutes').toISOString();
  return {
    calendar_id: newId(),
    start,
    end,
    free_busy_status: EventStatus.BUSY,
    event_uid: `evt_external_${newId()}`,
  };
};

export const createExternalAllDayEvent = ({ startDate, numberOfDays = 1 }) => {
  const start = toMoment(startDate).format(DATE_ISO_FORMAT);
  const end = toMoment(startDate).add(numberOfDays, 'days').format(DATE_ISO_FORMAT);
  return {
    calendar_id: newId(),
    start,
    end,
    free_busy_status: EventStatus.BUSY,
    event_uid: `evt_external_${newId()}`,
  };
};
