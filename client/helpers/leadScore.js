/*
 * Copyright (c) 2022 Reva Technology Inc., all rights reserved.
 * Unauthorized copying of this file, via any medium is strictly prohibited
 * Licensed under the Elastic License 2.0; you may not use this file except
 * in compliance with the Elastic License 2.0.
 */

import { DALTypes } from '../../common/enums/DALTypes';

const hash = {
  [DALTypes.LeadScore.PROSPECT]: 'score-question',
  [DALTypes.LeadScore.BRONZE]: 'score-3',
  [DALTypes.LeadScore.SILVER]: 'score-2',
  [DALTypes.LeadScore.GOLD]: 'score-1',
};

export const getLeadScoreIcon = score => hash[score] || 'score-question';
export const getLeadScore = score => (score === 'prospect' ? null : score);
