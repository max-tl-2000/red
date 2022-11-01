/*
 * Copyright (c) 2022 Reva Technology Inc., all rights reserved.
 * Unauthorized copying of this file, via any medium is strictly prohibited
 * Licensed under the Elastic License 2.0; you may not use this file except
 * in compliance with the Elastic License 2.0.
 */

import { DALTypes } from '../enums/DALTypes';
import { LA_TIMEZONE } from '../date-constants';
import { toMoment, parseAsInTimezone } from './moment-utils';

export const adjustWalkinDates = comms =>
  (comms || []).map(comm => {
    if (comm.type === DALTypes.CommunicationMessageType.CONTACTEVENT) {
      const walkInComm = { ...comm };
      // this is only to support the old structure where there were no eventDateTime field

      walkInComm.created_at = !walkInComm.message.eventDateTime
        ? parseAsInTimezone(`${comm.message.eventDate} ${comm.message.time}`, { format: 'YYYY-MM-DD hh:mm a', timezone: LA_TIMEZONE })
        : toMoment(comm.message.eventDateTime); // eventDateTime is an ISO string UTC based. No need to apply the timezone here since this is for sorting only

      return walkInComm;
    }
    return comm;
  });
