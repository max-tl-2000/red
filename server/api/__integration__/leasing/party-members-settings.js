/*
 * Copyright (c) 2022 Reva Technology Inc., all rights reserved.
 * Unauthorized copying of this file, via any medium is strictly prohibited
 * Licensed under the Elastic License 2.0; you may not use this file except
 * in compliance with the Elastic License 2.0.
 */

import request from 'supertest';
import { expect } from 'chai';
import app from '../../api';
import { getAuthHeader } from '../../../testUtils/apiHelper';
import { createAParty, createAPartyMember, createAUser } from '../../../testUtils/repoHelper';
import { DALTypes } from '../../../../common/enums/DALTypes';
import { tenant } from '../../../testUtils/setupTestGlobalContext';
import { updateTenant } from '../../../services/tenantService';

describe('API/parties', () => {
  const updatePartySettings = async ({ allowOccupantsInCorporate = false, allowOccupantsInTraditional = false } = {}) => {
    await updateTenant(tenant.id, {
      partySettings: {
        ...tenant.partySettings,
        traditional: { showOccupantMember: allowOccupantsInTraditional },
        corporate: { showOccupantMember: allowOccupantsInCorporate },
      },
    });
  };

  const setUpScenario = async leaseType => {
    const user = await createAUser();
    const party = await createAParty({ userId: user.id, leaseType });
    const partyMember = await createAPartyMember(party.id, {
      fullName: 'Luke Skywalker',
      memberType: DALTypes.MemberType.RESIDENT,
    });
    return { party, partyMember, user };
  };

  const addPartyMemberRequest = (party, user, memberType = DALTypes.MemberType.RESIDENT) =>
    request(app).post(`/parties/${party.id}/members`).set(getAuthHeader(tenant.id, user.id)).send({
      memberType,
      fullName: 'John Doe',
    });

  const assertAllowedScenario = async (party, user, memberType = DALTypes.MemberType.RESIDENT) => {
    await addPartyMemberRequest(party, user, memberType)
      .expect(200)
      .expect(r => {
        expect(r.body.memberType).to.equal(memberType);
        expect(r.body.fullName).to.equal('John Doe');
      });
  };

  const assertNotAllowedScenario = async (party, user, memberType, token, statusCode = 400) =>
    await addPartyMemberRequest(party, user, memberType)
      .expect(statusCode)
      .expect(r => expect(r.body.token).to.equal(token));

  beforeEach(async () => {
    await updatePartySettings();
  });

  describe('given a request to add a member to a party', () => {
    describe('when is a corporate party', () => {
      describe('and already has a primary tenant', () => {
        it('responds with status code 412 and ADD_PARTY_MEMBER_NOT_ALLOWED token', async () => {
          const { party, user } = await setUpScenario(DALTypes.PartyTypes.CORPORATE);

          await assertNotAllowedScenario(party, user, DALTypes.MemberType.RESIDENT, 'ADD_PARTY_MEMBER_NOT_ALLOWED', 412);
        });
      });

      describe('and the occupants member are not allowed', () => {
        it('responds with status code 400 and INVALID_MEMBER_TYPE_FOR_PARTY token', async () => {
          const { party, user } = await setUpScenario(DALTypes.PartyTypes.CORPORATE);

          await assertNotAllowedScenario(party, user, DALTypes.MemberType.OCCUPANT, 'INVALID_MEMBER_TYPE_FOR_PARTY');
        });
      });

      describe('and the occupants member are allowed', () => {
        it('responds with status code 200 and a new member should be added', async () => {
          await updatePartySettings({ allowOccupantsInCorporate: true });
          const { party, user } = await setUpScenario(DALTypes.PartyTypes.CORPORATE);

          await assertAllowedScenario(party, user, DALTypes.MemberType.OCCUPANT);
        });
      });
    });

    describe('when is a traditional party', () => {
      describe('and the occupants member are not allowed', () => {
        it('responds with status code 400 and INVALID_MEMBER_TYPE_FOR_PARTY token', async () => {
          const { party, user } = await setUpScenario(DALTypes.PartyTypes.TRADITIONAL);

          await assertNotAllowedScenario(party, user, DALTypes.MemberType.OCCUPANT, 'INVALID_MEMBER_TYPE_FOR_PARTY');
        });
      });

      describe('and the occupants member are allowed', () => {
        it('responds with status code 200 and a new member should be added', async () => {
          await updatePartySettings({ allowOccupantsInTraditional: true });
          const { party, user } = await setUpScenario(DALTypes.PartyTypes.TRADITIONAL);

          await assertAllowedScenario(party, user, DALTypes.MemberType.OCCUPANT);
        });
      });
    });
  });

  describe('given a request to change the member type', () => {
    const setUpUpdateScenario = (party, partyMember, user) => {
      const updatedMember = {
        ...partyMember,
        memberType: DALTypes.MemberType.OCCUPANT,
      };

      return request(app).patch(`/parties/${party.id}/members/${partyMember.id}`).set(getAuthHeader(tenant.id, user.id)).send(updatedMember);
    };

    describe('and the occupants member are not allowed', () => {
      it('responds with status code 400 and INVALID_MEMBER_TYPE_FOR_PARTY token', async () => {
        const { party, partyMember, user } = await setUpScenario(DALTypes.PartyTypes.TRADITIONAL);

        await setUpUpdateScenario(party, partyMember, user)
          .expect(400)
          .expect(r => expect(r.body.token).to.equal('INVALID_MEMBER_TYPE_FOR_PARTY'));
      });
    });

    describe('and the occupants member are allowed', () => {
      it('responds with status code 200 and a new member should be added', async () => {
        await updatePartySettings({ allowOccupantsInTraditional: true });
        const { party, partyMember, user } = await setUpScenario(DALTypes.PartyTypes.TRADITIONAL);

        await setUpUpdateScenario(party, partyMember, user)
          .expect(200)
          .expect(r => {
            expect(r.body.memberType).to.equal(DALTypes.MemberType.OCCUPANT);
            expect(r.body.fullName).to.equal('Luke Skywalker');
          });
      });
    });
  });
});
