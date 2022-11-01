/*
 * Copyright (c) 2022 Reva Technology Inc., all rights reserved.
 * Unauthorized copying of this file, via any medium is strictly prohibited
 * Licensed under the Elastic License 2.0; you may not use this file except
 * in compliance with the Elastic License 2.0.
 */

import partyData from './party.json';
import { getPartyMembersGroupedByType, partyFromRaw } from '../../../../common/helpers/party-utils';
import { DALTypes } from '../../../../common/enums/DALTypes';

describe('party model', () => {
  describe('partyFromRaw', () => {
    it('should order guests moving residents at the beginning', () => {
      const model = partyFromRaw(partyData);
      const expectedArr = ['Hilary Bailey', 'Arthur Barnes', 'John Barnes', 'Janet Asimov', 'Jhon Asimov'];

      expect(model.orderedGuests.map(guest => guest.safeTextName)).toEqual(expectedArr);
    });
  });
  describe('defaultGuest', () => {
    it('should return the first Resident user', () => {
      const model = partyFromRaw(partyData);
      expect(model.defaultGuest).toEqual('Hilary Bailey');
    });
  });

  describe('getPartyMembersGroupedByType', () => {
    describe('When having two residents, one occupant and two guarantors as party members', () => {
      it('should return two resident, one occupant and one guarantor wich is not linked and other that is linked', () => {
        const { residents, occupants, guarantors } = getPartyMembersGroupedByType(partyData);

        expect(residents).toHaveLength(2);
        expect(occupants).toHaveLength(1);
        expect(guarantors).toHaveLength(2);
        expect(guarantors.some(guarantor => guarantor.person.hasGuarantees)).toBe(true);
        expect(guarantors.some(guarantor => !guarantor.person.hasGuarantees)).toBe(true);

        const residentsWithLinkedGuarantor = residents.filter(resident => resident.guaranteedBy);
        expect(residentsWithLinkedGuarantor).toHaveLength(1);
      });

      it('should return two resident and two guarantors', () => {
        const { residents, occupants, guarantors } = getPartyMembersGroupedByType(partyData, pm => pm.id !== '78dccd96-8503-43ff-a21f-bdf083bb437e');

        expect(residents).toHaveLength(2);
        expect(occupants).toHaveLength(0);
        expect(guarantors).toHaveLength(2);
      });
    });

    describe('When having two residents and no guarantors as party members', () => {
      it('should return two resident only', () => {
        const partyOnlyWithResidents = partyData.filter(member => member.memberType === DALTypes.MemberType.RESIDENT);
        const { residents, occupants, guarantors } = getPartyMembersGroupedByType(partyOnlyWithResidents);

        expect(residents).toHaveLength(2);
        expect(occupants).toHaveLength(0);
        expect(guarantors).toHaveLength(0);
      });
    });
  });
});
