/*
 * Copyright (c) 2022 Reva Technology Inc., all rights reserved.
 * Unauthorized copying of this file, via any medium is strictly prohibited
 * Licensed under the Elastic License 2.0; you may not use this file except
 * in compliance with the Elastic License 2.0.
 */

import newUUID from 'uuid/v4';
import { getDisplayName, getEnhancedPerson } from '../person-helper';
import { DALTypes } from '../../enums/DALTypes';
import { displayNamedata } from './fixtures/person-helper-data';

describe('person helper', () => {
  describe('getDisplayName', () => {
    displayNamedata.forEach(({ description, expected, person, options = {}, result }) => {
      describe(description, () => {
        it(expected, () => {
          const displayName = getDisplayName(person, { ...options });
          expect(displayName).toEqual(result);
        });
      });
    });
  });

  describe('When calling the getEnhancedPerson function', () => {
    const guarantorPersonId = newUUID();
    const partyMembers = [
      {
        personId: newUUID(),
        memberType: DALTypes.MemberType.RESIDENT,
      },
      {
        personId: guarantorPersonId,
        memberType: DALTypes.MemberType.GUARANTOR,
      },
    ];

    it('should return the enhanced person with "otherMembers" new field', () => {
      const enhancedPerson = getEnhancedPerson(partyMembers, guarantorPersonId);
      expect(enhancedPerson.person).toHaveProperty(
        'otherMembers',
        partyMembers.filter(pm => pm.memberType !== DALTypes.MemberType.GUARANTOR),
      );
    });
  });
});
