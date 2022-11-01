/*
 * Copyright (c) 2022 Reva Technology Inc., all rights reserved.
 * Unauthorized copying of this file, via any medium is strictly prohibited
 * Licensed under the Elastic License 2.0; you may not use this file except
 * in compliance with the Elastic License 2.0.
 */

import '../../testUtils/setupTestGlobalContext';
import newId from 'uuid/v4';
import { knex } from '../../database/factory';
import { createTenantSchema } from '../tenantsRepo';

describe('dal/tenantsRepo', () => {
  it('creating and migrating a tenant with UUID like ID works', async () => {
    const tenant = { id: newId(), name: newId() };
    await createTenantSchema(knex, tenant);
  });
});
