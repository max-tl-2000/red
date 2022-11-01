/*
 * Copyright (c) 2022 Reva Technology Inc., all rights reserved.
 * Unauthorized copying of this file, via any medium is strictly prohibited
 * Licensed under the Elastic License 2.0; you may not use this file except
 * in compliance with the Elastic License 2.0.
 */

import { expect } from 'chai';
import { getPropertyExternalId, getFirstAndLastName } from '../common-export-utils';

const property = {
  name: '11190',
  externalId: '',
};

describe('When calling the getPropertyExternalId without an inventory and property with an externalId', () => {
  it('should return the external id', () => {
    property.externalId = 'South';
    expect(getPropertyExternalId({ property })).to.equal('South');
  });
});

describe('when calling getFirstAndLastName for a party member with a fullname', () => {
  describe('made of a single first and last name separated by a space', () => {
    it('should split the first word as first name and the last word as last name', () => {
      const partyMember = {
        fullName: 'Soos Ramirez',
        contactInfo: {},
      };

      const parsedName = getFirstAndLastName(partyMember);
      expect(parsedName.firstName).to.equal('Soos');
      expect(parsedName.lastName).to.equal('Ramirez');
    });
  });

  describe('with a two first names and one last name separated by a space', () => {
    it('should split the first two words as a first name and the last word as last name', () => {
      const partyMember = {
        fullName: 'Soos Jay Ramirez',
        contactInfo: {},
      };

      const parsedName = getFirstAndLastName(partyMember);
      expect(parsedName.firstName).to.equal('Soos Jay');
      expect(parsedName.lastName).to.equal('Ramirez');
    });
  });

  describe('with two first and two last names separated by a space', () => {
    it('should split first three words as first name and last word as last name', () => {
      const partyMember = {
        fullName: 'Soos Jay Jose Anyes',
        contactInfo: {},
      };

      const parsedName = getFirstAndLastName(partyMember);
      expect(parsedName.lastName).to.equal('Anyes');
      expect(parsedName.firstName).to.equal('Soos Jay Jose');
    });
  });
});
