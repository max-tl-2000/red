/*
 * Copyright (c) 2022 Reva Technology Inc., all rights reserved.
 * Unauthorized copying of this file, via any medium is strictly prohibited
 * Licensed under the Elastic License 2.0; you may not use this file except
 * in compliance with the Elastic License 2.0.
 */

import { createSelector } from 'reselect';
import QuoteListModel from 'helpers/models/quoteListModel';

const getCurrentUser = state => state.globalStore.get('users').get((state.auth.user || {}).id);

export const getQuoteListModel = createSelector(
  s => s.quotes.quotes,
  s => s.quotes.screeningSummary,
  (s, props) => props.members,
  (s, props) => props.screeningExpirationResults,
  getCurrentUser,
  (quotes, screeningSummary, members, screeningExpirationResults, user) =>
    new QuoteListModel({ quotes, screeningSummary, members, screeningExpirationResults, user }),
);
