/*
 * Copyright (c) 2022 Reva Technology Inc., all rights reserved.
 * Unauthorized copying of this file, via any medium is strictly prohibited
 * Licensed under the Elastic License 2.0; you may not use this file except
 * in compliance with the Elastic License 2.0.
 */

import { expect } from 'chai';
import fs from 'fs';
import path from 'path';
import { promisify } from 'bluebird';
import { tenant } from '../../testUtils/setupTestGlobalContext';
import { now } from '../../../common/helpers/moment-utils';
import { DALTypes } from '../../../common/enums/DALTypes';
import { importSkipReasons } from '../../../common/enums/importSkipReasons';
import * as repoHelper from '../../testUtils/repoHelper';
import { activeLeaseDataKeys } from '../../testUtils/expectedKeys';
import { buildImportEntry } from '../importActiveLeases/retrieve-data';
import { processData } from '../importActiveLeases/process-data/process-data';
import { MainRoleDefinition, FunctionalRoleDefinition } from '../../../common/acd/rolesDefinition';
import { saveImportEntry, getLastResidentImportTrackingByPrimaryExternalId } from '../../dal/import-repo';
import { getAllExternalInfoByParty, archiveExternalInfoByPartyMemberId } from '../../dal/exportRepo';
import { getPartyBy, getPartyMembersByPartyIds, getAdditionalInfoByPartyAndType, archiveParty, updatePartyMember } from '../../dal/partyRepo';
import { getActiveLeaseWorkflowDataByPartyId, saveActiveLeaseWorkflowData } from '../../dal/activeLeaseWorkflowRepo';
import { getCommunicationsForParty } from '../../dal/communicationRepo';
import { parseDate } from '../importActiveLeases/process-data/helpers';
import { enhance } from '../../../common/helpers/contactInfoUtils';

const runImport = async (ctx, entry, property) =>
  await processData(ctx, { property, entries: [entry], forceSync: false, isInitialImport: false, forceSyncLeaseData: false });

describe('Residents import tests', () => {
  const ctx = { tenantId: tenant.id, backendMode: DALTypes.BackendMode.NONE };

  const createPropertyData = async () => {
    const property = await repoHelper.createAProperty({}, { name: 13780 });
    const propertyId = property.id;
    await repoHelper.createADispatcher(propertyId);

    const leaseName = await repoHelper.createALeaseName(repoHelper.testCtx, { name: 'test-lease', propertyId });
    const inventoryGroup = await repoHelper.createAInventoryGroup({ propertyId, leaseNameId: leaseName.id });
    await repoHelper.createALeaseTerm({ termLength: 11, period: DALTypes.LeasePeriod.MONTH, propertyId, leaseNameId: leaseName.id });

    const building = await repoHelper.createABuilding({ name: '02' });

    const inventory = await repoHelper.createAnInventory({
      name: '223',
      propertyId,
      buildingId: building.id,
      inventoryGroupId: inventoryGroup.id,
      externalId: '223',
    });

    return { property, building, inventory };
  };

  const loadResidentsData = async (filename, dataToAdd, dataToOverride) => {
    let rawData;
    const { addMembers = [], addLeaseData = {} } = dataToAdd || {};
    const { updatedMembers = [], updateLeaseData = {} } = dataToOverride || {};
    const rawDataString = await promisify(fs.readFile)(path.join(__dirname, 'resources/', filename), 'utf8');
    rawData = JSON.parse(rawDataString);

    Object.keys(updateLeaseData).forEach(key => (rawData[key] = updateLeaseData[key]));
    rawData.members.forEach(member => {
      const updatedMember = updatedMembers.find(m => m.id === member.id);
      updatedMember && Object.keys(updatedMember).forEach(key => (member[key] = updatedMember[key]));
    });

    rawData = { ...rawData, ...addLeaseData };
    rawData.members = [...rawData.members, ...addMembers];

    return rawData;
  };

  const setup = async (filename, dataToAdd, dataToOverride) => {
    const { property, building, inventory } = await createPropertyData();
    const entry = await loadResidentsData(filename, dataToAdd, dataToOverride);

    const entryToImport = buildImportEntry(property.externalId, entry);

    const savedEntry = await saveImportEntry(ctx, entryToImport);
    return { property, building, inventory, savedEntry };
  };

  const buildNewMember = ({ id, type = DALTypes.MemberType.RESIDENT, email = null, phone = null, firstName = null, lastName = null, vacateDate = null }) => ({
    id,
    type,
    email,
    phone,
    birthDay: null,
    lastName,
    firstName,
    vacateDate,
    middleInitial: null,
  });

  describe('CREATE', () => {
    describe('When processing a JSON entry for a Resident', () => {
      it('should create ContactInfo, Person, PartyMember, Party, ExternalPartyMemberInfo, ActiveLeaseWorkflowData and ResidentImportTracking entities', async () => {
        const { property, savedEntry } = await setup('import-resident-default-data.json');

        await runImport(ctx, savedEntry, property);
        const party = await getPartyBy(ctx, {});
        expect(party).to.be.ok;

        const partyMembers = await getPartyMembersByPartyIds(ctx, [party.id]);
        expect(partyMembers).to.be.ok;
        expect(partyMembers).to.have.length(1);

        const [partyMember] = partyMembers;
        expect(partyMember.fullName).to.equal('Adam Noah Levine');
        expect(partyMember.contactInfo.defaultEmail).to.equal('user1+test@test.com');
        expect(partyMember.contactInfo.defaultPhone).to.equal('12025550130');

        const activeLeaseWorkflowData = await getActiveLeaseWorkflowDataByPartyId(ctx, party.id);
        expect(activeLeaseWorkflowData).to.be.ok;

        const externalInfo = await getAllExternalInfoByParty(ctx, party.id);
        expect(externalInfo).to.be.ok;
        expect(externalInfo).to.have.length(1);

        const [primaryExternalInfo] = externalInfo;
        expect(primaryExternalInfo.externalId).to.equal('H000000001');
        expect(primaryExternalInfo.isPrimary).to.be.true;

        const residentImportTracking = await getLastResidentImportTrackingByPrimaryExternalId(ctx, primaryExternalInfo.externalId);
        expect(residentImportTracking).to.be.ok;
        expect(residentImportTracking.status).to.equal(DALTypes.ResidentImportStatus.PROCESSED);
      });
    });

    describe('MEMBERS', () => {
      describe('processing an entry that contains multiple Residents', () => {
        it('should create the new residents as non primary', async () => {
          const newResident = buildNewMember({
            id: 'H000000002',
            type: DALTypes.ExternalMemberType.RESIDENT,
            lastName: 'Levine',
            firstName: 'Behati',
          });
          const dataToAdd = { addMembers: [newResident] };

          const { savedEntry, property } = await setup('import-resident-default-data.json', dataToAdd);
          await runImport(ctx, savedEntry, property);

          const party = await getPartyBy(ctx, {});
          expect(party).to.be.ok;

          const externalInfo = await getAllExternalInfoByParty(ctx, party.id);
          expect(externalInfo).to.have.length(2);

          const [newExternalInfo] = externalInfo.filter(ext => ext.externalId === newResident.id);
          expect(newExternalInfo.isPrimary).to.be.false;

          const partyMembers = await getPartyMembersByPartyIds(ctx, [party.id]);
          const [secondResident] = partyMembers.filter(pm => pm.id === newExternalInfo.partyMemberId);
          expect(secondResident.fullName).to.equal([newResident.firstName, newResident.lastName].join(' '));
          expect(secondResident.memberType).to.equal(DALTypes.MemberType.RESIDENT);
        });
      });

      describe('processing an entry that contains a Guarantor', () => {
        it('should create a new guarantor', async () => {
          const newGuarantor = buildNewMember({
            id: 'H000000002',
            type: DALTypes.ExternalMemberType.GUARANTOR,
            lastName: 'Levine',
            firstName: 'Behati',
          });
          const dataToAdd = { addMembers: [newGuarantor] };

          const { savedEntry, property } = await setup('import-resident-default-data.json', dataToAdd);
          await runImport(ctx, savedEntry, property);

          const party = await getPartyBy(ctx, {});
          expect(party).to.be.ok;

          const externalInfo = await getAllExternalInfoByParty(ctx, party.id);
          expect(externalInfo).to.have.length(2);

          const [newExternalInfo] = externalInfo.filter(ext => ext.externalId === newGuarantor.id);
          expect(newExternalInfo.isPrimary).to.be.false;

          const partyMembers = await getPartyMembersByPartyIds(ctx, [party.id]);
          const [guarantor] = partyMembers.filter(pm => pm.id === newExternalInfo.partyMemberId);
          expect(guarantor.fullName).to.equal([newGuarantor.firstName, newGuarantor.lastName].join(' '));
          expect(guarantor.memberType).to.equal(DALTypes.MemberType.GUARANTOR);
        });
      });

      describe('processing an entry that contains a Child', () => {
        it('should create a new child', async () => {
          const newChild = buildNewMember({
            id: 'H000000002',
            type: DALTypes.ExternalMemberType.CHILD,
            lastName: 'Levine',
            firstName: 'Behati',
          });
          const dataToAdd = { addMembers: [newChild] };

          const { savedEntry, property } = await setup('import-resident-default-data.json', dataToAdd);
          await runImport(ctx, savedEntry, property);

          const party = await getPartyBy(ctx, {});
          expect(party).to.be.ok;

          const externalInfo = await getAllExternalInfoByParty(ctx, party.id);
          expect(externalInfo).to.have.length(2);

          const [newExternalInfo] = externalInfo.filter(ext => ext.externalId === newChild.id);
          expect(newExternalInfo.isPrimary).to.be.false;

          const partyMembers = await getPartyMembersByPartyIds(ctx, [party.id]);
          expect(partyMembers).to.have.length(1);

          const additionalPartyMember = await getAdditionalInfoByPartyAndType(ctx, party.id);
          const [child] = additionalPartyMember.filter(apm => apm.id === newExternalInfo.childId);
          expect(child.info.fullName).to.equal([newChild.firstName, newChild.lastName].join(' '));
          expect(child.type).to.equal(DALTypes.AdditionalPartyMemberType.CHILD);
        });
      });

      describe('processing an entry that contains a Occupant', () => {
        it('should skip the creation of the new occupant', async () => {
          const newOccupant = buildNewMember({
            id: 'H000000002',
            type: DALTypes.ExternalMemberType.OCCUPANT,
            lastName: 'Levine',
            firstName: 'Behati',
          });
          const dataToAdd = { addMembers: [newOccupant] };

          const { savedEntry, property } = await setup('import-resident-default-data.json', dataToAdd);
          await runImport(ctx, savedEntry, property);

          const party = await getPartyBy(ctx, {});
          expect(party).to.be.ok;

          const externalInfo = await getAllExternalInfoByParty(ctx, party.id);
          expect(externalInfo).to.have.length(1);
          expect(externalInfo[0].externalId).to.equal('H000000001');

          const partyMembers = await getPartyMembersByPartyIds(ctx, [party.id]);
          expect(partyMembers).to.have.length(1);
          expect(partyMembers[0].fullName).to.equal('Adam Noah Levine');

          const occupants = partyMembers.filter(pm => pm.memberType === DALTypes.MemberType.OCCUPANT);
          expect(occupants).to.have.length(0);
        });
      });

      describe('processing an entry that contains a new Resident vacated in the past', () => {
        it('should not create the new resident', async () => {
          const newResident = buildNewMember({
            id: 'H000000002',
            type: DALTypes.ExternalMemberType.RESIDENT,
            lastName: 'Levine',
            firstName: 'Behati',
            vacateDate: '1999-08-30T05:00:00Z',
          });
          const dataToAdd = { addMembers: [newResident] };

          const { savedEntry, property } = await setup('import-resident-default-data.json', dataToAdd);
          await runImport(ctx, savedEntry, property);

          const party = await getPartyBy(ctx, {});
          expect(party).to.be.ok;

          const externalInfo = await getAllExternalInfoByParty(ctx, party.id);
          expect(externalInfo).to.have.length(1);
          expect(externalInfo[0].externalId).to.equal('H000000001');

          const partyMembers = await getPartyMembersByPartyIds(ctx, [party.id]);
          expect(partyMembers).to.have.length(1);
          expect(partyMembers[0].fullName).to.equal('Adam Noah Levine');
        });
      });

      describe('processing an entry that contains a new Resident vacated in the future', () => {
        it('should create the new resident as vacated', async () => {
          const newResident = buildNewMember({
            id: 'H000000002',
            type: DALTypes.ExternalMemberType.RESIDENT,
            lastName: 'Levine',
            firstName: 'Behati',
            vacateDate: now().add(5, 'days'),
          });
          const dataToAdd = { addMembers: [newResident] };

          const { savedEntry, property } = await setup('import-resident-default-data.json', dataToAdd);
          await runImport(ctx, savedEntry, property);

          const party = await getPartyBy(ctx, {});
          expect(party).to.be.ok;

          const externalInfo = await getAllExternalInfoByParty(ctx, party.id);
          expect(externalInfo).to.have.length(2);

          const [newExternalInfo] = externalInfo.filter(ext => ext.externalId === newResident.id);
          expect(newExternalInfo.isPrimary).to.be.false;

          const partyMembers = await getPartyMembersByPartyIds(ctx, [party.id]);
          const [secondResident] = partyMembers.filter(pm => pm.id === newExternalInfo.partyMemberId);
          expect(secondResident.fullName).to.equal([newResident.firstName, newResident.lastName].join(' '));
          expect(secondResident.memberType).to.equal(DALTypes.MemberType.RESIDENT);
          expect(secondResident.vacateDate).to.be.not.null;
        });
      });

      describe('processing an entry that contains a Resident with invalid email', () => {
        it('should create the new resident without the email address', async () => {
          const newEmail = 'n/a';
          const updatedMembers = [{ id: 'H000000001', email: newEmail }];
          const dataToOverride = { updatedMembers };
          const { savedEntry, property } = await setup('import-resident-default-data.json', {}, dataToOverride);
          await runImport(ctx, savedEntry, property);

          const party = await getPartyBy(ctx, {});
          expect(party).to.be.ok;

          const partyMembers = await getPartyMembersByPartyIds(ctx, [party.id]);
          expect(partyMembers).to.have.length(1);

          const [partyMember] = partyMembers;
          expect(partyMember.contactInfo.defaultEmail).to.equal(undefined);
        });
      });

      describe('processing an entry for a property with 2 teams', () => {
        it('should create and assign the new party to the resident service team', async () => {
          const { savedEntry, property } = await setup('import-resident-default-data.json');
          const { team } = await repoHelper.createAUserAndTeam({
            roles: {
              mainRoles: [MainRoleDefinition.LA.name],
              functionalRoles: [FunctionalRoleDefinition.LD.name],
            },
            propertyId: property.id,
            teamParams: { module: DALTypes.ModuleType.RESIDENT_SERVICES },
          });
          await runImport(ctx, savedEntry, property);

          const party = await getPartyBy(ctx, {});
          expect(party).to.be.ok;
          expect(party.ownerTeam).to.equal(team.id);
        });
      });
    });

    describe('LEASE', () => {
      describe('processing a new entry', () => {
        it('leaseData should contain all the keys', async () => {
          const { savedEntry, property } = await setup('import-resident-default-data.json');
          await runImport(ctx, savedEntry, property);

          const party = await getPartyBy(ctx, {});
          expect(party).to.be.ok;

          const activeLeaseWorkflowData = await getActiveLeaseWorkflowDataByPartyId(ctx, party.id);
          expect(activeLeaseWorkflowData).to.be.ok;
          expect(activeLeaseWorkflowData.leaseData).to.have.all.keys(activeLeaseDataKeys);
        });
      });

      describe('processing a new entry that has the status RESIDENT', () => {
        it('metadata should contain the moveInConfirmed flag set as true', async () => {
          const { savedEntry, property } = await setup('import-resident-default-data.json');
          await runImport(ctx, savedEntry, property);

          const party = await getPartyBy(ctx, {});
          expect(party).to.be.ok;

          const activeLeaseWorkflowData = await getActiveLeaseWorkflowDataByPartyId(ctx, party.id);
          expect(activeLeaseWorkflowData).to.be.ok;
          expect(activeLeaseWorkflowData.metadata.moveInConfirmed).to.be.true;
        });
      });

      describe('processing a new entry that has a vacate date', () => {
        it('the active lease state should be movingOut', async () => {
          const dataToOverride = { updateLeaseData: { leaseVacateDate: now().add(5, 'days') } };
          const { savedEntry, property } = await setup('import-resident-default-data.json', {}, dataToOverride);
          await runImport(ctx, savedEntry, property);

          const party = await getPartyBy(ctx, {});
          expect(party).to.be.ok;

          const activeLeaseWorkflowData = await getActiveLeaseWorkflowDataByPartyId(ctx, party.id);
          expect(activeLeaseWorkflowData).to.be.ok;
          expect(activeLeaseWorkflowData.state).to.equal(DALTypes.ActiveLeaseState.MOVING_OUT);
        });
      });

      describe('processing a new entry that has evicted status', () => {
        it('the active lease state should be movingOut', async () => {
          const dataToOverride = { updateLeaseData: { isUnderEviction: true } };
          const { savedEntry, property } = await setup('import-resident-default-data.json', {}, dataToOverride);
          await runImport(ctx, savedEntry, property);

          const party = await getPartyBy(ctx, {});
          expect(party).to.be.ok;

          const activeLeaseWorkflowData = await getActiveLeaseWorkflowDataByPartyId(ctx, party.id);
          expect(activeLeaseWorkflowData).to.be.ok;
          expect(activeLeaseWorkflowData.state).to.equal(DALTypes.ActiveLeaseState.MOVING_OUT);
          expect(activeLeaseWorkflowData.metadata.isUnderEviction).to.be.true;
        });
      });

      describe('processing a new entry that has the lease term as MTM', () => {
        it('the active lease rolloverPeriod should be MTM and lease term should be 1 month', async () => {
          const dataToOverride = { updateLeaseData: { leaseTerm: 'MTM' } };
          const { savedEntry, property } = await setup('import-resident-default-data.json', {}, dataToOverride);
          await runImport(ctx, savedEntry, property);

          const party = await getPartyBy(ctx, {});
          expect(party).to.be.ok;

          const activeLeaseWorkflowData = await getActiveLeaseWorkflowDataByPartyId(ctx, party.id);
          expect(activeLeaseWorkflowData).to.be.ok;
          expect(activeLeaseWorkflowData.rolloverPeriod).to.equal(DALTypes.RolloverPeriod.M2M);
          expect(activeLeaseWorkflowData.leaseData.leaseTerm).to.equal(1);
        });
      });

      describe('processing a new entry that has the renewal letter sent', () => {
        it('one comm should be added', async () => {
          const dataToOverride = { updateLeaseData: { wasExternalRenewalLetterSent: 'Y', externalRenewalLetterSentDate: now().add(-5, 'days') } };
          const { savedEntry, property } = await setup('import-resident-default-data.json', {}, dataToOverride);
          await runImport(ctx, savedEntry, property);

          const party = await getPartyBy(ctx, {});
          expect(party).to.be.ok;

          const activeLeaseWorkflowData = await getActiveLeaseWorkflowDataByPartyId(ctx, party.id);

          expect(activeLeaseWorkflowData).to.be.ok;
          expect(activeLeaseWorkflowData.metadata.wasExternalRenewalLetterSent).to.be.true;
          expect(activeLeaseWorkflowData.metadata.externalRenewalLetterSentDate).to.be.not.null;

          const communications = await getCommunicationsForParty(ctx, party.id, {
            type: DALTypes.CommunicationMessageType.CONTACTEVENT,
            direction: DALTypes.CommunicationDirection.IN,
          });
          expect(communications).to.have.length(1);

          const [comm] = communications;
          expect(comm.category).to.equal(DALTypes.CommunicationCategory.USER_COMMUNICATION);
          expect(comm.unread).to.be.false;
        });
      });
    });
  });

  describe('UPDATE', () => {
    let primaryExternalId;
    let createdProperty;

    beforeEach(async () => {
      const { savedEntry, property } = await setup('import-resident-default-data.json');
      primaryExternalId = savedEntry.primaryExternalId;
      createdProperty = property;
      await runImport(ctx, savedEntry, property);
    });

    const updateSetup = async (filename, dataToAdd, dataToOverride) => {
      const entry = await loadResidentsData(filename, dataToAdd, dataToOverride);
      const entryToImport = buildImportEntry(createdProperty.externalId, entry);

      const savedEntry = await saveImportEntry(ctx, entryToImport);
      return { property: createdProperty, savedEntry };
    };

    describe('PERSON', () => {
      describe('processing an entry where only the name of the person is updated', () => {
        it('should update the name of the person', async () => {
          const newLastName = 'Test';
          const newFirstName = 'Test';
          const newMiddleInitial = '';
          const updatedMembers = [{ id: primaryExternalId, lastName: newLastName, firstName: newFirstName, middleInitial: newMiddleInitial }];
          const dataToOverride = { updatedMembers };
          const { savedEntry, property } = await updateSetup('import-resident-default-data.json', {}, dataToOverride);
          await runImport(ctx, savedEntry, property);

          const party = await getPartyBy(ctx, {});
          expect(party).to.be.ok;

          const partyMembers = await getPartyMembersByPartyIds(ctx, [party.id]);
          expect(partyMembers).to.have.length(1);

          const [partyMember] = partyMembers;
          expect(partyMember.fullName).to.equal([newFirstName, newLastName].join(' '));
        });
      });

      describe('processing an entry where only the email of the person is updated', () => {
        it('should add the new email of the person', async () => {
          const newEmail = 'test@test.com';
          const updatedMembers = [{ id: primaryExternalId, email: newEmail }];
          const dataToOverride = { updatedMembers };
          const { savedEntry, property } = await updateSetup('import-resident-default-data.json', {}, dataToOverride);
          await runImport(ctx, savedEntry, property);

          const party = await getPartyBy(ctx, {});
          expect(party).to.be.ok;

          const partyMembers = await getPartyMembersByPartyIds(ctx, [party.id]);
          expect(partyMembers).to.have.length(1);

          const [partyMember] = partyMembers;
          expect(partyMember.contactInfo.defaultEmail).to.equal(newEmail);
          expect(partyMember.contactInfo.emails).to.have.length(2);
        });
      });

      describe('processing an entry where only the phone of the person is updated', () => {
        it('should add the new phone number of the person', async () => {
          const newPhone = '12025550101';
          const updatedMembers = [{ id: primaryExternalId, phone: newPhone }];
          const dataToOverride = { updatedMembers };
          const { savedEntry, property } = await updateSetup('import-resident-default-data.json', {}, dataToOverride);
          await runImport(ctx, savedEntry, property);

          const party = await getPartyBy(ctx, {});
          expect(party).to.be.ok;

          const partyMembers = await getPartyMembersByPartyIds(ctx, [party.id]);
          expect(partyMembers).to.have.length(1);

          const [partyMember] = partyMembers;
          expect(partyMember.contactInfo.defaultPhone).to.equal(newPhone);
          expect(partyMember.contactInfo.phones).to.have.length(2);
        });
      });

      describe('processing an entry where the phone and email of the person are updated', () => {
        it('should add the new phone number and the email of the person', async () => {
          const newEmail = 'test@test.com';
          const newPhone = '12025550101';
          const updatedMembers = [{ id: primaryExternalId, email: newEmail, phone: newPhone }];
          const dataToOverride = { updatedMembers };
          const { savedEntry, property } = await updateSetup('import-resident-default-data.json', {}, dataToOverride);
          await runImport(ctx, savedEntry, property);

          const party = await getPartyBy(ctx, {});
          expect(party).to.be.ok;

          const partyMembers = await getPartyMembersByPartyIds(ctx, [party.id]);
          expect(partyMembers).to.have.length(1);

          const [partyMember] = partyMembers;
          expect(partyMember.contactInfo.defaultEmail).to.equal(newEmail);
          expect(partyMember.contactInfo.defaultPhone).to.equal(newPhone);
          expect(partyMember.contactInfo.emails).to.have.length(2);
          expect(partyMember.contactInfo.phones).to.have.length(2);
        });
      });

      describe('processing an entry where the phone, email and name of the person are updated', () => {
        it('should update the name, add the new phone number and the email of the person', async () => {
          const newLastName = 'Test';
          const newFirstName = 'Test';
          const newMiddleInitial = '';
          const newEmail = 'test@test.com';
          const newPhone = '12025550101';
          const updatedMembers = [
            { id: primaryExternalId, lastName: newLastName, firstName: newFirstName, middleInitial: newMiddleInitial, email: newEmail, phone: newPhone },
          ];
          const dataToOverride = { updatedMembers };
          const { savedEntry, property } = await updateSetup('import-resident-default-data.json', {}, dataToOverride);
          await runImport(ctx, savedEntry, property);

          const party = await getPartyBy(ctx, {});
          expect(party).to.be.ok;

          const partyMembers = await getPartyMembersByPartyIds(ctx, [party.id]);
          expect(partyMembers).to.have.length(1);

          const [partyMember] = partyMembers;
          expect(partyMember.fullName).to.equal([newFirstName, newLastName].join(' '));
          expect(partyMember.contactInfo.defaultEmail).to.equal(newEmail);
          expect(partyMember.contactInfo.defaultPhone).to.equal(newPhone);
          expect(partyMember.contactInfo.emails).to.have.length(2);
          expect(partyMember.contactInfo.phones).to.have.length(2);
        });
      });

      describe('processing an entry where the phone is updated and already exists', () => {
        it('should update the new phone number of the person', async () => {
          const newPhone = '12025550101';

          const contactInfo = enhance([{ type: 'phone', value: newPhone }]);
          await repoHelper.createAPerson('Test', 'Test', contactInfo);

          const updatedMembers = [{ id: primaryExternalId, phone: newPhone }];
          const dataToOverride = { updatedMembers };
          const { savedEntry, property } = await updateSetup('import-resident-default-data.json', {}, dataToOverride);
          await runImport(ctx, savedEntry, property);

          const party = await getPartyBy(ctx, {});
          expect(party).to.be.ok;

          const partyMembers = await getPartyMembersByPartyIds(ctx, [party.id]);
          expect(partyMembers).to.have.length(1);

          const [partyMember] = partyMembers;
          expect(partyMember.contactInfo.defaultPhone).to.equal(newPhone);
          expect(partyMember.contactInfo.phones).to.have.length(2);
        });
      });

      describe('processing an entry where the phone, email and name of the person are updated and the new name already exists', () => {
        it('should update the name and add the new phone number and the email of the person', async () => {
          const newLastName = 'Test';
          const newFirstName = 'Test';
          const newMiddleInitial = '';
          const newEmail = 'test@test.com';
          const newPhone = '12025550101';

          await repoHelper.createAPerson([newFirstName, newLastName].join(' '), newFirstName);

          const updatedMembers = [
            { id: primaryExternalId, lastName: newLastName, firstName: newFirstName, middleInitial: newMiddleInitial, email: newEmail, phone: newPhone },
          ];
          const dataToOverride = { updatedMembers };
          const { savedEntry, property } = await updateSetup('import-resident-default-data.json', {}, dataToOverride);
          await runImport(ctx, savedEntry, property);

          const party = await getPartyBy(ctx, {});
          expect(party).to.be.ok;

          const partyMembers = await getPartyMembersByPartyIds(ctx, [party.id]);
          expect(partyMembers).to.have.length(1);

          const [partyMember] = partyMembers;
          expect(partyMember.fullName).to.equal([newFirstName, newLastName].join(' '));
          expect(partyMember.contactInfo.defaultEmail).to.equal(newEmail);
          expect(partyMember.contactInfo.defaultPhone).to.equal(newPhone);
          expect(partyMember.contactInfo.emails).to.have.length(2);
          expect(partyMember.contactInfo.phones).to.have.length(2);
        });
      });

      describe('processing an entry where the phone and name of the person are updated and they already exists', () => {
        it('should update the name and add the new phone number of the person', async () => {
          const newLastName = 'Test';
          const newFirstName = 'Test';
          const newMiddleInitial = '';
          const newPhone = '12025550101';

          const contactInfo = enhance([{ type: 'phone', value: newPhone }]);
          await repoHelper.createAPerson([newFirstName, newLastName].join(' '), newFirstName, contactInfo);

          const updatedMembers = [{ id: primaryExternalId, lastName: newLastName, firstName: newFirstName, middleInitial: newMiddleInitial, phone: newPhone }];
          const dataToOverride = { updatedMembers };
          const { savedEntry, property } = await updateSetup('import-resident-default-data.json', {}, dataToOverride);
          await runImport(ctx, savedEntry, property);

          const party = await getPartyBy(ctx, {});
          expect(party).to.be.ok;

          const partyMembers = await getPartyMembersByPartyIds(ctx, [party.id]);
          expect(partyMembers).to.have.length(1);

          const [partyMember] = partyMembers;
          expect(partyMember.fullName).to.equal([newFirstName, newLastName].join(' '));
          expect(partyMember.contactInfo.defaultPhone).to.equal(newPhone);
          expect(partyMember.contactInfo.phones).to.have.length(2);
        });
      });
    });

    describe('MEMBER', () => {
      describe('processing an entry where the primary has changed', () => {
        it('should update the external info for members', async () => {
          const newPrimaryExternalId = 'H000000002';
          const newResident = buildNewMember({
            id: newPrimaryExternalId,
            type: DALTypes.ExternalMemberType.RESIDENT,
            lastName: 'Levine',
            firstName: 'Behati',
            vacateDate: now().add(5, 'days'),
          });
          const dataToAdd = { addMembers: [newResident] };

          const party = await getPartyBy(ctx, {});
          expect(party).to.be.ok;

          const { savedEntry, property } = await updateSetup('import-resident-default-data.json', dataToAdd);
          await runImport(ctx, savedEntry, property);

          const externalInfo = await getAllExternalInfoByParty(ctx, party.id);
          expect(externalInfo).to.be.ok;
          expect(externalInfo).to.have.length(2);
          const currentPrimaryExternalInfo = externalInfo.find(e => e.externalId !== newPrimaryExternalId);
          expect(currentPrimaryExternalInfo.isPrimary).to.be.true;

          const updateLeaseData = { primaryExternalId: newPrimaryExternalId };
          const dataToOverride = { updateLeaseData };
          const { savedEntry: updatedSavedEntry } = await updateSetup('import-resident-default-data.json', dataToAdd, dataToOverride);
          await runImport(ctx, updatedSavedEntry, property);

          const updatedExternalInfo = await getAllExternalInfoByParty(ctx, party.id);

          expect(updatedExternalInfo).to.be.ok;
          expect(updatedExternalInfo).to.have.length(2);

          const oldPrimaryExternalInfo = updatedExternalInfo.find(e => e.externalId !== newPrimaryExternalId);
          const newPrimaryExternalInfo = updatedExternalInfo.find(e => e.externalId === newPrimaryExternalId);

          expect(oldPrimaryExternalInfo.isPrimary).to.be.false;
          expect(newPrimaryExternalInfo.isPrimary).to.be.true;
        });
      });

      describe('processing an entry where the member type has changed from Resident to Guarantor', () => {
        it('should update the member type', async () => {
          const newFirstName = 'Behati';
          const newLastName = 'Levine';
          const newResident = buildNewMember({
            id: 'H000000002',
            type: DALTypes.ExternalMemberType.RESIDENT,
            lastName: newLastName,
            firstName: newFirstName,
          });
          const dataToAdd = { addMembers: [newResident] };

          const party = await getPartyBy(ctx, {});
          expect(party).to.be.ok;

          const { savedEntry, property } = await updateSetup('import-resident-default-data.json', dataToAdd);
          await runImport(ctx, savedEntry, property);

          const partyMembers = await getPartyMembersByPartyIds(ctx, [party.id]);
          const newPartyMember = partyMembers.find(pm => pm.fullName === [newFirstName, newLastName].join(' '));

          expect(newPartyMember.memberType).to.equal(DALTypes.MemberType.RESIDENT);
          dataToAdd.addMembers[0].type = DALTypes.ExternalMemberType.GUARANTOR;
          const { savedEntry: updatedSavedEntry } = await updateSetup('import-resident-default-data.json', dataToAdd);
          await runImport(ctx, updatedSavedEntry, property);

          const updatedPartyMembers = await getPartyMembersByPartyIds(ctx, [party.id]);
          const updatedPartyMember = updatedPartyMembers.find(pm => pm.fullName === [newFirstName, newLastName].join(' '));
          expect(updatedPartyMember.memberType).to.equal(DALTypes.MemberType.GUARANTOR);
        });
      });

      describe('processing an entry where the member type has changed from Guarantor to Resident', () => {
        it('should update the member type', async () => {
          const newFirstName = 'Behati';
          const newLastName = 'Levine';
          const newGuarantor = buildNewMember({
            id: 'H000000002',
            type: DALTypes.ExternalMemberType.GUARANTOR,
            lastName: newLastName,
            firstName: newFirstName,
          });
          const dataToAdd = { addMembers: [newGuarantor] };

          const party = await getPartyBy(ctx, {});
          expect(party).to.be.ok;

          const { savedEntry, property } = await updateSetup('import-resident-default-data.json', dataToAdd);
          await runImport(ctx, savedEntry, property);

          const partyMembers = await getPartyMembersByPartyIds(ctx, [party.id]);
          const newPartyMember = partyMembers.find(pm => pm.fullName === [newFirstName, newLastName].join(' '));
          expect(newPartyMember.memberType).to.equal(DALTypes.MemberType.GUARANTOR);

          dataToAdd.addMembers[0].type = DALTypes.ExternalMemberType.RESIDENT;
          const { savedEntry: updatedSavedEntry } = await updateSetup('import-resident-default-data.json', dataToAdd);
          await runImport(ctx, updatedSavedEntry, property);

          const updatedPartyMembers = await getPartyMembersByPartyIds(ctx, [party.id]);
          const updatedPartyMember = updatedPartyMembers.find(pm => pm.fullName === [newFirstName, newLastName].join(' '));
          expect(updatedPartyMember.memberType).to.equal(DALTypes.MemberType.RESIDENT);
        });
      });

      describe('processing an entry where the member is marked as vacated', () => {
        it('should update the member vacate date', async () => {
          const updatedMembers = [{ id: primaryExternalId, vacateDate: now().add(5, 'days') }];
          const dataToOverride = { updatedMembers };

          const { savedEntry, property } = await updateSetup('import-resident-default-data.json', {}, dataToOverride);
          await runImport(ctx, savedEntry, property);

          const party = await getPartyBy(ctx, {});
          expect(party).to.be.ok;

          const partyMembers = await getPartyMembersByPartyIds(ctx, [party.id]);
          const [partyMember] = partyMembers;

          expect(partyMember.vacateDate).to.be.not.null;
        });
      });

      describe('processing an entry where the member is marked as vacated', () => {
        it('should not update the member vacate date if the lease has the same end date and is PastResident', async () => {
          const updatedMembers = [{ id: primaryExternalId, vacateDate: now().add(5, 'days') }];
          const updateLeaseData = { leaseVacateDate: now().add(5, 'days'), status: DALTypes.PartyStateType.PASTRESIDENT };
          const dataToOverride = { updatedMembers, updateLeaseData };

          const { savedEntry, property } = await updateSetup('import-resident-default-data.json', {}, dataToOverride);
          await runImport(ctx, savedEntry, property);

          const party = await getPartyBy(ctx, {});
          expect(party).to.be.ok;

          const partyMembers = await getPartyMembersByPartyIds(ctx, [party.id]);
          const [partyMember] = partyMembers;
          expect(partyMember.vacateDate).to.be.null;
        });
      });

      describe('processing an entry where the member is marked as vacated', () => {
        it('should update the member vacate date if the lease does not have the same end date and is PastResident', async () => {
          const updatedMembers = [{ id: primaryExternalId, vacateDate: now().add(3, 'days') }];
          const updateLeaseData = { leaseVacateDate: now().add(5, 'days'), status: DALTypes.PartyStateType.PASTRESIDENT };
          const dataToOverride = { updatedMembers, updateLeaseData };

          const { savedEntry, property } = await updateSetup('import-resident-default-data.json', {}, dataToOverride);
          await runImport(ctx, savedEntry, property);

          const party = await getPartyBy(ctx, {});
          expect(party).to.be.ok;

          const partyMembers = await getPartyMembersByPartyIds(ctx, [party.id]);
          const [partyMember] = partyMembers;
          expect(partyMember.vacateDate).to.be.not.null;
        });
      });

      describe('processing an entry where the member is removed', () => {
        it('should update the party member and external info with an end date ', async () => {
          const newFirstName = 'Behati';
          const newLastName = 'Levine';
          const newResident = buildNewMember({
            id: 'H000000002',
            type: DALTypes.ExternalMemberType.RESIDENT,
            lastName: newLastName,
            firstName: newFirstName,
          });
          const dataToAdd = { addMembers: [newResident] };

          const party = await getPartyBy(ctx, {});
          expect(party).to.be.ok;

          const { savedEntry, property } = await updateSetup('import-resident-default-data.json', dataToAdd);
          await runImport(ctx, savedEntry, property);

          const { savedEntry: updatedSavedEntry } = await updateSetup('import-resident-default-data.json');
          await runImport(ctx, updatedSavedEntry, property);

          const partyMembers = await getPartyMembersByPartyIds(ctx, [party.id], { excludeInactive: false });
          expect(partyMembers).to.have.length(2);

          const updatedPartyMember = partyMembers.find(pm => pm.fullName === [newFirstName, newLastName].join(' '));
          expect(updatedPartyMember.endDate).to.be.not.null;

          const externalInfo = await getAllExternalInfoByParty(ctx, party.id);
          expect(externalInfo).to.have.length(2);

          const updatedExternalInfo = externalInfo.find(e => e.partyMemberId === updatedPartyMember.id);
          expect(updatedExternalInfo.endDate).to.be.not.null;
        });
      });

      describe('processing an entry where the member is made active again', () => {
        it('should update the member vacate date, endDate and external party member info', async () => {
          const party = await getPartyBy(ctx, {});

          const initialPartyMembers = await getPartyMembersByPartyIds(ctx, [party.id]);
          expect(initialPartyMembers).to.have.length(1);

          await archiveExternalInfoByPartyMemberId(ctx, initialPartyMembers[0].id);
          const updatedPartyMember = { ...initialPartyMembers[0], endDate: now(), vacateDate: now() };
          await updatePartyMember(ctx, updatedPartyMember.id, updatedPartyMember);

          const { savedEntry, property } = await updateSetup('import-resident-default-data.json');
          await runImport(ctx, savedEntry, property);

          const partyMembers = await getPartyMembersByPartyIds(ctx, [party.id]);
          const [partyMember] = partyMembers;
          expect(partyMember.vacateDate).to.be.null;
          expect(partyMember.endDate).to.be.null;

          const externalInfo = await getAllExternalInfoByParty(ctx, party.id);
          expect(externalInfo).to.have.length(1);
          expect(externalInfo[0].endDate).to.be.null;
        });
      });
    });

    describe('LEASE', () => {
      describe('processing an entry where the lease end date changed', () => {
        it('should update the lease end date from the active lease workflow data', async () => {
          const newLeaseEndDate = now({ timezone: createdProperty.timezone }).add(6, 'month').startOf('day');
          const updateLeaseData = { leaseEndDate: newLeaseEndDate };
          const dataToOverride = { updateLeaseData };

          const { savedEntry, property } = await updateSetup('import-resident-default-data.json', {}, dataToOverride);
          await runImport(ctx, savedEntry, property);

          const party = await getPartyBy(ctx, {});
          expect(party).to.be.ok;

          const activeLeaseWorkflowData = await getActiveLeaseWorkflowDataByPartyId(ctx, party.id);
          expect(activeLeaseWorkflowData).to.be.ok;

          const formattedNewLeaseEndDate = parseDate(newLeaseEndDate, property.timezone);
          expect(activeLeaseWorkflowData.leaseData.leaseEndDate).to.equal(formattedNewLeaseEndDate);
        });
      });

      describe('processing an entry where the lease end date changed', () => {
        it('should update the lease end date and remove the extension of the active lease', async () => {
          const newLeaseEndDate = now({ timezone: createdProperty.timezone }).add(6, 'month').startOf('day');
          const updateLeaseData = { leaseEndDate: newLeaseEndDate };
          const dataToOverride = { updateLeaseData };

          const party = await getPartyBy(ctx, {});
          expect(party).to.be.ok;

          const activeLeaseWorkflowData = await getActiveLeaseWorkflowDataByPartyId(ctx, party.id);
          expect(activeLeaseWorkflowData).to.be.ok;
          activeLeaseWorkflowData.leaseData.computedExtensionEndDate = now().add(3, 'month');
          activeLeaseWorkflowData.isExtension = true;
          await saveActiveLeaseWorkflowData(ctx, { ...activeLeaseWorkflowData });

          const { savedEntry, property } = await updateSetup('import-resident-default-data.json', {}, dataToOverride);
          await runImport(ctx, savedEntry, property);

          const updatedActiveLeaseWorkflowData = await getActiveLeaseWorkflowDataByPartyId(ctx, party.id);
          expect(updatedActiveLeaseWorkflowData).to.be.ok;

          const formattedNewLeaseEndDate = parseDate(newLeaseEndDate, property.timezone);
          expect(updatedActiveLeaseWorkflowData.leaseData.leaseEndDate).to.equal(formattedNewLeaseEndDate);
          expect(updatedActiveLeaseWorkflowData.isExtension).to.be.false;
        });
      });

      describe('processing an entry where the lease term changed to MTM', () => {
        it('should update the lease term and rolloverPeriod', async () => {
          const newLeaseTerm = 'MTM';
          const updateLeaseData = { leaseTerm: newLeaseTerm };
          const dataToOverride = { updateLeaseData };

          const { savedEntry, property } = await updateSetup('import-resident-default-data.json', {}, dataToOverride);
          await runImport(ctx, savedEntry, property);

          const party = await getPartyBy(ctx, {});
          expect(party).to.be.ok;

          const activeLeaseWorkflowData = await getActiveLeaseWorkflowDataByPartyId(ctx, party.id);
          expect(activeLeaseWorkflowData).to.be.ok;
          expect(activeLeaseWorkflowData.leaseData.leaseTerm).to.equal(1);
          expect(activeLeaseWorkflowData.rolloverPeriod).to.equal(DALTypes.RolloverPeriod.M2M);
        });
      });

      describe('processing an entry where the lease term changed from MTM', () => {
        it('should update the lease term and rolloverPeriod', async () => {
          const newLeaseTerm = 6;
          const updateLeaseData = { leaseTerm: newLeaseTerm };
          const dataToOverride = { updateLeaseData };

          const party = await getPartyBy(ctx, {});
          expect(party).to.be.ok;

          const activeLeaseWorkflowData = await getActiveLeaseWorkflowDataByPartyId(ctx, party.id);
          expect(activeLeaseWorkflowData).to.be.ok;
          activeLeaseWorkflowData.leaseData.leaseTerm = 1;
          await saveActiveLeaseWorkflowData(ctx, { ...activeLeaseWorkflowData });

          const { savedEntry, property } = await updateSetup('import-resident-default-data.json', {}, dataToOverride);
          await runImport(ctx, savedEntry, property);

          const updatedActiveLeaseWorkflowData = await getActiveLeaseWorkflowDataByPartyId(ctx, party.id);
          expect(updatedActiveLeaseWorkflowData).to.be.ok;
          expect(updatedActiveLeaseWorkflowData.leaseData.leaseTerm).to.equal(newLeaseTerm);
          expect(updatedActiveLeaseWorkflowData.rolloverPeriod).to.equal(DALTypes.RolloverPeriod.NONE);
        });
      });

      describe('processing an entry where the unit rent changed', () => {
        it('should update the unit rent', async () => {
          const newUnitRent = 1234;
          const updateLeaseData = { unitRent: newUnitRent };
          const dataToOverride = { updateLeaseData };

          const { savedEntry, property } = await updateSetup('import-resident-default-data.json', {}, dataToOverride);
          await runImport(ctx, savedEntry, property);

          const party = await getPartyBy(ctx, {});
          expect(party).to.be.ok;

          const activeLeaseWorkflowData = await getActiveLeaseWorkflowDataByPartyId(ctx, party.id);
          expect(activeLeaseWorkflowData).to.be.ok;
          expect(activeLeaseWorkflowData.leaseData.unitRent).to.equal(newUnitRent);
        });
      });

      describe('processing an entry with a received vacate date', () => {
        it('should mark the active lease as moving out', async () => {
          const vacateDate = now({ timezone: createdProperty.timezone }).add(5, 'days').startOf('day');
          const updateLeaseData = { leaseVacateDate: vacateDate };
          const dataToOverride = { updateLeaseData };

          const { savedEntry, property } = await updateSetup('import-resident-default-data.json', {}, dataToOverride);
          await runImport(ctx, savedEntry, property);

          const party = await getPartyBy(ctx, {});
          expect(party).to.be.ok;

          const activeLeaseWorkflowData = await getActiveLeaseWorkflowDataByPartyId(ctx, party.id);
          expect(activeLeaseWorkflowData).to.be.ok;
          const formattedVacateDate = parseDate(vacateDate, property.timezone);
          expect(activeLeaseWorkflowData.state).to.equal(DALTypes.ActiveLeaseState.MOVING_OUT);
          expect(activeLeaseWorkflowData.metadata.vacateDate).to.equal(formattedVacateDate);
        });
      });

      describe('processing an entry with a received evicted status', () => {
        it('should mark the active lease as moving out', async () => {
          const updateLeaseData = { isUnderEviction: true };
          const dataToOverride = { updateLeaseData };

          const { savedEntry, property } = await updateSetup('import-resident-default-data.json', {}, dataToOverride);
          await runImport(ctx, savedEntry, property);

          const party = await getPartyBy(ctx, {});
          expect(party).to.be.ok;

          const activeLeaseWorkflowData = await getActiveLeaseWorkflowDataByPartyId(ctx, party.id);
          expect(activeLeaseWorkflowData).to.be.ok;
          expect(activeLeaseWorkflowData.state).to.equal(DALTypes.ActiveLeaseState.MOVING_OUT);
          expect(activeLeaseWorkflowData.metadata.isUnderEviction).to.be.true;
        });
      });

      describe('processing an entry with a PastResident status', () => {
        it('should mark the active lease as moving out', async () => {
          const updateLeaseData = { status: DALTypes.PartyStateType.PASTRESIDENT };
          const dataToOverride = { updateLeaseData };

          const { savedEntry, property } = await updateSetup('import-resident-default-data.json', {}, dataToOverride);
          await runImport(ctx, savedEntry, property);

          const party = await getPartyBy(ctx, {});
          expect(party).to.be.ok;

          const activeLeaseWorkflowData = await getActiveLeaseWorkflowDataByPartyId(ctx, party.id);
          expect(activeLeaseWorkflowData).to.be.ok;
          expect(activeLeaseWorkflowData.state).to.equal(DALTypes.ActiveLeaseState.MOVING_OUT);
          expect(activeLeaseWorkflowData.metadata.moveOutConfirmed).to.be.true;
        });
      });

      describe('processing an entry where the vacate date was cancelled', () => {
        it('should cancel the moving out of the active lease', async () => {
          const party = await getPartyBy(ctx, {});
          expect(party).to.be.ok;

          const activeLeaseWorkflowData = await getActiveLeaseWorkflowDataByPartyId(ctx, party.id);
          expect(activeLeaseWorkflowData).to.be.ok;
          activeLeaseWorkflowData.metadata.vacateDate = now({ timezone: createdProperty.timezone }).add(5, 'days').startOf('day');
          activeLeaseWorkflowData.state = DALTypes.ActiveLeaseState.MOVING_OUT;
          await saveActiveLeaseWorkflowData(ctx, { ...activeLeaseWorkflowData });

          const { savedEntry, property } = await updateSetup('import-resident-default-data.json');
          await runImport(ctx, savedEntry, property);

          const updatedActiveLeaseWorkflowData = await getActiveLeaseWorkflowDataByPartyId(ctx, party.id);
          expect(updatedActiveLeaseWorkflowData).to.be.ok;
          expect(updatedActiveLeaseWorkflowData.metadata.vacateDate).to.be.undefined;
          expect(updatedActiveLeaseWorkflowData.state).to.equal(DALTypes.ActiveLeaseState.NONE);
        });
      });

      describe('processing an entry where the evicted flag was removed', () => {
        it('should cancel the moving out of the active lease', async () => {
          const party = await getPartyBy(ctx, {});
          expect(party).to.be.ok;

          const activeLeaseWorkflowData = await getActiveLeaseWorkflowDataByPartyId(ctx, party.id);
          expect(activeLeaseWorkflowData).to.be.ok;
          activeLeaseWorkflowData.metadata.isUnderEviction = true;
          activeLeaseWorkflowData.state = DALTypes.ActiveLeaseState.MOVING_OUT;
          await saveActiveLeaseWorkflowData(ctx, { ...activeLeaseWorkflowData });

          const { savedEntry, property } = await updateSetup('import-resident-default-data.json');
          await runImport(ctx, savedEntry, property);

          const updatedActiveLeaseWorkflowData = await getActiveLeaseWorkflowDataByPartyId(ctx, party.id);
          expect(updatedActiveLeaseWorkflowData).to.be.ok;
          expect(updatedActiveLeaseWorkflowData.metadata.isUnderEviction).to.be.undefined;
          expect(updatedActiveLeaseWorkflowData.state).to.equal(DALTypes.ActiveLeaseState.NONE);
        });
      });

      describe('processing an entry where the vacate date was cancelled but the status is still evicted', () => {
        it('should not cancel the moving out of the active lease', async () => {
          const party = await getPartyBy(ctx, {});
          expect(party).to.be.ok;

          const activeLeaseWorkflowData = await getActiveLeaseWorkflowDataByPartyId(ctx, party.id);
          expect(activeLeaseWorkflowData).to.be.ok;
          activeLeaseWorkflowData.metadata.vacateDate = now({ timezone: createdProperty.timezone }).add(5, 'days').startOf('day');
          activeLeaseWorkflowData.metadata.isUnderEviction = true;
          activeLeaseWorkflowData.state = DALTypes.ActiveLeaseState.MOVING_OUT;
          await saveActiveLeaseWorkflowData(ctx, { ...activeLeaseWorkflowData });

          const updateLeaseData = { isUnderEviction: true };
          const dataToOverride = { updateLeaseData };
          const { savedEntry, property } = await updateSetup('import-resident-default-data.json', {}, dataToOverride);
          await runImport(ctx, savedEntry, property);

          const updatedActiveLeaseWorkflowData = await getActiveLeaseWorkflowDataByPartyId(ctx, party.id);
          expect(updatedActiveLeaseWorkflowData).to.be.ok;
          expect(updatedActiveLeaseWorkflowData.metadata.vacateDate).to.be.not.null;
          expect(updatedActiveLeaseWorkflowData.metadata.isUnderEviction).to.be.true;
          expect(updatedActiveLeaseWorkflowData.state).to.equal(DALTypes.ActiveLeaseState.MOVING_OUT);
        });
      });

      describe('processing an entry where the evicted status was removed and the vacate date was not cancelled', () => {
        it('should not cancel the moving out of the active lease', async () => {
          const party = await getPartyBy(ctx, {});
          expect(party).to.be.ok;

          const activeLeaseWorkflowData = await getActiveLeaseWorkflowDataByPartyId(ctx, party.id);
          expect(activeLeaseWorkflowData).to.be.ok;
          const vacateDate = now({ timezone: createdProperty.timezone }).add(5, 'days').startOf('day');
          activeLeaseWorkflowData.metadata.vacateDate = vacateDate;
          activeLeaseWorkflowData.metadata.isUnderEviction = true;
          activeLeaseWorkflowData.state = DALTypes.ActiveLeaseState.MOVING_OUT;
          await saveActiveLeaseWorkflowData(ctx, { ...activeLeaseWorkflowData });

          const updateLeaseData = { leaseVacateDate: vacateDate };
          const dataToOverride = { updateLeaseData };
          const { savedEntry, property } = await updateSetup('import-resident-default-data.json', {}, dataToOverride);
          await runImport(ctx, savedEntry, property);

          const updatedActiveLeaseWorkflowData = await getActiveLeaseWorkflowDataByPartyId(ctx, party.id);
          expect(updatedActiveLeaseWorkflowData).to.be.ok;
          expect(updatedActiveLeaseWorkflowData.metadata.vacateDate).to.be.not.null;
          expect(updatedActiveLeaseWorkflowData.metadata.isUnderEviction).to.be.true;
          expect(updatedActiveLeaseWorkflowData.state).to.equal(DALTypes.ActiveLeaseState.MOVING_OUT);
        });
      });
    });
  });

  describe('SKIP PROCESS', () => {
    describe('processing an entry without a lease term', () => {
      it('should skip the process', async () => {
        const dataToOverride = { updateLeaseData: { leaseTerm: null } };
        const { property, savedEntry } = await setup('import-resident-default-data.json', {}, dataToOverride);
        const primaryExternalId = savedEntry.primaryExternalId;
        await runImport(ctx, savedEntry, property);

        const residentImportTracking = await getLastResidentImportTrackingByPrimaryExternalId(ctx, primaryExternalId);
        expect(residentImportTracking).to.be.ok;
        expect(residentImportTracking.status).to.equal(DALTypes.ResidentImportStatus.SKIPPED);
        expect(residentImportTracking.importResult.validations[0]).to.equal(importSkipReasons.NO_LEASE_TERM);
      });
    });

    describe('processing an entry without an existing inventory in Reva', () => {
      it('should skip the process', async () => {
        const dataToOverride = { updateLeaseData: { unitId: 'test' } };
        const { property, savedEntry } = await setup('import-resident-default-data.json', {}, dataToOverride);
        const primaryExternalId = savedEntry.primaryExternalId;
        await runImport(ctx, savedEntry, property);

        const residentImportTracking = await getLastResidentImportTrackingByPrimaryExternalId(ctx, primaryExternalId);
        expect(residentImportTracking).to.be.ok;
        expect(residentImportTracking.status).to.equal(DALTypes.ResidentImportStatus.SKIPPED);
        expect(residentImportTracking.importResult.validations[0]).to.equal(importSkipReasons.MISSING_UNIT);
      });
    });

    describe('processing a PastResident entry where is no new lease, active lease or renewal active', () => {
      it('should skip the process', async () => {
        const { property, savedEntry } = await setup('import-resident-default-data.json');
        await runImport(ctx, savedEntry, property);

        const party = await getPartyBy(ctx, {});
        expect(party).to.be.ok;
        expect(party.workflowState).to.equal(DALTypes.WorkflowState.ACTIVE);
        await archiveParty(ctx, party.id);

        const dataToOverride = { updateLeaseData: { status: DALTypes.PartyStateType.PASTRESIDENT } };
        const entry = await loadResidentsData('import-resident-default-data.json', {}, dataToOverride);
        const entryToImport = buildImportEntry(property.externalId, entry);
        const newSavedEntry = await saveImportEntry(ctx, entryToImport);
        await runImport(ctx, newSavedEntry, property);

        const residentImportTracking = await getLastResidentImportTrackingByPrimaryExternalId(ctx, newSavedEntry.primaryExternalId);
        expect(residentImportTracking).to.be.ok;
        expect(residentImportTracking.status).to.equal(DALTypes.ResidentImportStatus.SKIPPED);
        expect(residentImportTracking.importResult.validations[0]).to.equal(importSkipReasons.ACTIVE_LEASE_ENDED);
      });
    });

    describe('processing a PastResident entry where does not exists any party workflow associated', () => {
      it('should skip the process', async () => {
        const dataToOverride = { updateLeaseData: { status: DALTypes.PartyStateType.PASTRESIDENT } };
        const { property, savedEntry } = await setup('import-resident-default-data.json', {}, dataToOverride);
        const primaryExternalId = savedEntry.primaryExternalId;
        await runImport(ctx, savedEntry, property);

        const residentImportTracking = await getLastResidentImportTrackingByPrimaryExternalId(ctx, primaryExternalId);
        expect(residentImportTracking).to.be.ok;
        expect(residentImportTracking.status).to.equal(DALTypes.ResidentImportStatus.SKIPPED);
        expect(residentImportTracking.importResult.validations[0]).to.equal(importSkipReasons.MOVED_OUT);
      });
    });

    describe('processing an entry where we have an active lease active on the same unit', () => {
      it('should skip the process', async () => {
        const { property, savedEntry } = await setup('import-resident-default-data.json');
        await runImport(ctx, savedEntry, property);

        const entry = await loadResidentsData('import-resident-on-same-unit.json');
        const entryToImport = buildImportEntry(property.externalId, entry);
        const newSavedEntry = await saveImportEntry(ctx, entryToImport);
        await runImport(ctx, newSavedEntry, property);

        const residentImportTracking = await getLastResidentImportTrackingByPrimaryExternalId(ctx, newSavedEntry.primaryExternalId);
        expect(residentImportTracking).to.be.ok;
        expect(residentImportTracking.status).to.equal(DALTypes.ResidentImportStatus.SKIPPED);
        expect(residentImportTracking.importResult.validations[0]).to.equal(importSkipReasons.ACTIVE_LEASE_ON_SAME_UNIT);
      });
    });
  });
});
