/*
 * Copyright (c) 2022 Reva Technology Inc., all rights reserved.
 * Unauthorized copying of this file, via any medium is strictly prohibited
 * Licensed under the Elastic License 2.0; you may not use this file except
 * in compliance with the Elastic License 2.0.
 */

import { loginAs, expectTextIsEqual, doLogoutIfNeeded, getTenantURL, getUserPassword } from '../../helpers/helpers';
import { setHooks } from '../../helpers/hooks';
import { validateDashboardVisible } from '../../helpers/dashboardHelpers';

setHooks(fixture('Login'), {
  fixtureName: 'login',
  beforeEach: t => t.navigateTo(getTenantURL('/')),
  afterEach: t => doLogoutIfNeeded(t),
});

test('CPM-8: User logs in using valid credentials', async t => {
  await loginAs(t, { user: 'bill@reva.tech', password: getUserPassword() });
  await validateDashboardVisible(t);
});

test('CPM-8: User attempt to login with invalid email', async t => {
  await loginAs(t, { user: 'wronguser@', password: 'admin' });
  await expectTextIsEqual(t, { selector: '#txtEmail-err-msg', text: 'Provide a valid email address' });
});

test('CPM-8: User logs in using invalid password', async t => {
  await loginAs(t, { user: 'admin@reva.tech', password: 'YYYY' });
  await expectTextIsEqual(t, { selector: '[data-id="signInError"]', text: 'Your email and password do not match our records.' });
});

test('CPM-172:  No validation message when login using an invalid account', async t => {
  await loginAs(t, { user: 'wronguser@reva.tech', password: 'wrongpass' });
  await expectTextIsEqual(t, { selector: '[data-id="signInError"]', text: 'Your email and password do not match our records.' });
});
