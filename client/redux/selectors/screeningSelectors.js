/*
 * Copyright (c) 2022 Reva Technology Inc., all rights reserved.
 * Unauthorized copying of this file, via any medium is strictly prohibited
 * Licensed under the Elastic License 2.0; you may not use this file except
 * in compliance with the Elastic License 2.0.
 */

import { createSelector } from 'reselect';
import { ExpirationScreeningTypes } from 'enums/fadvRequestTypes';

export const getScreeningSummary = createSelector(
  state => state.dataStore.get('screeningSummary'),
  (state, props) => props.partyId,
  (screeningSummary, partyId) => (screeningSummary.toArray().find(summary => summary.partyId === partyId) || {}).screeningSummary || {},
);

export const getScreeningExpirationResults = createSelector(getScreeningSummary, screeningSummary => {
  const { expirationScreeningType, screeningExpirationDate, screeningCreatedAt } = screeningSummary || {};
  return {
    results: {
      expirationScreeningType,
      screeningExpirationDate,
      screeningCreatedAt,
    },
    hasExpiredScreenings: expirationScreeningType === ExpirationScreeningTypes.EXPIRED,
  };
});
