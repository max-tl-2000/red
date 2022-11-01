/*
 * Copyright (c) 2022 Reva Technology Inc., all rights reserved.
 * Unauthorized copying of this file, via any medium is strictly prohibited
 * Licensed under the Elastic License 2.0; you may not use this file except
 * in compliance with the Elastic License 2.0.
 */

import PartyDetailPage from '../pages/partyDetailPage';
import ActivityLogPage from '../pages/activityLogPage';
import { clickOnElement } from './helpers';

export const checkActivityLogEntryByIndex = async (t, { userInfo, action, index, component, details }, cleanText) => {
  const partyDetailPage = new PartyDetailPage(t);
  const activityLogPage = new ActivityLogPage(t);
  await clickOnElement(t, { selector: partyDetailPage.selectors.partyCardMenu });
  await clickOnElement(t, { selector: partyDetailPage.selectors.viewActivityLogItem });
  await activityLogPage.checkActivityLogData({ index, userInfo, action, component, details, cleanText });
};
