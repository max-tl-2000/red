/*
 * Copyright (c) 2022 Reva Technology Inc., all rights reserved.
 * Unauthorized copying of this file, via any medium is strictly prohibited
 * Licensed under the Elastic License 2.0; you may not use this file except
 * in compliance with the Elastic License 2.0.
 */

import { expect } from 'chai';
import v4 from 'uuid/v4';
import { editUnpredictable } from '../enable-snapshot';
import { now } from '../../helpers/moment-utils';

// NOTE: This file is an example of how to use snapshot testing in mocha
// at the same time it also shows how to ignore the fields that usually change
// like GUIDs and DateTime fields. In order to be able to use snapshot testing
// with objects that have fields that cannot be predicted we can use the
// editUnpredictable helper. By default

describe('enable-snapshot', () => {
  it('should edit guid fields', () => {
    const res = editUnpredictable({
      guid: v4(),
      id: v4(),
      nonId: 123,
      normal: 'Simple and normal',
    });

    expect(res).to.matchSnapshot();
  });

  it('should edit date fields', () => {
    const res = editUnpredictable({
      startDate: now().toDate(),
      nonId: 123,
      normal: 'Simple and normal',
    });

    expect(res).to.matchSnapshot();
  });

  it('should edit date string fields', () => {
    const res = editUnpredictable({
      startDate: '2017-08-24T23:20:55.745Z',
      nonId: 1213,
      normal: 'Simple and normal',
    });
    expect(res).to.matchSnapshot();
  });

  it('should edit created_at and updated_at fields', () => {
    const res = editUnpredictable({
      created_at: '2017-08-24T23:20:55.745Z',
      nonId: 1213,
      normal: 'Simple and normal',
      updated_at: '2017-08-24T23:20:55.745Z',
    });
    expect(res).to.matchSnapshot();
  });

  it('should edit guid values in arrays', () => {
    const obj = { teams: [v4(), v4()], nonEditable: 'nonEditable' };
    const res = editUnpredictable(obj);
    expect(res).to.matchSnapshot();
  });

  it('should process a nested structure', () => {
    const obj = [
      {
        created_at: '2017-08-24T20:16:22.657Z',
        updated_at: '2017-08-24T20:16:22.657Z',
        id: '9d44bc56-80ec-4ac6-97c5-1b6024ec9ab2',
        state: 'Contact',
        storedUnitsFilters: {
          moveInDate: {
            max: '2017-10-24',
            min: '2017-09-24',
          },
          numBedrooms: ['TWO_BEDS'],
        },
        userId: '34012577-fd09-43ef-a321-78a15ac45190',
        metadata: {
          source: '',
          programId: '',
          propertyId: '',
          creationType: 'system',
          residentInfo: {},
          firstContactedDate: '2017-08-24T20:16:22.657Z',
          firstContactChannel: 'Email',
          qualQuestionsCompleted: '2017-08-24T20:16:22+00:00',
          leadFromExistingResident: false,
        },
        score: 'prospect',
        qualificationQuestions: {
          moveInTime: 'NEXT_2_MONTHS',
          numBedrooms: ['TWO_BEDS'],
        },
        teams: ['a71fe18a-8ef1-4bda-8c61-44e96856c542'],
        collaborators: [],
        assignedPropertyId: null,
        startDate: '2017-08-24T20:16:22.524Z',
        endDate: null,
        ownerTeam: 'a71fe18a-8ef1-4bda-8c61-44e96856c542',
        partyMembers: [
          {
            created_at: '2017-08-24T20:16:22.696Z',
            updated_at: '2017-08-24T20:16:22.696Z',
            id: '5c4cf211-1c89-430d-ba9a-12111f7f985d',
            partyId: '9d44bc56-80ec-4ac6-97c5-1b6024ec9ab2',
            memberState: 'Contact',
            memberType: 'Resident',
            personId: 'da30b5fa-755b-4094-bf9c-59d6bf376b7c',
            isSpam: false,
            guaranteedBy: null,
            endDate: null,
            startDate: '2017-08-24T20:16:22.524Z',
            fullName: 'Lois Lane',
            preferredName: 'Lois',
            dob: null,
            contactInfo: {
              defaultPhone: '15109444422',
              defaultPhoneId: 'b8c5ef45-cc8e-4029-bb65-33e4dba4912d',
              defaultEmail: 'lois.reports@gmail.com',
              defaultEmailId: '43f901f1-479d-47f9-8537-151c3f44c9ee',
              phones: [
                {
                  id: 'b8c5ef45-cc8e-4029-bb65-33e4dba4912d',
                  type: 'phone',
                  value: '15109444422',
                  isPrimary: true,
                  metadata: {
                    sms: true,
                  },
                  personId: 'da30b5fa-755b-4094-bf9c-59d6bf376b7c',
                  isSpam: false,
                },
              ],
              emails: [
                {
                  id: '43f901f1-479d-47f9-8537-151c3f44c9ee',
                  type: 'email',
                  value: 'lois.reports@gmail.com',
                  isPrimary: true,
                  metadata: {},
                  personId: 'da30b5fa-755b-4094-bf9c-59d6bf376b7c',
                  isSpam: false,
                },
              ],
              isSpam: false,
              all: [
                {
                  id: 'b8c5ef45-cc8e-4029-bb65-33e4dba4912d',
                  type: 'phone',
                  value: '15109444422',
                  isPrimary: true,
                  metadata: {
                    sms: true,
                  },
                  personId: 'da30b5fa-755b-4094-bf9c-59d6bf376b7c',
                  isSpam: false,
                },
                {
                  id: '43f901f1-479d-47f9-8537-151c3f44c9ee',
                  type: 'email',
                  value: 'lois.reports@gmail.com',
                  isPrimary: true,
                  metadata: {},
                  personId: 'da30b5fa-755b-4094-bf9c-59d6bf376b7c',
                  isSpam: false,
                },
              ],
            },
          },
        ],
      },
    ];

    const res = editUnpredictable(obj);
    expect(res).to.matchSnapshot();
  });

  it('should ignore other fields set using the ignore prop', () => {
    const structure = {
      teams: 'some field that will be ignored',
      data: [{ toIgnore: 'this should be ignored', notIgnored: 'not to be ignored' }],
    };

    const res = editUnpredictable(structure, { ignore: ['teams', 'toIgnore'] });
    expect(res).to.matchSnapshot();
  });
});
