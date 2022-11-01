/*
 * Copyright (c) 2022 Reva Technology Inc., all rights reserved.
 * Unauthorized copying of this file, via any medium is strictly prohibited
 * Licensed under the Elastic License 2.0; you may not use this file except
 * in compliance with the Elastic License 2.0.
 */

import { Selector as $ } from 'testcafe';
import { loginAs, doLogoutIfNeeded, getTenantURL, expectTextIsEqual, getUserPassword, clickOnElement } from '../../helpers/helpers';
import { forceUsersLogout } from '../../../cucumber/lib/utils/apiHelper';
import { TEST_TENANT_ID } from '../../../common/test-helpers/tenantInfo';
import { setHooks } from '../../helpers/hooks';

setHooks(fixture('ForceLogout'), {
  fixtureName: 'forceLogout',
  beforeEach: t => t.navigateTo(getTenantURL('/')),
  afterEach: t => doLogoutIfNeeded(t),
});

test('CPM-9509 - Automatic logout while on prospect page does not redirect to login route', async t => {
  await loginAs(t, { user: 'bill@reva.tech', password: getUserPassword() });

  await clickOnElement(t, {
    selector: $('#prospects [data-component="card"]').find('div').withText('Paul Morgan'),
  });

  await forceUsersLogout({ tenantId: TEST_TENANT_ID });

  await expectTextIsEqual(t, { selector: '#signInTitle', text: 'Sign in' });
});
