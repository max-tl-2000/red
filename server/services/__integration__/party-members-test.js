/*
 * Copyright (c) 2022 Reva Technology Inc., all rights reserved.
 * Unauthorized copying of this file, via any medium is strictly prohibited
 * Licensed under the Elastic License 2.0; you may not use this file except
 * in compliance with the Elastic License 2.0.
 */

import { expect } from 'chai';
import newId from 'uuid/v4';
import { createAPerson, createAPersonContactInfo, createAUser, createAParty, createAPartyMember, createAProperty } from '../../testUtils/repoHelper';
import { createAPersonApplication } from '../../../rentapp/server/test-utils/repo-helper';
import { getPersonApplicationsByPersonIds } from '../../../rentapp/server/dal/person-application-repo';
import { DALTypes } from '../../../common/enums/DALTypes';
import { tenant } from '../../testUtils/setupTestGlobalContext';

describe('/partyMembers', () => {
  let user;
  let basePerson;
  let baseParty;
  let baseAssignedProperty;
  const ctx = { tenantId: tenant.id };

  beforeEach(async () => {
    baseAssignedProperty = await createAProperty();
    basePerson = await createAPerson('John Papa SR', 'John P');
    const contactInfo1 = [
      { type: DALTypes.ContactInfoType.PHONE, value: '12025550395', isPrimary: true },
      { type: DALTypes.ContactInfoType.EMAIL, value: 'john+default@reva.tech', isPrimary: true },
    ];

    await createAPersonContactInfo(basePerson.id, ...contactInfo1);

    user = await createAUser();
    baseParty = await createAParty({ userId: user.id, assignedPropertyId: baseAssignedProperty.id });
    await createAPartyMember(baseParty.id, { personId: basePerson.id });
  });

  describe('when adding an existing person', () => {
    const setUpCopyActiveApplicationScenario = async (assignedPropertyId, paidApplication = false) => {
      await createAPersonApplication({ firstName: 'Pippo Inzaghi' }, basePerson.id, baseParty.id, newId(), paidApplication);
      const party = await createAParty({ userId: user.id, assignedPropertyId });
      await createAPartyMember(party.id, { personId: basePerson.id });
      return party;
    };

    const assertCopyActiveApplicationScenario = async (lengthOfApplications, assertFn) => {
      const appsForResultPerson = await getPersonApplicationsByPersonIds(ctx, [basePerson.id]);
      expect(appsForResultPerson.length).to.equal(lengthOfApplications);
      expect(appsForResultPerson.map(({ partyId }) => partyId)).to.include(baseParty.id);
      assertFn && assertFn(appsForResultPerson);
    };

    describe('and it has a paid application on the same assigned property', () => {
      it('should copy the active application', async () => {
        const party = await setUpCopyActiveApplicationScenario(baseAssignedProperty.id, true);

        await assertCopyActiveApplicationScenario(2, appsForResultPerson => expect(appsForResultPerson.map(({ partyId }) => partyId)).to.include(party.id));
      });
    });

    describe('and it has a not paid application on the same assigned property', () => {
      it('should not copy the active application', async () => {
        await setUpCopyActiveApplicationScenario(baseAssignedProperty.id, false);
        await assertCopyActiveApplicationScenario(1);
      });
    });

    describe('and it has a paid application on a different assigned property', () => {
      it('should not copy the active application', async () => {
        const { id: propertyId } = await createAProperty();
        await setUpCopyActiveApplicationScenario(propertyId, true);
        await assertCopyActiveApplicationScenario(1);
      });
    });
  });
});
