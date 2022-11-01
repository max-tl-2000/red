/*
 * Copyright (c) 2022 Reva Technology Inc., all rights reserved.
 * Unauthorized copying of this file, via any medium is strictly prohibited
 * Licensed under the Elastic License 2.0; you may not use this file except
 * in compliance with the Elastic License 2.0.
 */

const WAIVE_APPLICATION = 'reva/WAIVE_APPLICATION';
const WAIVE_APPLICATION_SUCCESS = 'reva/WAIVE_APPLICATION_SUCCESS';
const WAIVE_APPLICATION_FAILURE = 'reva/WAIVE_APPLICATION_FAILURE';

const initialState = {};

export default function reducer(state = initialState, action = {}) {
  switch (action.type) {
    case WAIVE_APPLICATION:
    case WAIVE_APPLICATION_SUCCESS:
    case WAIVE_APPLICATION_FAILURE:
      return state;
    default:
  }
  return state;
}

export const waiveApplicationFee = ({ partyId, partyMemberId, isFeeWaived, feeWaiverReason, personApplicationId = '' }) => ({
  types: [WAIVE_APPLICATION, WAIVE_APPLICATION_SUCCESS, WAIVE_APPLICATION_FAILURE],
  promise: client =>
    client.patch(`/applicationFeeWaivers?personApplicationId=${personApplicationId}`, {
      data: {
        partyId,
        isFeeWaived,
        feeWaiverReason,
        partyMemberId,
      },
    }),
});
