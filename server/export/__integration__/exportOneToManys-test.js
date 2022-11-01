/*
 * Copyright (c) 2022 Reva Technology Inc., all rights reserved.
 * Unauthorized copying of this file, via any medium is strictly prohibited
 * Licensed under the Elastic License 2.0; you may not use this file except
 * in compliance with the Elastic License 2.0.
 */

import { expect } from 'chai';
import { exportOneToManysCSV } from '../yardi/exportOneToManys';
import { getTenantByName } from '../../dal/tenantsRepo';
import { saveAppointment } from '../../services/appointments';
import { updateTask } from '../../services/tasks';
import '../../testUtils/setupTestGlobalContext';
import { DALTypes } from '../../../common/enums/DALTypes';
import { createAParty, createAUser, createATeam } from '../../testUtils/repoHelper';
import { now } from '../../../common/helpers/moment-utils';
import { knex } from '../../database/factory';

describe('export-oneToManys', () => {
  const defaultTenantName = 'red';

  describe('given a request to generate the oneToManysFile', () => {
    it('should complete the process without an error', async () => {
      const testTenant = await getTenantByName({ tenantId: 'admin' }, defaultTenantName);
      const ctx = { tenantId: testTenant.id, body: { jobInfo: { name: DALTypes.Jobs.ExportOneToManys } } };

      const team = await createATeam({ ctx });
      const user = await createAUser({ ctx });
      const party = await createAParty(
        {
          ownerTeam: team.id,
          teams: [team.id],
          userId: user.id,
        },
        ctx,
        {
          createAssignedProperty: true,
        },
      );

      const taskToSave = {
        partyId: party.id,
        salesPersonId: user.id,
        startDate: now(),
        endDate: now(),
      };

      const createdApp = await saveAppointment(ctx, taskToSave);
      await updateTask({ tenantId: testTenant.id, authUser: user, headers: { host: 'test' } }, createdApp.id, {
        state: DALTypes.TaskStates.COMPLETED,
      });

      const res = await exportOneToManysCSV(knex, ctx);
      expect(res.rows.length).to.equal(1);
    });
  });
});
