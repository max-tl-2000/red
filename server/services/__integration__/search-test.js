/*
 * Copyright (c) 2022 Reva Technology Inc., all rights reserved.
 * Unauthorized copying of this file, via any medium is strictly prohibited
 * Licensed under the Elastic License 2.0; you may not use this file except
 * in compliance with the Elastic License 2.0.
 */

import { expect } from 'chai';
import { mapSeries } from 'bluebird';
import { tenant } from '../../testUtils/setupTestGlobalContext';
import { DALTypes } from '../../../common/enums/DALTypes';
import { createAPerson, createAPersonContactInfo } from '../../testUtils/repoHelper';

import { getPersonMatches } from '../search';

const getMatchesByType = (matches, type) => matches.filter(match => match.type === type);
const getMatchesByRank = (matches, rank) => matches.filter(match => match.rank === rank);

const createTestPersonForSearch = async personDetails => {
  const person = await createAPerson(personDetails.fullName, personDetails.preferredName);
  const contactInfo = [
    { type: DALTypes.ContactInfoType.PHONE, value: personDetails.phoneNumber, isPrimary: true },
    { type: DALTypes.ContactInfoType.EMAIL, value: personDetails.email, isPrimary: true },
  ];

  return await createAPersonContactInfo(person.id, ...contactInfo);
};

const testPersons = [
  { fullName: 'David I. Smith', preferredName: 'Dave', phoneNumber: '12025550395', email: 'david.smith@reva.tech' },
  { fullName: 'David Marcos', preferredName: 'Dave', phoneNumber: '12025550300', email: 'davidmarcos@gmail.tech' },
  { fullName: 'Angie Devon', preferredName: 'Angie', phoneNumber: '12025550300', email: 'angied@gmail.tech' },
  { fullName: 'David Beckham', preferredName: 'David', phoneNumber: '12025550300', email: 'davidbeckham@gmail.tech' },
  { fullName: 'Beckham David', preferredName: 'Beckham', phoneNumber: '12025550333', email: 'beckhamdavid@gmail.tech' },
  { fullName: 'Russell Crowe', preferredName: 'Russell', phoneNumber: '12025550111', email: 'russell@gmail.tech' },
  { fullName: 'russell Crowe', preferredName: 'Crowe', phoneNumber: '12025550111', email: 'crowe@reva.tech' },
  { fullName: 'RUSSELL crowe', preferredName: 'russell', phoneNumber: '12025550111', email: 'russellcrowe@reva.tech' },
  { fullName: 'russell crowe', preferredName: 'crowe', phoneNumber: '12025550111', email: 'crowe.russell@reva.tech' },
];

describe('search tests', () => {
  beforeEach(async () => await mapSeries(testPersons, async person => await createTestPersonForSearch(person)));

  const data = {
    tenantId: tenant.id,
  };

  describe('given that the search is performed only by name', () => {
    it('should return only weak matches if available', async () => {
      data.body = {
        name: 'David',
      };

      const results = await getPersonMatches(data);
      expect(results.matchedPersons.length).to.equal(4);
      expect(results.matchedPersons.every(res => res.type === DALTypes.PersonMatchType.WEAK)).to.be.true;
    });

    it('should return all matches with rank 1', async () => {
      await createAPerson('David Small', 'Dave');

      data.body = {
        name: 'David',
      };

      const results = await getPersonMatches(data);
      expect(results.matchedPersons.length).to.equal(5);
      expect(results.matchedPersons.every(res => res.type === DALTypes.PersonMatchType.WEAK)).to.be.true;
      expect(results.matchedPersons.every(res => res.rank === 1)).to.be.true;
    });

    it('should return two matches matches ranked', async () => {
      await createAPerson('David Smida', 'Dave');

      data.body = {
        name: 'David Smith',
      };

      const results = await getPersonMatches(data);
      expect(results.matchedPersons.length).to.equal(2);
      expect(results.matchedPersons.every(res => res.type === DALTypes.PersonMatchType.WEAK)).to.be.true;
      expect(results.matchedPersons.every(res => res.rank >= 1)).to.be.true;
    });

    it('should return one match with rank 1', async () => {
      await createAPerson('John Smith, Jr.', 'John');

      data.body = {
        name: 'John Smith',
      };

      const results = await getPersonMatches(data);
      expect(results.matchedPersons.length).to.equal(1);
      expect(results.matchedPersons.every(res => res.type === DALTypes.PersonMatchType.WEAK)).to.be.true;
      expect(results.matchedPersons.every(res => res.rank === 10)).to.be.true;
    });

    it('should return two matches matches ranked', async () => {
      await createAPerson('John Smith, Jr.', 'John');

      data.body = {
        name: 'John Smith, Jr.',
      };

      const results = await getPersonMatches(data);
      expect(results.matchedPersons.length).to.equal(1);
      expect(results.matchedPersons.every(res => res.type === DALTypes.PersonMatchType.WEAK)).to.be.true;
      expect(results.matchedPersons.every(res => res.rank >= 1)).to.be.true;
    });

    describe('given that the search is performed by the full name', () => {
      it('should return the exact match', async () => {
        data.body = {
          name: 'David Marcos',
        };

        const results = await getPersonMatches(data);
        expect(results.matchedPersons.length).to.equal(1);
        expect(results.matchedPersons[0].type).to.equal(DALTypes.PersonMatchType.WEAK);
        expect(results.matchedPersons[0].personObject.fullName).to.equal('David Marcos');
      });
    });
  });

  describe('given the search is performed only by email addresses', () => {
    it('should return only strong matches', async () => {
      data.body = {
        emails: ['davidmarcos@gmail.tech'],
      };

      const results = await getPersonMatches(data);
      expect(results.matchedPersons.length).to.equal(1);
      expect(results.matchedPersons[0].type).to.equal(DALTypes.PersonMatchType.STRONG);
      expect(results.matchedPersons[0].personObject.fullName).to.equal('David Marcos');
    });

    describe('the email has a typo in it', () => {
      it('should not return anything', async () => {
        data.body = {
          emails: ['davidmarcosas@gmail.tech'],
        };

        const results = await getPersonMatches(data);
        expect(results.matchedPersons.length).to.equal(0);
      });
    });

    describe('given the search is done with several emails', () => {
      it('should return the strong match, if only one exists', async () => {
        data.body = {
          emails: ['davidmarcos@gmail.tech', 'juniper@gmail.tech'],
        };

        const results = await getPersonMatches(data);
        expect(results.matchedPersons.length).to.equal(1);
        expect(results.matchedPersons[0].type).to.equal(DALTypes.PersonMatchType.STRONG);
        expect(results.matchedPersons[0].personObject.fullName).to.equal('David Marcos');
      });

      it('should return all strong matches, if there are more', async () => {
        data.body = {
          emails: ['davidmarcos@gmail.tech', 'angied@gmail.tech'],
        };

        const results = await getPersonMatches(data);
        const namesOfMatchingPersons = results.matchedPersons.map(item => item.personObject.fullName);
        expect(namesOfMatchingPersons).to.include('David Marcos');
        expect(namesOfMatchingPersons).to.include('Angie Devon');
        expect(results.matchedPersons.length).to.equal(2);
        expect(results.matchedPersons.every(item => item.type === DALTypes.PersonMatchType.STRONG)).to.be.true;
      });
    });
  });

  describe('given the search is performed only by phone numbers', () => {
    it('should return only strong matches', async () => {
      data.body = {
        phones: {
          newPhoneNumbers: ['12025550395'],
        },
      };

      const results = await getPersonMatches(data);
      expect(results.matchedPersons.length).to.equal(1);
      expect(results.matchedPersons[0].type).to.equal(DALTypes.PersonMatchType.STRONG);
      expect(results.matchedPersons[0].personObject.fullName).to.equal('David I. Smith');
    });

    describe('the phone has a typo in it', () => {
      it('should not return anything', async () => {
        data.body = {
          phones: {
            newPhoneNumbers: ['120255440300'],
          },
        };

        const results = await getPersonMatches(data);
        expect(results.matchedPersons.length).to.equal(0);
      });
    });

    describe('given the search is done with several phones', () => {
      it('should return the ones that are strong matches', async () => {
        data.body = {
          phones: {
            newPhoneNumbers: ['12025550395', '12025550311'],
          },
        };

        const results = await getPersonMatches(data);
        expect(results.matchedPersons.length).to.equal(1);
        expect(results.matchedPersons[0].type).to.equal(DALTypes.PersonMatchType.STRONG);
        expect(results.matchedPersons[0].personObject.fullName).to.equal('David I. Smith');
      });
    });

    describe('given the search is done with several phones and one is shared between two persons', () => {
      it('should return the ones that are strong matches including those two that have a shared phone ', async () => {
        data.body = {
          phones: {
            newPhoneNumbers: ['12025550395', '12025550300'],
          },
        };

        const results = await getPersonMatches(data);
        expect(results.matchedPersons.length).to.equal(4);
        expect(results.matchedPersons.every(res => res.type === DALTypes.PersonMatchType.STRONG)).to.be.true;
        const namesOfMatchingPersons = results.matchedPersons.map(item => item.personObject.fullName);
        expect(namesOfMatchingPersons).to.include('David I. Smith');
        expect(namesOfMatchingPersons).to.include('David Marcos');
        expect(namesOfMatchingPersons).to.include('Angie Devon');
        expect(namesOfMatchingPersons).to.include('David Beckham');
      });
    });
  });

  describe('given the search is performed by name, emails, and phones', () => {
    it('should return only the one found by email', async () => {
      data.body = {
        name: 'David Marcos',
        emails: ['davidmarcos@gmail.tech'],
        phones: {
          newPhoneNumbers: ['12025550300'],
        },
      };

      const results = await getPersonMatches(data);
      expect(results.matchedPersons.length).to.equal(1);
      expect(results.matchedPersons[0].personObject.fullName).to.equal('David Marcos');
    });
  });

  describe('given the search is performed by name and phone', () => {
    it('should return three weak matches and one strong match, also the first match should be "Beckham David"', async () => {
      data.body = {
        name: 'David',
        phones: {
          newPhoneNumbers: ['12025550333'],
        },
      };

      const results = await getPersonMatches(data);
      expect(results.matchedPersons.length).to.equal(4);
      expect(results.matchedPersons[0].personObject.fullName).to.equal('Beckham David');

      const weakMatches = getMatchesByType(results.matchedPersons, DALTypes.PersonMatchType.WEAK);
      const strongMatches = getMatchesByType(results.matchedPersons, DALTypes.PersonMatchType.STRONG);
      expect(weakMatches.length).to.equal(3);
      expect(strongMatches.length).to.equal(1);
    });
  });

  describe('given the search is performed by full name and phone', () => {
    it('should return one weak match and three strong matches, also the first match should be "David Beckham"', async () => {
      data.body = {
        name: 'David Beckham',
        phones: {
          newPhoneNumbers: ['12025550300'],
        },
      };

      const results = await getPersonMatches(data);
      expect(results.matchedPersons.length).to.equal(4);
      expect(results.matchedPersons[0].personObject.fullName).to.equal('David Beckham');
      expect(results.matchedPersons[1].personObject.fullName).to.equal('Beckham David');

      const weakMatches = getMatchesByType(results.matchedPersons, DALTypes.PersonMatchType.WEAK);
      const strongMatches = getMatchesByType(results.matchedPersons, DALTypes.PersonMatchType.STRONG);
      expect(weakMatches.length).to.equal(1);
      expect(strongMatches.length).to.equal(3);
    });
  });

  describe('given the search is performed by full name (case insensitive) and phone', () => {
    it('should return one weak match and three strong matches, also the first match should be "David Beckham" and a rank of 15', async () => {
      data.body = {
        name: 'daviD becKhaM',
        phones: {
          newPhoneNumbers: ['12025550300'],
        },
      };

      const results = await getPersonMatches(data);

      expect(results.matchedPersons.length).to.equal(4);
      expect(results.matchedPersons[0].personObject.fullName).to.equal('David Beckham');
      expect(results.matchedPersons[1].personObject.fullName).to.equal('Beckham David');

      expect(results.matchedPersons[0].rank).to.equal(15);
      expect(results.matchedPersons[1].rank).to.equal(10);

      const weakMatches = getMatchesByType(results.matchedPersons, DALTypes.PersonMatchType.WEAK);
      const strongMatches = getMatchesByType(results.matchedPersons, DALTypes.PersonMatchType.STRONG);
      expect(weakMatches.length).to.equal(1);
      expect(strongMatches.length).to.equal(3);
    });
  });

  describe('given the search is performed by full name (case insensitive) and phone for exact match results', () => {
    it('should return only strong matches with a rank of 15', async () => {
      data.body = {
        name: 'Russell Crowe',
        phones: {
          newPhoneNumbers: ['12025550111'],
        },
      };

      const results = await getPersonMatches(data);
      const fifteenRankMatches = getMatchesByRank(results.matchedPersons, 15);

      expect(results.matchedPersons.length).to.equal(4);
      expect(fifteenRankMatches.length).to.equal(4);
    });
  });
});
