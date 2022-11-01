/*
 * Copyright (c) 2022 Reva Technology Inc., all rights reserved.
 * Unauthorized copying of this file, via any medium is strictly prohibited
 * Licensed under the Elastic License 2.0; you may not use this file except
 * in compliance with the Elastic License 2.0.
 */

import { expect } from 'chai';
import { createAUser, createAParty, createAPartyMember, createAnAppointment } from '../../testUtils/repoHelper';
import { logEntityAdded } from '../activityLogService';
import { getAnalyticsLogs } from '../../dal/analyticsRepo';
import { COMPONENT_TYPES, ACTIVITY_TYPES } from '../../../common/enums/activityLogTypes';
import { tenant } from '../../testUtils/setupTestGlobalContext';

describe('when an activity log entry is saved', () => {
  it('a coresponding analytics log is also saved', async () => {
    const user = await createAUser();
    const party = await createAParty({ userId: user.id });
    await createAPartyMember(party.id);
    const appointment = await createAnAppointment({
      partyId: party.id,
      salesPersonId: user.id,
    });

    const ctx = { tenantId: tenant.id };
    await logEntityAdded(ctx, { entity: appointment, component: COMPONENT_TYPES.APPOINTMENT });

    const [analyticsLogEntry] = await getAnalyticsLogs(ctx);

    // JSON reparsing needed to avoid issues fom different date formats (created_at, updated_at)
    expect(analyticsLogEntry.entity).to.deep.equal(JSON.parse(JSON.stringify(appointment)));

    expect(analyticsLogEntry.component).to.deep.equal(COMPONENT_TYPES.APPOINTMENT);
    expect(analyticsLogEntry.type).to.deep.equal(ACTIVITY_TYPES.NEW);
    expect(analyticsLogEntry.context).to.be.ok;
  });
});
