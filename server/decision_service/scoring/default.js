/*
 * Copyright (c) 2022 Reva Technology Inc., all rights reserved.
 * Unauthorized copying of this file, via any medium is strictly prohibited
 * Licensed under the Elastic License 2.0; you may not use this file except
 * in compliance with the Elastic License 2.0.
 */

import { DALTypes } from '../../../common/enums/DALTypes';
import { toMoment } from '../../../common/helpers/moment-utils';

const scores = [DALTypes.LeadScore.PROSPECT, DALTypes.LeadScore.BRONZE, DALTypes.LeadScore.SILVER, DALTypes.LeadScore.GOLD];
const compareScore = (a, b) => scores.indexOf(a) - scores.indexOf(b);

export const computePartyScore = (partyStartDate, appointments, initialContact) => {
  const initialScore = initialContact ? DALTypes.LeadScore.BRONZE : DALTypes.LeadScore.PROSPECT;

  const finalScore = appointments.reduce((acc, a) => {
    const appointmentCreated = toMoment(a.created_at);
    const appointmentStart = toMoment(a.metadata.startDate);

    const startDate = toMoment(initialContact || partyStartDate);
    const appCreatedDiff = Math.ceil(appointmentCreated.diff(startDate, 'days', true));
    const appDueDiff = Math.ceil(appointmentStart.diff(startDate, 'days', true));

    let score = DALTypes.LeadScore.BRONZE;
    if (appCreatedDiff === 1 && appDueDiff <= 14) {
      score = DALTypes.LeadScore.GOLD;
    } else if (appCreatedDiff === 1 && appDueDiff > 14) {
      score = DALTypes.LeadScore.SILVER;
    } else {
      score = DALTypes.LeadScore.BRONZE;
    }

    acc = [acc, score].sort(compareScore)[1];
    return acc;
  }, initialScore);

  return finalScore;
};
