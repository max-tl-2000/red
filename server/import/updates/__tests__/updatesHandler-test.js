/*
 * Copyright (c) 2022 Reva Technology Inc., all rights reserved.
 * Unauthorized copying of this file, via any medium is strictly prohibited
 * Licensed under the Elastic License 2.0; you may not use this file except
 * in compliance with the Elastic License 2.0.
 */

import newId from 'uuid/v4';
import chai from 'chai';
import chaiAsPromised from 'chai-as-promised';
import { DALTypes } from '../../../../common/enums/DALTypes';
import { DATE_US_FORMAT, LA_TIMEZONE } from '../../../../common/date-constants';
import { now, parseAsInTimezone } from '../../../../common/helpers/moment-utils';
import { parsePersonFromProspect } from '../prospectUpdatesHandler';

const { mockModules } = require('../../../../common/test-helpers/mocker').default(jest);

chai.use(chaiAsPromised);
chai.config.truncateThreshold = 0;

const { expect } = chai;
const property = [
  {
    id: 'YYY',
    timezone: LA_TIMEZONE,
    settings: { integration: { import: { inventoryAvailabilityDate: DALTypes.AvailabilityDateSourceType.REVA } } },
  },
];
const propertiesToUpdateFromDB = [
  {
    name: 'cove',
    externalId: 'cove',
  },
];

describe('updatesHandler', () => {
  const tenantId = newId();
  const timezone = LA_TIMEZONE;

  describe('updateInventory', () => {
    let updateInventory;
    const inventory = {
      'cove-boat-22': {
        id: newId(),
        propertyId: 'YYY',
        state: DALTypes.InventoryState.MODEL,
        startDate: '03/30/2015',
        externalId: 'boat-22',
        availabilityDate: '02/02/2016',
      },
      'cove-boat-23': {
        id: newId(),
        propertyId: 'YYY',
        state: DALTypes.InventoryState.MODEL,
        startDate: '03/30/2015',
        externalId: 'boat-23',
        availabilityDate: '02/02/2016',
      },
      'cove-boat-24': {
        id: newId(),
        propertyId: 'YYY',
        state: DALTypes.InventoryState.MODEL,
        startDate: '03/30/2015',
        externalId: 'boat-24',
        availabilityDate: '02/02/2016',
      },
      'cove-boat-25': {
        id: newId(),
        propertyId: 'YYY',
        state: DALTypes.InventoryState.MODEL,
        startDate: '03/30/2015',
        externalId: 'boat-25',
        availabilityDate: '02/02/2016',
      },
    };

    const previous = [
      ['cove-boat-22', 'cove', 'boat-22', DALTypes.InventoryState.VACANT_READY, '03/30/2015', '02/02/2016'],
      ['cove-boat-23', 'cove', 'boat-23', DALTypes.InventoryState.VACANT_READY, '03/30/2015', '02/02/2016'],
      ['cove-boat-24', 'cove', 'boat-24', DALTypes.InventoryState.VACANT_READY, '03/30/2015', '02/02/2016'],
      ['cove-boat-25', 'cove', 'boat-25', DALTypes.InventoryState.OCCUPIED, '03/30/2015', '02/02/2016'],
    ];
    const actual = [
      ['cove-boat-22', 'cove', 'boat-22', DALTypes.InventoryState.OCCUPIED_NOTICE_RESERVED, '04/30/2015', '02/05/2016'],
      ['cove-boat-23', 'cove', 'boat-23', DALTypes.InventoryState.OCCUPIED, '04/30/2015', '04/02/2016'],
      ['cove-boat-24', 'cove', 'boat-24', DALTypes.InventoryState.VACANT_READY, '03/30/2015', '07/02/2016'],
    ];

    const headers = ['computedExternalId', 'property', 'unitCode', 'state', 'startDate', 'availabilityDate'];

    const defaultMocks = () => ({
      getInventoryByExternalId: jest.fn(),
      updateInventory: jest.fn(),
      getInventoriesByExternalId: jest.fn(() => inventory),
      getInventoriesByComputedExternalId: jest.fn(() => inventory),
      bulkUpsertInventories: jest.fn(),
      getPropertySettingsAndTimezone: jest.fn(() => property),
      getPropertiesToUpdateFromDB: jest.fn(() => propertiesToUpdateFromDB),
      getTenant: jest.fn(evt => ({ id: evt, metadata: { backendIntegration: { name: DALTypes.BackendMode.YARDI } } })),
    });

    const setupMocks = mocks => {
      jest.resetModules();
      mockModules({
        '../../../dal/inventoryRepo': {
          getInventoryByExternalId: mocks.getInventoryByExternalId,
          updateInventory: mocks.updateInventory,
          getInventoriesByExternalId: mocks.getInventoriesByExternalId,
          getInventoriesByComputedExternalId: mocks.getInventoriesByComputedExternalId,
          bulkUpsertInventories: mocks.bulkUpsertInventories,
        },
        '../../../dal/propertyRepo': {
          getPropertySettingsAndTimezone: mocks.getPropertySettingsAndTimezone,
          getPropertiesToUpdateFromDB: mocks.getPropertiesToUpdateFromDB,
        },
        '../../../services/tenantService': {
          getTenant: mocks.getTenant,
        },
      });
      const updatesHandler = require('../updatesHandler'); // eslint-disable-line global-require
      updateInventory = updatesHandler.updateInventory;
    };

    let mocks;

    it('should call updateInventory 3 times when there is no previous values and set to null the availabilityDate', async () => {
      mocks = defaultMocks();
      setupMocks(mocks);

      await updateInventory({ tenantId }, actual, null, headers);
      expect(mocks.bulkUpsertInventories.mock.calls.length).to.equal(1);
      expect(mocks.bulkUpsertInventories.mock.calls[0][1][0]).to.eql({
        ...inventory['cove-boat-22'],
        state: DALTypes.InventoryState.OCCUPIED_NOTICE_RESERVED,
        stateStartDate: parseAsInTimezone('04/30/2015', { format: DATE_US_FORMAT, timezone }).toJSON(),
        availabilityDate: null,
      });
      expect(mocks.bulkUpsertInventories.mock.calls[0][1][1]).to.eql({
        ...inventory['cove-boat-23'],
        state: DALTypes.InventoryState.OCCUPIED,
        stateStartDate: parseAsInTimezone('04/30/2015', { format: DATE_US_FORMAT, timezone }).toJSON(),
        availabilityDate: null,
      });
      expect(mocks.bulkUpsertInventories.mock.calls[0][1][2]).to.eql({
        ...inventory['cove-boat-24'],
        state: DALTypes.InventoryState.VACANT_READY,
        stateStartDate: parseAsInTimezone('03/30/2015', { format: DATE_US_FORMAT, timezone }).toJSON(),
        availabilityDate: null,
      });
    });

    it('should call updateInventory 2 times when there is no previous values and previous status doesnt change', async () => {
      mocks = {
        ...defaultMocks(),
        getInventoriesByComputedExternalId: jest.fn(() => ({
          ...inventory,
          'cove-boat-23': {
            ...inventory['cove-boat-23'],
            state: DALTypes.InventoryState.OCCUPIED,
          },
        })),
      };
      setupMocks(mocks);

      await updateInventory({ tenantId }, actual, null, headers);

      expect(mocks.bulkUpsertInventories.mock.calls.length).to.equal(1);
    });

    it('should call updateInventory 2 times when there is previous values and set to null the availabilityDate', async () => {
      mocks = defaultMocks();
      setupMocks(mocks);

      await updateInventory({ tenantId }, actual, previous, headers);

      expect(mocks.bulkUpsertInventories.mock.calls.length).to.equal(1);
      expect(mocks.bulkUpsertInventories.mock.calls[0][1][0]).to.eql({
        ...inventory['cove-boat-22'],
        state: DALTypes.InventoryState.OCCUPIED_NOTICE_RESERVED,
        stateStartDate: parseAsInTimezone('04/30/2015', { format: DATE_US_FORMAT, timezone }).toJSON(),
        availabilityDate: null,
      });
      expect(mocks.bulkUpsertInventories.mock.calls[0][1][1]).to.eql({
        ...inventory['cove-boat-23'],
        state: DALTypes.InventoryState.OCCUPIED,
        stateStartDate: parseAsInTimezone('04/30/2015', { format: DATE_US_FORMAT, timezone }).toJSON(),
        availabilityDate: null,
      });
    });
  });

  describe('updateResidents', () => {
    let updateResidents;
    const party = { id: newId(), state: DALTypes.PartyStateType.RESIDENT };
    const partyMember = {
      id: newId(),
      memberType: DALTypes.MemberType.RESIDENT,
    };
    const previous = [
      ['lark', 'tl079949', '100-0101', 'Robert', 'Duncan', 'rob@wearemucho.com', '', '4157067869', DALTypes.PartyStateType.RESIDENT, '1', ''],
      ['lark', 'tl790695', '100-0102', 'Michael', 'Wittenberg', 'wittenbergmichael@gmail.com', '', '4158468052', DALTypes.PartyStateType.PASTRESIDENT, '1', ''],
      ['lark', 't0812749', '100-0101', 'Dipan', 'Mann', 'dipanmann@yahoo.com', '(415)533-7102', '', DALTypes.PartyStateType.PASTRESIDENT, '1', ''],
    ];
    const actual = [
      ['lark', 'tl079949', '100-0101', 'Robert', 'Duncan', 'rob@wearemucho.com', '', '4157067869', DALTypes.PartyStateType.RESIDENT, '1', '123'],
      ['lark', 'tl790695', '100-0102', 'Michael', 'Wittenberg', 'wittenbergmichael@gmail.com', '', '4158468052', DALTypes.PartyStateType.PASTRESIDENT, '1', ''],
      ['lark', 't0812749', '100-0101', 'Dipan', 'Mann', 'dipanmann@yahoo.com', '(415)533-7103', '', DALTypes.PartyStateType.PASTRESIDENT, '1', ''],
      ['lark', 'tl079999', '100-0101', 'Harry', 'Potter', 'harry@potter.com', '', '4157067869', DALTypes.PartyStateType.RESIDENT, '1', ''],
    ];

    const headers = [
      'property',
      'tenantCode', // party
      'unitCode',
      'firstName',
      'lastName',
      'email',
      'cellPhoneNumber',
      'phoneNumber',
      'partyStatus',
      'dueDay',
      'prospectCode',
    ];

    const defaultMocks = () => ({
      createParty: jest.fn(() => ({ ...party })),
      createPerson: jest.fn(() => ({ id: newId() })),
      createPartyMember: jest.fn(),
      getPartyMemberByEmailAddress: jest.fn(() => [{ ...partyMember }]),
      updatePartyMember: jest.fn(),
      loadPartiesByIds: jest.fn(),
      updateParty: jest.fn(),
      getPartyMembersByExternalIds: jest.fn(() => [{ ...partyMember }]),
    });

    const setupMocks = mocks => {
      jest.resetModules();
      mockModules({
        '../../../dal/partyRepo': {
          createParty: mocks.createParty,
          createPartyMember: mocks.createPartyMember,
          getPartyMemberByEmailAddress: mocks.getPartyMemberByEmailAddress,
          updatePartyMember: mocks.updatePartyMember,
          loadPartiesByIds: mocks.loadPartiesByIds,
          updateParty: mocks.updateParty,
          getPartyMembersByExternalIds: mocks.getPartyMembersByExternalIds,
        },
        '../../../dal/personRepo.js': {
          createPerson: mocks.createPerson,
        },
      });
      const updatesHandler = require('../updatesHandler'); // eslint-disable-line global-require
      updateResidents = updatesHandler.updateResidents;
    };

    let mocks;
    it('should call updateResidents 1 times when there is previous values', async () => {
      mocks = defaultMocks();
      setupMocks(mocks);

      await updateResidents({ tenantId }, actual, previous, headers);
      expect(mocks.createParty.mock.calls.length).to.equal(1);
    });

    it('should call createPartyMember, createPartyMember, getPartyMemberByEmailAddress, updatePartyMember 1 time when there is no previous values', async () => {
      mocks = defaultMocks();
      setupMocks(mocks);

      await updateResidents({ tenantId }, actual, null, headers);

      expect(mocks.createParty.mock.calls.length).to.equal(1);
      expect(mocks.createPartyMember.mock.calls.length).to.equal(1);
      expect(mocks.getPartyMemberByEmailAddress.mock.calls.length).to.equal(1);
    });
  });

  describe('updateRoommates', () => {
    let updateRoommates;
    const party = { id: newId(), state: DALTypes.PartyStateType.RESIDENT };
    const partyMember = {
      id: newId(),
      memberType: DALTypes.MemberType.RESIDENT,
      partyId: party.id,
    };
    const previous = [
      ['t0000011', 'lark', 'Simon', 'Bain', 'sibain@simplexo.com', '', '(917) 292-0751', '0', '0', '', 'r0000128'],
      ['t0000011', 'lark', 'Deborah', 'Bain', 'debs@tendotzero.com', '', '', '0', '0', '', 'r0000129'],
      ['t0000013', 'lark', 'Chad', 'Beutler', 'chadbeutler@sbcglobal.net', '', '(916) 224-0474', '0', '1', '', 'r0000133'],
    ];
    const actual = [
      ['t0000011', 'lark', 'Simon', 'Bain', 'sibain@simplexo.com', '', '(917) 292-0751', '0', '0', '', 'r0000128'],
      ['t0000011', 'lark', 'Deborah', 'Bain', 'debs@tendotzero.com', '', '', '0', '0', '', 'r0000129'],
      ['t0000013', 'lark', 'Chad', 'Beutler', 'chadbeutler@sbcglobal.net', '', '(916) 224-0474', '0', '1', '', 'r0000133'],
      ['t0000015', 'lark', 'Janice', 'Krupa', 'tckrupa@yahoo.com', '', '5704728648', '1', '0', '', 'r0000134'],
    ];

    const headers = [
      'tenantCode', // party
      'property',
      'firstName',
      'lastName',
      'email',
      'cellPhoneNumber',
      'phoneNumber',
      'child',
      'occupant',
      'moveOutDate',
      'roommateCode',
    ];

    const defaultMocks = () => ({
      createParty: jest.fn(() => ({ ...party })),
      createPerson: jest.fn(() => ({ id: newId() })),
      createPartyMember: jest.fn(),
      getPartyMemberByEmailAddress: jest.fn(() => ({ ...partyMember })),
      updatePartyMember: jest.fn(),
      loadPartiesByIds: jest.fn(),
      updateParty: jest.fn(),
      getPartyMembersByExternalIds: jest.fn((ctx, externalIds) => externalIds.map(externalId => ({ ...partyMember, externalId }))),
    });

    const setupMocks = mocks => {
      jest.resetModules();
      mockModules({
        '../../../dal/partyRepo': {
          createParty: mocks.createParty,
          createPartyMember: mocks.createPartyMember,
          getPartyMemberByEmailAddress: mocks.getPartyMemberByEmailAddress,
          updatePartyMember: mocks.updatePartyMember,
          loadPartiesByIds: mocks.loadPartiesByIds,
          updateParty: mocks.updateParty,
          getPartyMembersByExternalIds: mocks.getPartyMembersByExternalIds,
        },
        '../../../dal/personRepo.js': {
          createPerson: mocks.createPerson,
        },
      });
      const updatesHandler = require('../updatesHandler'); // eslint-disable-line global-require
      updateRoommates = updatesHandler.updateRoommates;
    };

    let mocks;
    it('should not call updatePartyMember and createPartyMember when there is not rows to update/insert', async () => {
      mocks = defaultMocks();
      setupMocks(mocks);

      await updateRoommates({ tenantId }, actual, previous, headers);
      expect(mocks.getPartyMembersByExternalIds.mock.calls.length).to.equal(2);
      expect(mocks.getPartyMembersByExternalIds.mock.calls[0][0]).to.eql({
        tenantId,
      });
      expect(mocks.getPartyMembersByExternalIds.mock.calls[0][1]).to.eql(['t0000015']);
      expect(mocks.getPartyMembersByExternalIds.mock.calls[1][1]).to.eql(['r0000134']);

      expect(mocks.updatePartyMember.mock.calls.length).to.equal(0);
      expect(mocks.createPartyMember.mock.calls.length).to.equal(0);
    });

    it('should call createPartyMember when there is rows to insert', async () => {
      mocks = {
        ...defaultMocks(),
        getPartyMembersByExternalIds: jest
          .fn()
          .mockImplementationOnce((ctx, externalIds) => externalIds.map(externalId => ({ ...partyMember, externalId })))
          .mockImplementationOnce(() => []),
        getPartyMemberByEmailAddress: jest.fn(),
      };
      setupMocks(mocks);

      await updateRoommates({ tenantId }, actual, previous, headers);

      expect(mocks.getPartyMembersByExternalIds.mock.calls.length).to.equal(2);
      expect(mocks.getPartyMembersByExternalIds.mock.calls[0][0]).to.eql({
        tenantId,
      });
      expect(mocks.getPartyMembersByExternalIds.mock.calls[0][1]).to.eql(['t0000015']);
      expect(mocks.getPartyMembersByExternalIds.mock.calls[1][1]).to.eql(['r0000134']);

      expect(mocks.getPartyMemberByEmailAddress.mock.calls.length).to.equal(1);
      expect(mocks.getPartyMemberByEmailAddress.mock.calls[0][0]).to.eql({
        tenantId,
      });
      expect(mocks.getPartyMemberByEmailAddress.mock.calls[0][1]).to.eql('tckrupa@yahoo.com');

      expect(mocks.createParty.mock.calls.length).to.equal(0);

      expect(mocks.updatePartyMember.mock.calls.length).to.equal(0);

      expect(mocks.createPartyMember.mock.calls.length).to.equal(1);
      expect(mocks.createPartyMember.mock.calls[0][0]).to.eql({ tenantId });
      expect(mocks.createPartyMember.mock.calls[0][1].fullName).to.equal('Janice Krupa');
      expect(mocks.createPartyMember.mock.calls[0][1].preferredName).to.equal('Janice');
      expect(mocks.createPartyMember.mock.calls[0][1].memberType).to.equal('Occupant');
      expect(mocks.createPartyMember.mock.calls[0][2]).to.eql(party.id);
    });

    it('should call updatePartyMember when there is rows to update', async () => {
      mocks = {
        ...defaultMocks(),
        getPartyMembersByExternalIds: jest
          .fn()
          .mockImplementationOnce((ctx, externalIds) => externalIds.map(externalId => ({ ...partyMember, externalId })))
          .mockImplementationOnce(() => []),
        getPartyMemberByEmailAddress: jest.fn(() => ({
          ...partyMember,
          contactInfo: { defaultEmail: 'tckrupa@yahoo.com' },
        })),
      };
      setupMocks(mocks);

      await updateRoommates({ tenantId }, actual, previous, headers);

      expect(mocks.getPartyMembersByExternalIds.mock.calls.length).to.equal(2);
      expect(mocks.getPartyMembersByExternalIds.mock.calls[0][0]).to.eql({
        tenantId,
      });
      expect(mocks.getPartyMembersByExternalIds.mock.calls[0][1]).to.eql(['t0000015']);
      expect(mocks.getPartyMembersByExternalIds.mock.calls[1][1]).to.eql(['r0000134']);

      expect(mocks.getPartyMemberByEmailAddress.mock.calls.length).to.equal(1);
      expect(mocks.getPartyMemberByEmailAddress.mock.calls[0][0]).to.eql({
        tenantId,
      });
      expect(mocks.getPartyMemberByEmailAddress.mock.calls[0][1]).to.eql('tckrupa@yahoo.com');

      expect(mocks.createParty.mock.calls.length).to.equal(0);

      expect(mocks.createPartyMember.mock.calls.length).to.equal(0);

      expect(mocks.updatePartyMember.mock.calls.length).to.equal(1);
      expect(mocks.updatePartyMember.mock.calls[0][0]).to.eql({ tenantId });
      expect(mocks.updatePartyMember.mock.calls[0][1]).to.eql(partyMember.id);
      expect(mocks.updatePartyMember.mock.calls[0][2].externalId).to.equal('r0000134');
    });
  });

  describe('updateMriUnitStatus', () => {
    let updateInventory;
    const fakeCurrentTime = now({ timezone }).startOf('day');
    const inventory = {
      '11190-1-101': {
        id: newId(),
        propertyId: 'YYY',
        state: DALTypes.InventoryState.MODEL,
        stateStartDate: fakeCurrentTime.toJSON(),
        externalId: '11190-1-101',
        availabilityDate: '02/05/2018',
      },
      '11500-2-102': {
        id: newId(),
        propertyId: 'YYY',
        state: DALTypes.InventoryState.MODEL,
        stateStartDate: fakeCurrentTime.toJSON(),
        externalId: '11500-2-102',
        availabilityDate: '02/05/2018',
      },
      '12982-3-103': {
        id: newId(),
        propertyId: 'YYY',
        state: DALTypes.InventoryState.MODEL,
        stateStartDate: fakeCurrentTime.toJSON(),
        externalId: '12982-3-103',
        availabilityDate: '02/05/2018',
      },
    };
    const previous = [
      ['11190-1-101', DALTypes.InventoryState.VACANT_READY],
      ['11500-2-102', DALTypes.InventoryState.VACANT_READY],
      ['12982-3-103', DALTypes.InventoryState.VACANT_READY],
    ];
    const actual = [
      ['11190-1-101', DALTypes.InventoryState.OCCUPIED_NOTICE_RESERVED, '02/05/2018'],
      ['11500-2-102', DALTypes.InventoryState.OCCUPIED, '02/05/2018'],
      ['12982-3-103', DALTypes.InventoryState.VACANT_READY, '02/05/2018'],
    ];

    const headers = ['computedExternalId', 'state', 'availabilityDate'];
    const defaultMocks = ({ currentTime = fakeCurrentTime, excludeParseAsInTimezone = false } = {}) => ({
      getInventoryByExternalId: jest.fn(() => ({ ...inventory })),
      updateInventory: jest.fn(),
      bulkUpsertInventories: jest.fn(),
      now: jest.fn(() => currentTime.clone()), // now might mutate the returned instance
      parseAsInTimezone: jest.fn((evt, handler) => {
        if (!evt && !excludeParseAsInTimezone) return currentTime.startOf('day');
        return parseAsInTimezone(evt, handler);
      }),
      getInventoriesByExternalId: jest.fn(() => inventory),
      getInventoriesByComputedExternalId: jest.fn(() => inventory),
      getPropertySettingsAndTimezone: jest.fn(() => [
        {
          ...property[0],
          settings: { integration: { import: { inventoryAvailabilityDate: DALTypes.AvailabilityDateSourceType.EXTERNAL } } },
        },
      ]),
      getPropertiesToUpdateFromDB: jest.fn(() => [
        {
          name: 'lark',
        },
      ]),
      getTenant: jest.fn(evt => ({ id: evt, metadata: { backendIntegration: { name: DALTypes.BackendMode.MRI } } })),
    });

    const setupMocks = mocks => {
      jest.resetModules();
      mockModules({
        '../../../dal/inventoryRepo': {
          getInventoryByExternalId: mocks.getInventoryByExternalId,
          updateInventory: mocks.updateInventory,
          getInventoriesByExternalId: mocks.getInventoriesByExternalId,
          getInventoriesByComputedExternalId: mocks.getInventoriesByComputedExternalId,
          bulkUpsertInventories: mocks.bulkUpsertInventories,
        },
        '../../../dal/propertyRepo': {
          getPropertySettingsAndTimezone: mocks.getPropertySettingsAndTimezone,
          getPropertiesToUpdateFromDB: mocks.getPropertiesToUpdateFromDB,
        },
        '../../../../common/helpers/moment-utils': {
          now: mocks.now,
          parseAsInTimezone: mocks.parseAsInTimezone,
        },
        '../../../services/tenantService': {
          getTenant: mocks.getTenant,
        },
      });
      const updatesHandler = require('../updatesHandler'); // eslint-disable-line global-require
      updateInventory = updatesHandler.updateInventory;
    };

    let mocks;

    it('should call updateInventory 3 times when there is no previous values', async () => {
      mocks = defaultMocks();
      setupMocks(mocks);

      await updateInventory({ tenantId }, actual, null, headers);

      expect(mocks.bulkUpsertInventories.mock.calls.length).to.equal(1);
      expect(mocks.bulkUpsertInventories.mock.calls[0][1][0]).to.eql({
        ...inventory['11190-1-101'],
        state: DALTypes.InventoryState.OCCUPIED_NOTICE_RESERVED,
        availabilityDate: parseAsInTimezone('02/05/2018', { format: DATE_US_FORMAT, timezone }).toJSON(),
      });
      expect(mocks.bulkUpsertInventories.mock.calls[0][1][1]).to.eql({
        ...inventory['11500-2-102'],
        state: DALTypes.InventoryState.OCCUPIED,
        availabilityDate: parseAsInTimezone('02/05/2018', { format: DATE_US_FORMAT, timezone }).toJSON(),
      });
      expect(mocks.bulkUpsertInventories.mock.calls[0][1][2]).to.eql({
        ...inventory['12982-3-103'],
        state: DALTypes.InventoryState.VACANT_READY,
        availabilityDate: parseAsInTimezone('02/05/2018', { format: DATE_US_FORMAT, timezone }).toJSON(),
      });
    });

    it('should call updateInventory 2 times when there is no previous values and previous status doesnt change', async () => {
      mocks = {
        ...defaultMocks(),
        getInventoryByExternalId: jest.fn(() => ({
          ...inventory,
          state: DALTypes.InventoryState.OCCUPIED,
        })),
      };
      setupMocks(mocks);

      await updateInventory({ tenantId }, actual, null, headers);
      expect(mocks.bulkUpsertInventories.mock.calls.length).to.equal(1);
    });

    it('should map inventory state when the upload time is before the 6:00 PM', async () => {
      const currentTime = parseAsInTimezone('06/07/2018', { format: DATE_US_FORMAT, timezone }).startOf('day').add(1079, 'minutes');
      mocks = defaultMocks({ currentTime, excludeParseAsInTimezone: true });
      setupMocks(mocks);

      const currentData = [
        ['11190-1-101', DALTypes.InventoryState.VACANT_READY, '06/07/2018'],
        ['11500-2-102', DALTypes.InventoryState.OCCUPIED_NOTICE, '06/08/2018'],
        ['12982-3-103', DALTypes.InventoryState.VACANT_READY_RESERVED, '06/09/2018'],
      ];
      await updateInventory({ tenantId }, currentData, null, headers, null, DALTypes.BackendMode.MRI);

      expect(mocks.bulkUpsertInventories.mock.calls.length).to.equal(1);
      expect(mocks.bulkUpsertInventories.mock.calls[0][1][0]).to.eql({
        ...inventory['11190-1-101'],
        stateStartDate: currentTime.clone().startOf('day').toJSON(),
        state: DALTypes.InventoryState.VACANT_READY,
        availabilityDate: parseAsInTimezone('06/07/2018', { format: DATE_US_FORMAT, timezone }).toJSON(),
      });
      expect(mocks.bulkUpsertInventories.mock.calls[0][1][1]).to.eql({
        ...inventory['11500-2-102'],
        stateStartDate: currentTime.clone().startOf('day').toJSON(),
        state: DALTypes.InventoryState.OCCUPIED_NOTICE,
        availabilityDate: parseAsInTimezone('06/08/2018', { format: DATE_US_FORMAT, timezone }).toJSON(),
      });
      expect(mocks.bulkUpsertInventories.mock.calls[0][1][2]).to.eql({
        ...inventory['12982-3-103'],
        stateStartDate: currentTime.clone().startOf('day').toJSON(),
        state: DALTypes.InventoryState.VACANT_MAKE_READY_RESERVED,
        availabilityDate: parseAsInTimezone('06/09/2018', { format: DATE_US_FORMAT, timezone }).toJSON(),
      });
    });

    it('should map inventory state when the upload time is after the 6:00 PM', async () => {
      const currentTime = parseAsInTimezone('06/07/2018', { format: DATE_US_FORMAT, timezone }).startOf('day').add(1081, 'minutes');
      mocks = defaultMocks({ currentTime, excludeParseAsInTimezone: true });
      setupMocks(mocks);

      const currentData = [
        ['11190-1-101', DALTypes.InventoryState.VACANT_READY, '06/09/2018'],
        ['11500-2-102', DALTypes.InventoryState.OCCUPIED_NOTICE, '06/08/2018'],
        ['12982-3-103', DALTypes.InventoryState.VACANT_READY_RESERVED, '06/08/2018'],
      ];
      await updateInventory({ tenantId }, currentData, null, headers, null, DALTypes.BackendMode.MRI);

      expect(mocks.bulkUpsertInventories.mock.calls.length).to.equal(1);
      expect(mocks.bulkUpsertInventories.mock.calls[0][1][0]).to.eql({
        ...inventory['11190-1-101'],
        stateStartDate: currentTime.clone().startOf('day').toJSON(),
        state: DALTypes.InventoryState.VACANT_MAKE_READY,
        availabilityDate: parseAsInTimezone('06/09/2018', { format: DATE_US_FORMAT, timezone }).toJSON(),
      });
      expect(mocks.bulkUpsertInventories.mock.calls[0][1][1]).to.eql({
        ...inventory['11500-2-102'],
        stateStartDate: currentTime.clone().startOf('day').toJSON(),
        state: DALTypes.InventoryState.OCCUPIED_NOTICE,
        availabilityDate: parseAsInTimezone('06/08/2018', { format: DATE_US_FORMAT, timezone }).toJSON(),
      });
      expect(mocks.bulkUpsertInventories.mock.calls[0][1][2]).to.eql({
        ...inventory['12982-3-103'],
        stateStartDate: currentTime.clone().startOf('day').toJSON(),
        state: DALTypes.InventoryState.VACANT_READY_RESERVED,
        availabilityDate: parseAsInTimezone('06/08/2018', { format: DATE_US_FORMAT, timezone }).toJSON(),
      });
    });

    it('should call updateInventory 2 times when there is previous values', async () => {
      mocks = defaultMocks();
      setupMocks(mocks);

      await updateInventory({ tenantId }, actual, previous, headers);

      expect(mocks.bulkUpsertInventories.mock.calls.length).to.equal(1);
    });
  });

  describe('UpdateProspect', () => {
    it('parsePersonFromProspect should parse data and validate phones and email properly', () => {
      const data = {
        fullName: 'Ben Schultz',
        preferredName: 'Ben',
        email: 'benshultzmagic.com',
        homePhone: '+19522583386',
        officePhone: '',
        cellPhone: '',
        fax: '',
      };
      const person = parsePersonFromProspect(data);
      expect(person.contactInfo.length).to.equal(0);

      const data2 = {
        fullName: 'Ben Schultz',
        preferredName: 'Ben',
        email: 'jennifer.scheibel',
        homePhone: '19522583386',
        officePhone: '',
        cellPhone: '',
        fax: '',
      };
      const person2 = parsePersonFromProspect(data2);
      expect(person2.contactInfo.length).to.equal(1);

      const data3 = {
        fullName: 'Ben Schultz',
        preferredName: 'Ben',
        email: 'jthomsen@unomaha.edu',
        homePhone: '19522583386',
        officePhone: '',
        cellPhone: '',
        fax: '',
      };
      const person3 = parsePersonFromProspect(data3);
      expect(person3.contactInfo.length).to.equal(2);
    });
  });
});
