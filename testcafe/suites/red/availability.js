/*
 * Copyright (c) 2022 Reva Technology Inc., all rights reserved.
 * Unauthorized copying of this file, via any medium is strictly prohibited
 * Licensed under the Elastic License 2.0; you may not use this file except
 * in compliance with the Elastic License 2.0.
 */

import { loginAs, expectVisible, doLogoutIfNeeded, getTenantURL, getUserPassword, switchAvailability } from '../../helpers/helpers';
import { setHooks } from '../../helpers/hooks';
import { validateDashboardVisible } from '../../helpers/dashboardHelpers';

setHooks(fixture('availability'), {
  fixtureName: 'availability',
  beforeEach: async t => {
    await t.navigateTo(getTenantURL('/'));
  },
  afterEach: t => doLogoutIfNeeded(t),
});

const expectUserStatusIs = (t, status) => expectVisible(t, { selector: `[data-id="employee-avatar"] [data-part="badge"] [data-red-icon][name="${status}"]` });

const doLogin = async t => {
  await loginAs(t, { user: 'bill@reva.tech', password: getUserPassword() });
  await validateDashboardVisible(t);
};

test('User should be listed as available after logging in', async t => {
  await doLogin(t);
  await expectUserStatusIs(t, 'available');
});

test('The avatar badge for availability should change when a user changes the availability', async t => {
  await doLogin(t);

  // toggle availability switch to `available`
  await switchAvailability(t);
  await expectUserStatusIs(t, 'available');

  // toggle availability switch to `not-available`
  await switchAvailability(t);
  await expectUserStatusIs(t, 'not-available');
});
