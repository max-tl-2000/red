/*
 * Copyright (c) 2022 Reva Technology Inc., all rights reserved.
 * Unauthorized copying of this file, via any medium is strictly prohibited
 * Licensed under the Elastic License 2.0; you may not use this file except
 * in compliance with the Elastic License 2.0.
 */

import { expectDashboardLaneContains, expectVisible } from './helpers';
import DashboardPage from '../pages/dashboardPage';

export const verifyRenewalDashboardCardByState = async (t, { columnId, contactInfo }) => {
  const dashboardPage = new DashboardPage(t);
  if (columnId !== dashboardPage.selectors.prospectsColumn) {
    await dashboardPage.clickOnChevronIcon(2, dashboardPage.selectors.chevronRightIcon);
  }
  await expectDashboardLaneContains(t, { lane: columnId, cardText: contactInfo.legalName });
  await expectVisible(t, { selector: dashboardPage.selectors.renewIcon });

  if (columnId === dashboardPage.selectors.futureResidentsColumn) {
    await expectVisible(t, { selector: dashboardPage.selectors.renewalDetailsTxt });
  }
};
