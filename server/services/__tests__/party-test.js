/*
 * Copyright (c) 2022 Reva Technology Inc., all rights reserved.
 * Unauthorized copying of this file, via any medium is strictly prohibited
 * Licensed under the Elastic License 2.0; you may not use this file except
 * in compliance with the Elastic License 2.0.
 */

import { expect } from 'chai';
import getUUID from 'uuid/v4';
import * as sinon from 'sinon';
import htmlToPdf from 'html-pdf';
import temp from 'temp';
import { DALTypes } from '../../../common/enums/DALTypes';
import { deferred } from '../../../common/helpers/deferred';

const { mockModules } = require('../../../common/test-helpers/mocker').default(jest);

describe('services/party', () => {
  const info = [
    {
      breed: 'pomeranian',
      weight: '7.7 lbs',
      name: 'Waldo',
    },
    {
      breed: 'pomeranian',
      weight: '7.7 lbs',
      name: 'Sally',
    },
    {
      model: 'lexus',
      color: 'red',
    },
  ];

  const partyId = getUUID();

  const additionalInfo = [
    {
      id: getUUID(),
      partyId,
      type: 'pet',
      info: info[0],
    },
    {
      id: getUUID(),
      partyId,
      type: 'pet',
      info: info[1],
    },
    {
      id: getUUID(),
      partyId,
      type: 'car',
      info: info[2],
    },
  ];

  const tempFolderName = 'TempDir';
  const htmlString = '<div>Test</div>';
  const pdfFileName = 'test.pdf';

  const ctx = { tenantId: getUUID() };
  const newInfo = { breed: 'pomeranian', weight: '6 lbs', name: 'Suki' };

  let party;

  beforeEach(async () => {
    mockModules({
      '../../dal/partyRepo': {
        savePartyAdditionalInfo: sinon.stub().returns(additionalInfo),
        getPartyAdditionalInfo: sinon.stub().returns(additionalInfo[0]),
        updatePartyAdditionalInfo: sinon.stub().returns({ ...additionalInfo[0], info: newInfo }),
        removePartyAdditionalInfo: sinon.stub().returns({ ...additionalInfo[0], endDate: new Date() }),
        getAdditionalInfoByPartyAndType: sinon.stub().returns([{ ...additionalInfo[0] }, { ...additionalInfo[1] }]),
        getCollaboratorsForParties: jest.fn(() => []),
      },
      '../../dal/tasksRepo': {
        getUsersWithAssignedTasksForParties: jest.fn(() => []),
      },
      '../../services/partyEvent': {
        saveAllServiceAnimalsRemovedEvent: jest.fn(() => []),
        saveServiceAnimalAddedEvent: jest.fn(() => []),
      },
    });

    party = require('../party'); // eslint-disable-line global-require
    await party.savePartyAdditionalInfo(ctx, additionalInfo);
  });

  describe('calling getPartyAdditionalInfo service', () => {
    it('should get the indicated additional info', async () => {
      const result = await party.getPartyAdditionalInfo(ctx, additionalInfo[0].id);
      expect(result).to.deep.equal(additionalInfo[0]);
    });
  });

  describe('calling updatePartyAdditionalInfo service', () => {
    it('should update the indicated fields', async () => {
      const result = await party.updatePartyAdditionalInfo(ctx, additionalInfo[0].id, newInfo);
      expect(result.info.weight).to.equal(newInfo.weight);
      expect(result.info.name).to.equal(newInfo.name);
    });
  });

  describe('calling getAdditionalInfoByPartyAndType service', () => {
    it('should return all the additional info added in the Party_AdditionalInfo table by party and type', async () => {
      const result = await party.getAdditionalInfoByPartyAndType(ctx, partyId, 'pet');
      expect(result).to.have.lengthOf(2);
      expect(result[0]).to.deep.equal(additionalInfo[0]);
      expect(result[1]).to.deep.equal(additionalInfo[1]);
    });
  });

  describe('calling deletePartyAdditionalInfo service', () => {
    it('should delete the indicated additional info', async () => {
      const result = await party.deletePartyAdditionalInfo(ctx, additionalInfo[0].id, additionalInfo[0].partyId);
      expect(result.endDate).to.not.equal(null);
    });
  });

  describe('calling create function from htmlToPdf external library, this library has dependencies that could fail if they are no installed in the OS', () => {
    it('should create a simple pdf file from one html string', async () => {
      const dfd = deferred();

      temp.mkdir(tempFolderName, (err, dirPath) => {
        expect(err).to.equal(null);

        htmlToPdf.create(htmlString, {}).toFile(`${dirPath}/${pdfFileName}`, error => {
          expect(error).to.equal(null);
          temp.cleanupSync();
          dfd.resolve();
        });
      });

      await dfd;
    }, 10000);
  });
});

describe('services/mergeParties', () => {
  let partyHelper;

  beforeEach(async () => {
    partyHelper = require('../helpers/party'); // eslint-disable-line global-require
  });

  describe('when the input list contains two parties in these states: RESIDENT, CONTACT', () => {
    it('should return a list sorted in this order: RESIDENT, CONTACT', () => {
      const parties = [
        {
          party: {
            id: 'party-1-id',
            state: DALTypes.PartyStateType.RESIDENT,
            created_at: '12-14-2016T16:30:00Z',
          },
        },
        {
          party: {
            id: 'party-2-id',
            state: DALTypes.PartyStateType.CONTACT,
            created_at: '12-14-2016T17:30:00Z',
          },
        },
      ];

      const sortedParties = partyHelper.sortPartiesForMerge(parties);
      expect(sortedParties.map(p => p.party.state)).to.deep.equal([DALTypes.PartyStateType.RESIDENT, DALTypes.PartyStateType.CONTACT]);
    });
  });

  describe('when the input list contains two parties in these states: CONTACT, RESIDENT', () => {
    it('should return a list sorted in this order: RESIDENT, CONTACT', () => {
      const parties = [
        {
          party: {
            id: 'party-1-id',
            state: DALTypes.PartyStateType.CONTACT,
            created_at: '12-14-2016T16:30:00Z',
          },
        },
        {
          party: {
            id: 'party-2-id',
            state: DALTypes.PartyStateType.RESIDENT,
            created_at: '12-14-2016T17:30:00Z',
          },
        },
      ];

      const sortedParties = partyHelper.sortPartiesForMerge(parties);
      expect(sortedParties.map(p => p.party.state)).to.deep.equal([DALTypes.PartyStateType.RESIDENT, DALTypes.PartyStateType.CONTACT]);
    });
  });

  describe('when the input list contains two parties in these states: RESIDENT, RESIDENT', () => {
    it('should return a list sorted by updated_at desc', () => {
      const parties = [
        {
          party: {
            id: 'party-1-id',
            state: DALTypes.PartyStateType.RESIDENT,
            updated_at: '2016-12-14T15:30:00Z',
          },
        },
        {
          party: {
            id: 'party-2-id',
            state: DALTypes.PartyStateType.RESIDENT,
            updated_at: '2016-12-15T15:30:00Z',
          },
        },
      ];

      const sortedParties = partyHelper.sortPartiesForMerge(parties);
      expect(sortedParties.map(p => p.party.id)).to.deep.equal(['party-2-id', 'party-1-id']);
    });
  });

  describe('when the input list contains two parties: one has application payment, one does not', () => {
    it('should return a list sorted: first the party with payment, then party with no payment ', () => {
      // TODO: check this test as it seems it is not doing what it is expected
      // the payment does not seems to be taken into consideration
      const parties = [
        {
          party: {
            id: 'party-1-id',
            state: DALTypes.PartyStateType.APPLICANT,
            updated_at: '2016-12-14T15:30:00Z',
          },
        },
        {
          party: {
            id: 'party-2-id',
            state: DALTypes.PartyStateType.APPLICANT,
            updated_at: '2016-12-14T15:30:00Z',
          },
          applicationPayments: {
            personApplications: [
              {
                paymentCompleted: true,
              },
            ],
          },
        },
      ];

      const sortedParties = partyHelper.sortPartiesForMerge(parties);
      expect(sortedParties.map(p => p.party.id)).to.deep.equal(['party-2-id', 'party-1-id']);
    });
  });

  describe('when the input list contains two parties: both parties have payments, both same party state', () => {
    it('should return a list sorted by upated_at, desc', () => {
      const parties = [
        {
          party: {
            id: 'party-1-id',
            state: DALTypes.PartyStateType.APPLICANT,
            updated_at: '2016-12-14T15:30:00Z',
          },
          applicationPayments: {
            personApplications: [
              {
                paymentCompleted: true,
              },
            ],
          },
        },
        {
          party: {
            id: 'party-2-id',
            state: DALTypes.PartyStateType.APPLICANT,
            updated_at: '2016-12-15T15:30:00Z',
          },
          applicationPayments: {
            personApplications: [
              {
                paymentCompleted: true,
              },
            ],
          },
        },
      ];

      const sortedParties = partyHelper.sortPartiesForMerge(parties);
      expect(sortedParties.map(p => p.party.id)).to.deep.equal(['party-2-id', 'party-1-id']);
    });
  });

  describe('when the input list contains two parties: one party has completed appointments, one does not', () => {
    it('should return a list sorted by completed appointments first, regardless of updated_at', () => {
      const parties = [
        {
          party: {
            id: 'party-1-id',
            state: DALTypes.PartyStateType.APPLICANT,
            updated_at: '2016-12-14T16:30:00Z',
          },
          tasks: [
            {
              name: 'APPOINTMENT',
              state: 'Completed',
            },
          ],
        },
        {
          party: {
            id: 'party-2-id',
            state: DALTypes.PartyStateType.APPLICANT,
            updated_at: '2016-12-14T16:30:00Z',
          },
        },
      ];

      const sortedParties = partyHelper.sortPartiesForMerge(parties);
      expect(sortedParties.map(p => p.party.id)).to.deep.equal(['party-1-id', 'party-2-id']);
    });
  });

  describe('when the input list contains two parties: both have completed appointments, one in state PROSPECT, one in state APPLICANT', () => {
    it('should return a list sorted by party state: APPLICANT, then PROSPECT', () => {
      const parties = [
        {
          party: {
            id: 'party-1-id',
            state: DALTypes.PartyStateType.PROSPECT,
            updated_at: '2016-12-14T16:30:00Z',
          },
          tasks: [
            {
              name: 'APPOINTMENT',
              state: 'Completed',
            },
          ],
        },
        {
          party: {
            id: 'party-2-id',
            state: DALTypes.PartyStateType.APPLICANT,
            updated_at: '2016-12-14T16:30:00Z',
          },
          tasks: [
            {
              name: 'APPOINTMENT',
              state: 'Completed',
            },
          ],
        },
      ];

      const sortedParties = partyHelper.sortPartiesForMerge(parties);
      expect(sortedParties.map(p => p.party.id)).to.deep.equal(['party-2-id', 'party-1-id']);
    });
  });

  describe('when the input list contains two parties: both have completed appointments, both same state PROSPECT', () => {
    it('should return a list sorted by updated_at, desc', () => {
      const parties = [
        {
          party: {
            id: 'party-1-id',
            state: DALTypes.PartyStateType.PROSPECT,
            updated_at: '2016-12-14T16:30:00Z',
          },
          tasks: [
            {
              name: 'APPOINTMENT',
              state: 'Completed',
            },
          ],
        },
        {
          party: {
            id: 'party-2-id',
            state: DALTypes.PartyStateType.PROSPECT,
            updated_at: '2016-12-15T15:30:00Z',
          },
          tasks: [
            {
              name: 'APPOINTMENT',
              state: 'Completed',
            },
          ],
        },
      ];

      const sortedParties = partyHelper.sortPartiesForMerge(parties);
      expect(sortedParties.map(p => p.party.id)).to.deep.equal(['party-2-id', 'party-1-id']);
    });
  });

  describe('when the input list contains two parties: one is a newLease workflow with completed appointments, the other one is an activeLease', () => {
    it('should return a list sorted by active lease first', () => {
      const parties = [
        {
          party: {
            id: 'party-1-id',
            state: DALTypes.PartyStateType.PROSPECT,
            updated_at: '2016-12-14T16:30:00Z',
            workflowName: 'newLease',
          },
          tasks: [
            {
              name: 'APPOINTMENT',
              state: 'Completed',
            },
          ],
        },
        {
          party: {
            id: 'party-2-id',
            state: DALTypes.PartyStateType.RESIDENT,
            updated_at: '2016-12-15T15:30:00Z',
            workflowName: 'activeLease',
          },
        },
      ];

      const sortedParties = partyHelper.sortPartiesForMerge(parties);
      expect(sortedParties.map(p => p.party.id)).to.deep.equal(['party-2-id', 'party-1-id']);
    });
  });

  describe('when the input list contains two parties: one is a newLease workflow with completed appointments and application payment, the other one is an activeLease', () => {
    it('should return a list sorted by active lease first', () => {
      const parties = [
        {
          party: {
            id: 'party-1-id',
            state: DALTypes.PartyStateType.APPLICANT,
            updated_at: '2016-12-14T16:30:00Z',
            workflowName: 'newLease',
          },
          tasks: [
            {
              name: 'APPOINTMENT',
              state: 'Completed',
            },
          ],
          applicationPayments: {
            personApplications: [
              {
                paymentCompleted: true,
              },
            ],
          },
        },
        {
          party: {
            id: 'party-2-id',
            state: DALTypes.PartyStateType.RESIDENT,
            updated_at: '2016-12-15T15:30:00Z',
            workflowName: 'activeLease',
          },
        },
      ];

      const sortedParties = partyHelper.sortPartiesForMerge(parties);
      expect(sortedParties.map(p => p.party.id)).to.deep.equal(['party-2-id', 'party-1-id']);
    });
  });

  describe('when the input list contains two parties: one is a newLease workflow with completed appointments and application payment, the other one is an renewal ', () => {
    it('should return a list sorted by renewal first', () => {
      const parties = [
        {
          party: {
            id: 'party-1-id',
            state: DALTypes.PartyStateType.APPLICANT,
            updated_at: '2016-12-14T16:30:00Z',
            workflowName: 'newLease',
          },
          tasks: [
            {
              name: 'APPOINTMENT',
              state: 'Completed',
            },
          ],
          applicationPayments: {
            personApplications: [
              {
                paymentCompleted: true,
              },
            ],
          },
        },
        {
          party: {
            id: 'party-2-id',
            state: DALTypes.PartyStateType.PROSPECT,
            updated_at: '2016-12-15T15:30:00Z',
            workflowName: 'renewal',
          },
        },
      ];

      const sortedParties = partyHelper.sortPartiesForMerge(parties);
      expect(sortedParties.map(p => p.party.id)).to.deep.equal(['party-2-id', 'party-1-id']);
    });
  });
});
