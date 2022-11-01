/*
 * Copyright (c) 2022 Reva Technology Inc., all rights reserved.
 * Unauthorized copying of this file, via any medium is strictly prohibited
 * Licensed under the Elastic License 2.0; you may not use this file except
 * in compliance with the Elastic License 2.0.
 */

import { toMoment, isMoment } from '../../../../common/helpers/moment-utils';
import { DALTypes } from '../../../../common/enums/DALTypes';
import { CORTICON_INPUT_DATE_TIME_FORMAT } from '../../../../common/date-constants';

const { CommunicationDirection, CommunicationMessageType, MemberType } = DALTypes;

export default class DSInput {
  get timezone() {
    return 'UTC';
  }

  get defaultMoveoutNoticePeriodDays() {
    return 60;
  }

  formatDate = (date, format = CORTICON_INPUT_DATE_TIME_FORMAT) => {
    let formattedDate;
    if (!date) return formattedDate;
    const dateMoment = isMoment(date) ? date : toMoment(date, { timezone: this.timezone });
    formattedDate = `${dateMoment.format(format)} GMT`;
    return formattedDate;
  };

  // expected duration formats
  // HH:mm:ss => 01:35:04 = 5704 seconds
  // mm:ss => 35:04 = 2104 seconds
  // ss => 04 = 4 seconds
  getDurationInSeconds = (duration = '', durationRegex = /^([0-5][0-9])$|^([0-5][0-9]:[0-5][0-9])$|^([0-2][0-3]:[0-5][0-9]:[0-5][0-9])$/) => {
    if (!durationRegex.test(duration)) return '';
    return duration.split(':').reduce((acc, val) => 60 * acc + +val, 0);
  };

  isDateAfter = (date1, date2) => {
    const { timezone } = this;
    const moment1 = toMoment(date1, { timezone });
    const moment2 = toMoment(date2, { timezone });
    return moment2.isAfter(moment1);
  };

  isInboundCall = comm => comm?.type === CommunicationMessageType.CALL && comm?.direction === CommunicationDirection.IN;

  isCommunicationForAllPartyMembers = (personsInComm = [], party = {}) => {
    const partyMembers = party.members || [];
    const activePartyMembersPersonIds = partyMembers
      .filter(({ partyMember }) => !partyMember.endDate && partyMember.memberType === MemberType.RESIDENT)
      .map(({ partyMember }) => partyMember.personId)
      .sort();

    return (
      personsInComm.length === activePartyMembersPersonIds.length &&
      personsInComm.sort().every((personId, index) => personId === activePartyMembersPersonIds[index])
    );
  };
}
