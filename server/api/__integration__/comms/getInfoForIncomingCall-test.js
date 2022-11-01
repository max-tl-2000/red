/*
 * Copyright (c) 2022 Reva Technology Inc., all rights reserved.
 * Unauthorized copying of this file, via any medium is strictly prohibited
 * Licensed under the Elastic License 2.0; you may not use this file except
 * in compliance with the Elastic License 2.0.
 */

import request from 'supertest';
import { expect } from 'chai';
import { getAuthHeader } from '../../../testUtils/apiHelper';

import app from '../../api';
import {
  testCtx as ctx,
  createAParty,
  createAPartyMember,
  createACommunicationEntry,
  createAUser,
  createAProperty,
  createAInventoryGroup,
  createAnInventory,
  createATeamPropertyProgram,
  createATeam,
} from '../../../testUtils/repoHelper';
import { tenant } from '../../../testUtils/setupTestGlobalContext';
import { DALTypes } from '../../../../common/enums/DALTypes';
import { getFullQualifiedNamesForInventories } from '../../../helpers/inventory';
import { refreshUnitSearchView } from '../../../dal/searchRepo';
import { getProgramById } from '../../../dal/programsRepo';
import { formatEmployeeAssetUrl } from '../../../helpers/assets-helper';

describe('API GET communications/phone/:commId/incomingCallInfo', () => {
  describe('with comm id that is not a UUID', () => {
    it('should respond with status code 400 and token INCORRECT_CALL_ID', async () => {
      const { status, body } = await request(app).get('/communications/phone/123/incomingCallInfo').set(getAuthHeader(tenant.id));

      expect(status).to.equal(400);
      expect(body.token).to.equal('INCORRECT_CALL_ID');
    });
  });

  it('should respond with: fullName, preferredName, propertyName, programName, state, score, targetName, units, contactInfo and transferredFrom if existing', async () => {
    const property = await createAProperty({});
    const inventoryGroup = await createAInventoryGroup({
      propertyId: property.id,
    });
    const inventory = await createAnInventory({
      propertyId: property.id,
      inventoryGroupId: inventoryGroup.id,
    });

    await refreshUnitSearchView({ tenantId: tenant.id });

    const user = await createAUser({ name: 'Aerys' });
    const transferredFromUser = await createAUser({ name: 'Elendil' });
    const party = await createAParty({
      userId: user.id,
      score: DALTypes.LeadScore.SILVER,
      state: DALTypes.PartyStateType.LEAD,
      metadata: { favoriteUnits: [inventory.id] },
      assignedPropertyId: property.id,
    });
    const units = (await getFullQualifiedNamesForInventories({ tenantId: tenant.id }, party.metadata.favoriteUnits)).map(u => u.fullQualifiedName);

    const partyMember = await createAPartyMember(party.id);
    const team = await createATeam();
    const teamPropertyProgram = await createATeamPropertyProgram({
      teamId: team.id,
      propertyId: property.id,
      commDirection: DALTypes.CommunicationDirection.IN,
    });
    const program = await getProgramById(ctx, teamPropertyProgram.programId);

    const comm = await createACommunicationEntry({
      userId: user.id,
      persons: [partyMember.personId],
      parties: [party.id],
      message: { targetName: 'Aragorn II Elesar', transferredFrom: transferredFromUser.id },
      teamPropertyProgramId: teamPropertyProgram.id,
    });

    const { status, body } = await request(app).get(`/communications/phone/${comm.id}/incomingCallInfo`).set(getAuthHeader(tenant.id));

    const avatarUrl = await formatEmployeeAssetUrl({ ...ctx, tenantName: tenant.name }, transferredFromUser.id);
    expect(status).to.equal(200);
    expect(body).to.deep.equal({
      contactInfo: {},
      fullName: partyMember.fullName,
      preferredName: partyMember.preferredName,
      propertyName: property.displayName,
      programName: program.displayName,
      score: party.score,
      state: party.state,
      targetName: comm.message.targetName,
      units,
      owner: user.fullName,
      partyId: party.id,
      transferredFromName: transferredFromUser.fullName,
      transferredFromAvatar: avatarUrl,
    });
  });
});
