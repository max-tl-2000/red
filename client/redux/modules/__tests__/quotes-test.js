/*
 * Copyright (c) 2022 Reva Technology Inc., all rights reserved.
 * Unauthorized copying of this file, via any medium is strictly prohibited
 * Licensed under the Elastic License 2.0; you may not use this file except
 * in compliance with the Elastic License 2.0.
 */

import reducer, { SCREEN_RESULTS_SUCCESS } from '../quotes';
import { FADV_RESPONSE_STATUS } from '../../../../rentapp/common/screening-constants';

describe('When getting screening Summary', () => {
  it('should get screening results including INCOMPLETE state', () => {
    const incompleteScreening = { status: FADV_RESPONSE_STATUS.INCOMPLETE };
    const screeningResults = [incompleteScreening, { status: FADV_RESPONSE_STATUS.COMPLETE }];

    const state = reducer({}, { type: SCREEN_RESULTS_SUCCESS, result: { screeningResults } });
    expect(state.screeningSummary.screeningResults).toContain(incompleteScreening);
  });
});
