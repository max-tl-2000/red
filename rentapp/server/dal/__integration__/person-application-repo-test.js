/*
 * Copyright (c) 2022 Reva Technology Inc., all rights reserved.
 * Unauthorized copying of this file, via any medium is strictly prohibited
 * Licensed under the Elastic License 2.0; you may not use this file except
 * in compliance with the Elastic License 2.0.
 */

import { expect } from 'chai';
import getUUID from 'uuid/v4';
import { ctx, createAPersonApplication, createAPartyApplication } from '../../test-utils/repo-helper';
import { getPersonApplicationsByPartyId, getPersonApplicationsByFilter } from '../person-application-repo';
import { createAParty, createAPartyMember, createAPerson } from '../../../../server/testUtils/repoHelper';
import { markMemberAsRemoved } from '../../../../server/dal/partyRepo';

describe('dal/person-application-repo', () => {
  describe('when calling getPersonApplicationsByPartyId', () => {
    it('should return all the person applications and filter out the ones without party member', async () => {
      const { id: partyId } = await createAParty({}, ctx);
      const personOneName = 'Scottie';
      const personTwoName = 'Jordan';

      const { id: personOneId } = await createAPerson(personOneName, personOneName, null, ctx);
      const { id: personTwoId } = await createAPerson(personTwoName, personTwoName, null, ctx);

      const memberOne = await createAPartyMember(partyId, { personId: personOneId }, ctx);
      await createAPartyMember(partyId, { personId: personTwoId }, ctx);

      const { id: partyApplicationId } = await createAPartyApplication(partyId, getUUID());
      await createAPersonApplication({ firstName: personOneName }, personOneId, partyId, partyApplicationId, true);
      await createAPersonApplication({ firstName: personTwoName }, personTwoId, partyId, partyApplicationId, true);

      const personApplications = await getPersonApplicationsByPartyId(ctx, partyId);

      expect(personApplications.length).to.equal(2);

      await markMemberAsRemoved(ctx, memberOne.id);

      const personApplicationsAfterMemberRemoved = await getPersonApplicationsByPartyId(ctx, partyId);

      expect(personApplicationsAfterMemberRemoved.length).to.equal(1);
    });
  });
});

describe('dal/person-application-repo', () => {
  describe('when calling getPersonApplicationsByFilter', () => {
    it(`should return all the person applications including the ones where the party member is inactive,
    when passing the flag includeApplicationsWherePartyMemberIsInactive`, async () => {
      const { id: partyId } = await createAParty({}, ctx);
      const personOneName = 'Scottie';
      const personTwoName = 'Jordan';

      const { id: personOneId } = await createAPerson(personOneName, personOneName, null, ctx);
      const { id: personTwoId } = await createAPerson(personTwoName, personTwoName, null, ctx);

      const memberOne = await createAPartyMember(partyId, { personId: personOneId }, ctx);
      await createAPartyMember(partyId, { personId: personTwoId }, ctx);

      const { id: partyApplicationId } = await createAPartyApplication(partyId, getUUID());
      await createAPersonApplication({ firstName: personOneName }, personOneId, partyId, partyApplicationId, true);
      await createAPersonApplication({ firstName: personTwoName }, personTwoId, partyId, partyApplicationId, true);

      await markMemberAsRemoved(ctx, memberOne.id);

      const personApplicationsAfterMemberRemoved = await getPersonApplicationsByFilter(
        ctx,
        { partyId },
        { includeApplicationsWherePartyMemberIsInactive: true },
      );

      expect(personApplicationsAfterMemberRemoved.length).to.equal(2);
    });
  });
});
