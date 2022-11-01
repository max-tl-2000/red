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
import * as repoHelper from '../../testUtils/repoHelper';
import { buildImportEntry } from '../importActiveLeases/retrieve-data';
import { importSkipReasons } from '../../../common/enums/importSkipReasons';
import { processData } from '../importActiveLeases/process-data/process-data';
import { saveImportEntry, getLastResidentImportTrackingByPrimaryExternalId } from '../../dal/import-repo';
import { getAllExternalInfoByParty } from '../../dal/exportRepo';
import { getActiveLeaseWorkflowDataByPartyId, saveActiveLeaseWorkflowData } from '../../dal/activeLeaseWorkflowRepo';
import { getPartyBy, getPartyMembersByPartyIds, getAdditionalInfoByPartyAndType } from '../../dal/partyRepo';
import { getLastExceptionReportByExternalIdAndRuleId } from '../../dal/exceptionReportRepo';
import { parseDate } from '../importActiveLeases/process-data/helpers';
import { OtherExceptionReportRules } from '../../helpers/exceptionReportRules';
import { enhance } from '../../../common/helpers/contactInfoUtils';

const runImport = async (ctx, entry, property) =>
  await processData(ctx, { property, entries: [entry], forceSync: false, isInitialImport: false, forceSyncLeaseData: false });

describe('Import Yardi specific data', () => {
  const ctx = { tenantId: tenant.id, backendMode: DALTypes.BackendMode.YARDI };

  const createPropertyData = async () => {
    const settings = {
      renewals: { renewalCycleStart: 90 },
      integration: { import: { residentData: true, unitPricing: false } },
    };
    const property = await repoHelper.createAProperty(settings, { name: '13780' });
    const propertyId = property.id;
    await repoHelper.createADispatcher(propertyId);

    const leaseName = await repoHelper.createALeaseName(repoHelper.testCtx, { name: 'test-lease', propertyId });
    const inventoryGroup = await repoHelper.createAInventoryGroup({ propertyId, leaseNameId: leaseName.id });
    await repoHelper.createALeaseTerm({ termLength: 12, period: DALTypes.LeasePeriod.MONTH, propertyId, leaseNameId: leaseName.id });

    const building = await repoHelper.createABuilding({ name: '02', externalId: '02' });

    const oldInventory = await repoHelper.createAnInventory({
      name: '223',
      propertyId,
      buildingId: building.id,
      inventoryGroupId: inventoryGroup.id,
      externalId: '223',
    });

    const newInventory = await repoHelper.createAnInventory({
      name: '224',
      propertyId,
      buildingId: building.id,
      inventoryGroupId: inventoryGroup.id,
      externalId: '224',
    });

    return { property, oldInventory, newInventory };
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

  const setup = async (filename, property, dataToAdd, dataToOverride) => {
    const entry = await loadResidentsData(filename, dataToAdd, dataToOverride);

    const entryToImport = buildImportEntry(property.externalId, entry);
    return await saveImportEntry(ctx, entryToImport);
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

  let property;
  let newInventory;
  let oldInventory;

  beforeEach(async () => {
    const { property: createdProperty, oldInventory: oldCreatedInventory, newInventory: newCreatedInventory } = await createPropertyData();
    property = createdProperty;
    newInventory = newCreatedInventory;
    oldInventory = oldCreatedInventory;
  });

  describe('Importing an active lease with two members', () => {
    it('should insert two external info records where the primary has externalId and the roommate has externalRoommateId', async () => {
      const savedEntry = await setup('import-yardi-resident-default-data.json', property);

      await runImport(ctx, savedEntry, property);
      const party = await getPartyBy(ctx, {});
      expect(party).to.be.ok;

      const partyMembers = await getPartyMembersByPartyIds(ctx, [party.id]);
      expect(partyMembers).to.be.ok;
      expect(partyMembers).to.have.length(2);

      const primaryImportMember = savedEntry.rawData.members.find(m => m.id === savedEntry.primaryExternalId);
      const primaryMemberFullName = [primaryImportMember.firstName, primaryImportMember.lastName].join(' ');
      const primaryPartyMember = partyMembers.find(pm => pm.fullName === primaryMemberFullName);
      const roommate = partyMembers.find(pm => pm.fullName !== primaryMemberFullName);

      const externalInfo = await getAllExternalInfoByParty(ctx, party.id);
      expect(externalInfo).to.be.ok;
      expect(externalInfo).to.have.length(2);

      const primaryExternalInfo = externalInfo.find(ex => ex.partyMemberId === primaryPartyMember.id);
      const roommateExternalInfo = externalInfo.find(ex => ex.partyMemberId === roommate.id);

      expect(primaryExternalInfo.externalId).to.equal('000000001t');
      expect(primaryExternalInfo.externalProspectId).to.equal('000000001p');
      expect(primaryExternalInfo.externalRoommateId).to.be.null;
      expect(primaryExternalInfo.isPrimary).to.be.true;

      expect(roommateExternalInfo.externalRoommateId).to.equal('000000002r');
      expect(roommateExternalInfo.externalId).to.be.null;
      expect(roommateExternalInfo.externalProspectId).to.be.null;
      expect(roommateExternalInfo.isPrimary).to.be.false;
    });
  });

  describe('Importing an active lease where the lease start date changed', () => {
    it('should update the lease start date and remove the extension of the active lease', async () => {
      const leaseStartDate = now({ timezone: property.timezone }).add(1, 'day').startOf('day');
      const savedEntry = await setup('import-resident-default-data.json', property, {}, { updateLeaseData: { leaseStartDate } });
      await runImport(ctx, savedEntry, property);

      const party = await getPartyBy(ctx, {});
      expect(party).to.be.ok;

      const activeLeaseWorkflowData = await getActiveLeaseWorkflowDataByPartyId(ctx, party.id);
      expect(activeLeaseWorkflowData).to.be.ok;
      activeLeaseWorkflowData.leaseData.computedExtensionEndDate = now().add(3, 'month');
      activeLeaseWorkflowData.isExtension = true;
      await saveActiveLeaseWorkflowData(ctx, { ...activeLeaseWorkflowData });

      const newLeaseStartDate = now({ timezone: property.timezone }).add(2, 'month').startOf('day');
      const newSavedEntry = await setup('import-resident-default-data.json', property, {}, { updateLeaseData: { leaseStartDate: newLeaseStartDate } });
      await runImport(ctx, newSavedEntry, property);

      const updatedActiveLeaseWorkflowData = await getActiveLeaseWorkflowDataByPartyId(ctx, party.id);
      expect(updatedActiveLeaseWorkflowData).to.be.ok;

      const formattedNewLeaseStartDate = parseDate(newLeaseStartDate, property.timezone);
      expect(updatedActiveLeaseWorkflowData.leaseData.leaseStartDate).to.equal(formattedNewLeaseStartDate);
      expect(updatedActiveLeaseWorkflowData.isExtension).to.be.false;
    });
  });

  describe('Having a member with same fullName and email and different externalId', () => {
    it('should update the old externalId with an endDate and insert a new record with the new externalId', async () => {
      const oldExternalRoommateId = '000000003r';
      const newResident = buildNewMember({
        id: oldExternalRoommateId,
        type: DALTypes.ExternalMemberType.RESIDENT,
        lastName: 'Levine',
        firstName: 'Junior',
        email: 'user3+test@test.com',
        phone: '+16503381450',
      });
      const dataToAdd = { addMembers: [newResident] };

      const savedEntry = await setup('import-yardi-resident-default-data.json', property, dataToAdd);

      await runImport(ctx, savedEntry, property);
      const party = await getPartyBy(ctx, {});
      expect(party).to.be.ok;

      const partyMembers = await getPartyMembersByPartyIds(ctx, [party.id]);
      expect(partyMembers).to.be.ok;
      expect(partyMembers).to.have.length(3);

      const externalInfo = await getAllExternalInfoByParty(ctx, party.id);
      expect(externalInfo).to.be.ok;
      expect(externalInfo).to.have.length(3);

      const newExternalRoommateId = 'r000000003';
      dataToAdd.addMembers[0].id = newExternalRoommateId;
      dataToAdd.addMembers[0].phone = null;
      const newSavedEntry = await setup('import-yardi-resident-default-data.json', property, dataToAdd);
      await runImport(ctx, newSavedEntry, property);

      const updatedPartyMembers = await getPartyMembersByPartyIds(ctx, [party.id], { excludeInactive: false });
      expect(updatedPartyMembers).to.be.ok;
      expect(updatedPartyMembers).to.have.length(3);

      const updatedExternalInfo = await getAllExternalInfoByParty(ctx, party.id);
      expect(updatedExternalInfo).to.be.ok;
      expect(updatedExternalInfo).to.have.length(4);

      const oldExternalInfo = updatedExternalInfo.find(ex => ex.externalRoommateId === oldExternalRoommateId);
      const insertedExternalInfo = updatedExternalInfo.find(ex => ex.externalRoommateId === newExternalRoommateId);
      expect(oldExternalInfo.endDate).to.be.not.null;
      expect(insertedExternalInfo).to.be.ok;
      expect(insertedExternalInfo.endDate).to.be.null;
      expect(insertedExternalInfo.partyMemberId).to.equal(oldExternalInfo.partyMemberId);
    });
  });

  describe('Having a member with same fullName and phone and different externalId', () => {
    it('should update the old externalId with an endDate and insert a new record with the new externalId', async () => {
      const oldExternalRoommateId = '000000003r';
      const newResident = buildNewMember({
        id: oldExternalRoommateId,
        type: DALTypes.ExternalMemberType.RESIDENT,
        lastName: 'Levine',
        firstName: 'Junior',
        email: 'user3+test@test.com',
        phone: '+16503381450',
      });
      const dataToAdd = { addMembers: [newResident] };

      const savedEntry = await setup('import-yardi-resident-default-data.json', property, dataToAdd);

      await runImport(ctx, savedEntry, property);
      const party = await getPartyBy(ctx, {});
      expect(party).to.be.ok;

      const partyMembers = await getPartyMembersByPartyIds(ctx, [party.id]);
      expect(partyMembers).to.be.ok;
      expect(partyMembers).to.have.length(3);

      const externalInfo = await getAllExternalInfoByParty(ctx, party.id);
      expect(externalInfo).to.be.ok;
      expect(externalInfo).to.have.length(3);

      const newExternalRoommateId = 'r000000003';
      dataToAdd.addMembers[0].id = newExternalRoommateId;
      dataToAdd.addMembers[0].email = null;
      const newSavedEntry = await setup('import-yardi-resident-default-data.json', property, dataToAdd);
      await runImport(ctx, newSavedEntry, property);

      const updatedPartyMembers = await getPartyMembersByPartyIds(ctx, [party.id], { excludeInactive: false });
      expect(updatedPartyMembers).to.be.ok;
      expect(updatedPartyMembers).to.have.length(3);

      const updatedExternalInfo = await getAllExternalInfoByParty(ctx, party.id);
      expect(updatedExternalInfo).to.be.ok;
      expect(updatedExternalInfo).to.have.length(4);

      const oldExternalInfo = updatedExternalInfo.find(ex => ex.externalRoommateId === oldExternalRoommateId);
      const insertedExternalInfo = updatedExternalInfo.find(ex => ex.externalRoommateId === newExternalRoommateId);
      expect(oldExternalInfo.endDate).to.be.not.null;
      expect(insertedExternalInfo).to.be.ok;
      expect(insertedExternalInfo.endDate).to.be.null;
      expect(insertedExternalInfo.partyMemberId).to.equal(oldExternalInfo.partyMemberId);
    });
  });

  describe('Having a member with same fullName, email and phone and different externalId', () => {
    it('should update the old externalId with an endDate and insert a new record with the new externalId', async () => {
      const oldExternalRoommateId = '000000003r';
      const newResident = buildNewMember({
        id: oldExternalRoommateId,
        type: DALTypes.ExternalMemberType.RESIDENT,
        lastName: 'Levine',
        firstName: 'Junior',
        email: 'user3+test@test.com',
        phone: '+16503381450',
      });
      const dataToAdd = { addMembers: [newResident] };

      const savedEntry = await setup('import-yardi-resident-default-data.json', property, dataToAdd);

      await runImport(ctx, savedEntry, property);
      const party = await getPartyBy(ctx, {});
      expect(party).to.be.ok;

      const partyMembers = await getPartyMembersByPartyIds(ctx, [party.id]);
      expect(partyMembers).to.be.ok;
      expect(partyMembers).to.have.length(3);

      const externalInfo = await getAllExternalInfoByParty(ctx, party.id);
      expect(externalInfo).to.be.ok;
      expect(externalInfo).to.have.length(3);

      const newExternalRoommateId = 'r000000003';
      dataToAdd.addMembers[0].id = newExternalRoommateId;
      const newSavedEntry = await setup('import-yardi-resident-default-data.json', property, dataToAdd);
      await runImport(ctx, newSavedEntry, property);

      const updatedPartyMembers = await getPartyMembersByPartyIds(ctx, [party.id], { excludeInactive: false });
      expect(updatedPartyMembers).to.be.ok;
      expect(updatedPartyMembers).to.have.length(3);

      const updatedExternalInfo = await getAllExternalInfoByParty(ctx, party.id);
      expect(updatedExternalInfo).to.be.ok;
      expect(updatedExternalInfo).to.have.length(4);

      const oldExternalInfo = updatedExternalInfo.find(ex => ex.externalRoommateId === oldExternalRoommateId);
      const insertedExternalInfo = updatedExternalInfo.find(ex => ex.externalRoommateId === newExternalRoommateId);
      expect(oldExternalInfo.endDate).to.be.not.null;
      expect(insertedExternalInfo).to.be.ok;
      expect(insertedExternalInfo.endDate).to.be.null;
      expect(insertedExternalInfo.partyMemberId).to.equal(oldExternalInfo.partyMemberId);
    });
  });

  describe('Having a member with same fullName and different externalId', () => {
    it('should create a new member and mark with an end date the old one', async () => {
      const oldExternalRoommateId = '000000003r';
      const newResident = buildNewMember({
        id: oldExternalRoommateId,
        type: DALTypes.ExternalMemberType.RESIDENT,
        lastName: 'Levine',
        firstName: 'Junior',
        email: 'user3+test@test.com',
        phone: '+16503381450',
      });
      const dataToAdd = { addMembers: [newResident] };

      const savedEntry = await setup('import-yardi-resident-default-data.json', property, dataToAdd);

      await runImport(ctx, savedEntry, property);
      const party = await getPartyBy(ctx, {});
      expect(party).to.be.ok;

      const partyMembers = await getPartyMembersByPartyIds(ctx, [party.id]);
      expect(partyMembers).to.be.ok;
      expect(partyMembers).to.have.length(3);

      const externalInfo = await getAllExternalInfoByParty(ctx, party.id);
      expect(externalInfo).to.be.ok;
      expect(externalInfo).to.have.length(3);

      const newExternalRoommateId = 'r000000003';
      dataToAdd.addMembers[0].id = newExternalRoommateId;
      dataToAdd.addMembers[0].email = null;
      dataToAdd.addMembers[0].phone = null;
      const newSavedEntry = await setup('import-yardi-resident-default-data.json', property, dataToAdd);
      await runImport(ctx, newSavedEntry, property);

      const updatedPartyMembers = await getPartyMembersByPartyIds(ctx, [party.id], { excludeInactive: false });
      expect(updatedPartyMembers).to.be.ok;
      expect(updatedPartyMembers).to.have.length(4);
    });
  });

  describe('Having a contact info switch done in Yardi', () => {
    it('should update and create new external ids', async () => {
      const savedEntry = await setup('import-yardi-resident-default-data.json', property);
      await runImport(ctx, savedEntry, property);

      const party = await getPartyBy(ctx, {});
      expect(party).to.be.ok;

      const externalInfo = await getAllExternalInfoByParty(ctx, party.id);
      expect(externalInfo).to.be.ok;
      expect(externalInfo).to.have.length(2);

      const oldPrimaryExternalInfo = externalInfo.find(ex => !!ex.isPrimary);
      const oldRoommateExternalInfo = externalInfo.find(ex => !ex.isPrimary);

      const newSavedEntry = await setup('import-yardi-contact-info-switch.json', property);
      await runImport(ctx, newSavedEntry, property);

      const newExternalInfo = await getAllExternalInfoByParty(ctx, party.id);
      expect(newExternalInfo).to.be.ok;
      expect(newExternalInfo).to.have.length(4);

      const oldUpdatedPrimaryExternalInfo = newExternalInfo.find(ex => ex.id === oldPrimaryExternalInfo.id);
      expect(oldUpdatedPrimaryExternalInfo.endDate).to.be.not.null;

      const oldUpdatedRoommateExternalInfo = newExternalInfo.find(ex => ex.id === oldRoommateExternalInfo.id);
      expect(oldUpdatedRoommateExternalInfo.endDate).to.be.not.null;

      const newPrimaryExternalInfo = newExternalInfo.find(ex => ex.id !== oldPrimaryExternalInfo.id && ex.externalId === oldPrimaryExternalInfo.externalId);
      expect(newPrimaryExternalInfo.endDate).to.be.null;
      expect(newPrimaryExternalInfo.partyMemberId).to.equal(oldUpdatedRoommateExternalInfo.partyMemberId);
      expect(newPrimaryExternalInfo.metadata.isContactInfoSwitch).to.be.true;

      const newRoommateExternalInfo = newExternalInfo.find(
        ex => ex.id !== oldRoommateExternalInfo.id && ex.externalRoommateId === oldRoommateExternalInfo.externalRoommateId,
      );
      expect(newRoommateExternalInfo.endDate).to.be.null;
      expect(newRoommateExternalInfo.partyMemberId).to.equal(oldUpdatedPrimaryExternalInfo.partyMemberId);
      expect(newRoommateExternalInfo.metadata.isContactInfoSwitch).to.be.true;
    });
  });

  describe('Having two members with common contact info and same fullname', () => {
    it('should not update the external ids when we receive only one member from yardi', async () => {
      const savedEntry = await setup('import-yardi-resident-default-data.json', property);
      await runImport(ctx, savedEntry, property);

      const party = await getPartyBy(ctx, {});
      expect(party).to.be.ok;

      const externalInfo = await getAllExternalInfoByParty(ctx, party.id);
      expect(externalInfo).to.be.ok;
      expect(externalInfo).to.have.length(2);

      const contactInfo = enhance([{ type: 'phone', value: '12025550101' }]);
      const person = await repoHelper.createAPerson('Behati Levine', 'Behati', contactInfo);
      await repoHelper.createAPartyMember(party.id, { personId: person.id });

      const newSavedEntry = await setup('import-yardi-resident-default-data.json', property);
      await runImport(ctx, newSavedEntry, property);

      const newExternalInfo = await getAllExternalInfoByParty(ctx, party.id);
      expect(newExternalInfo).to.be.ok;
      expect(newExternalInfo).to.have.length(2);
    });
  });

  describe('Having a promoted roommate done in Yardi', () => {
    it('should update and create new external ids', async () => {
      const savedEntry = await setup('import-yardi-resident-default-data.json', property);
      await runImport(ctx, savedEntry, property);

      const party = await getPartyBy(ctx, {});
      expect(party).to.be.ok;

      const externalInfo = await getAllExternalInfoByParty(ctx, party.id);
      expect(externalInfo).to.be.ok;
      expect(externalInfo).to.have.length(2);

      const oldPrimaryExternalInfo = externalInfo.find(ex => !!ex.isPrimary);
      const oldRoommateExternalInfo = externalInfo.find(ex => !ex.isPrimary);

      const newSavedEntry = await setup('import-yardi-promote-roommate.json', property);
      await runImport(ctx, newSavedEntry, property);

      const newExternalInfo = await getAllExternalInfoByParty(ctx, party.id);
      expect(newExternalInfo).to.be.ok;
      expect(newExternalInfo).to.have.length(4);

      const oldUpdatedPrimaryExternalInfo = newExternalInfo.find(ex => ex.id === oldPrimaryExternalInfo.id);
      expect(oldUpdatedPrimaryExternalInfo.endDate).to.be.not.null;

      const oldUpdatedRoommateExternalInfo = newExternalInfo.find(ex => ex.id === oldRoommateExternalInfo.id);
      expect(oldUpdatedRoommateExternalInfo.endDate).to.be.not.null;

      const newPrimaryExternalInfo = newExternalInfo.find(ex => !!ex.isPrimary && !ex.endDate);
      expect(newPrimaryExternalInfo.externalId).to.equal(newSavedEntry.primaryExternalId);
      expect(newPrimaryExternalInfo.partyMemberId).to.equal(oldUpdatedRoommateExternalInfo.partyMemberId);
      expect(newPrimaryExternalInfo.metadata.isPrimarySwitch).to.be.true;

      const newRoommateExternalInfo = newExternalInfo.find(ex => !ex.isPrimary && !ex.endDate);
      const newRoommateId = newSavedEntry.rawData.members.find(m => m.id !== newSavedEntry.primaryExternalId).id;
      expect(newRoommateExternalInfo.externalRoommateId).to.equal(newRoommateId);
      expect(newRoommateExternalInfo.partyMemberId).to.equal(oldUpdatedPrimaryExternalInfo.partyMemberId);
      expect(newRoommateExternalInfo.metadata.isPrimarySwitch).to.be.true;
    });
  });

  describe('Having a promoted roommate done in Yardi', () => {
    it('should skip the PastResident record', async () => {
      const savedEntry = await setup('import-yardi-resident-default-data.json', property);
      await runImport(ctx, savedEntry, property);

      const newSavedEntry = await setup(
        'import-yardi-promote-roommate.json',
        property,
        { addLeaseData: { isPrimarySwitched: true } },
        { updateLeaseData: { status: DALTypes.PartyStateType.PASTRESIDENT } },
      );
      await runImport(ctx, newSavedEntry, property);

      const party = await getPartyBy(ctx, {});
      expect(party).to.be.ok;
      expect(party.workflowState).to.equal(DALTypes.WorkflowState.ACTIVE);

      const residentImportTracking = await getLastResidentImportTrackingByPrimaryExternalId(ctx, newSavedEntry.primaryExternalId);
      expect(residentImportTracking.status).to.equal(DALTypes.ResidentImportStatus.SKIPPED);
      expect(residentImportTracking.importResult.validations[0]).to.equal(importSkipReasons.NEW_RECORD_EXISTS);
    });
  });

  describe('Having a unit transfer done in Yardi', () => {
    it('should archive the old active lease and create a new one', async () => {
      const savedEntry = await setup('import-yardi-resident-default-data.json', property);
      await runImport(ctx, savedEntry, property);

      const party = await getPartyBy(ctx, {});
      expect(party).to.be.ok;

      const newSavedEntry = await setup('import-yardi-resident-default-data.json', property, {}, { updateLeaseData: { unitId: newInventory.externalId } });
      await runImport(ctx, newSavedEntry, property);

      const archivedParty = await getPartyBy(ctx, { workflowState: DALTypes.WorkflowState.ARCHIVED });
      const archivedActiveLeaseWorkflowData = await getActiveLeaseWorkflowDataByPartyId(ctx, archivedParty.id);
      expect(archivedActiveLeaseWorkflowData.leaseData.inventoryId).to.equal(oldInventory.id);

      const newParty = await getPartyBy(ctx, { workflowState: DALTypes.WorkflowState.ACTIVE });
      const newActiveLeaseWorkflowData = await getActiveLeaseWorkflowDataByPartyId(ctx, newParty.id);
      expect(newActiveLeaseWorkflowData.leaseData.inventoryId).to.equal(newInventory.id);
    });
  });

  describe('Having a unit transfer done in Yardi', () => {
    it('should create R23 exception report if the unit is already occupied', async () => {
      const savedEntry = await setup('import-yardi-resident-default-data.json', property);
      await runImport(ctx, savedEntry, property);

      const party = await getPartyBy(ctx, {});
      expect(party).to.be.ok;

      const activeLeaseWorkflowParty = await repoHelper.createAParty({ workflowName: DALTypes.WorkflowName.ACTIVE_LEASE, assignedPropertyId: property.id });
      await repoHelper.createActiveLeaseData({
        partyId: activeLeaseWorkflowParty.id,
        leaseData: { inventoryId: newInventory.id },
      });

      const newSavedEntry = await setup('import-yardi-resident-default-data.json', property, {}, { updateLeaseData: { unitId: newInventory.externalId } });
      await runImport(ctx, newSavedEntry, property);

      const importedParty = await getPartyBy(ctx, { id: party.id });
      expect(importedParty.workflowState).to.equal(DALTypes.WorkflowState.ACTIVE);

      const ruleId23 = OtherExceptionReportRules.ACTIVE_LEASE_ALREADY_EXISTS_FOR_INVENTORY.ruleId;
      const exceptionReport = await getLastExceptionReportByExternalIdAndRuleId(ctx, newSavedEntry.primaryExternalId, ruleId23);
      expect(exceptionReport).to.be.ok;
      expect(exceptionReport.conflictingRule).to.equal(OtherExceptionReportRules.ACTIVE_LEASE_ALREADY_EXISTS_FOR_INVENTORY.description);
    });
  });

  describe('Having pets and vehicles in the import entry from Yardi data', () => {
    it('should skip the processing of the values', async () => {
      const vehicles = [
        {
          make: 'Renault',
          color: 'black',
          model: 'Megane',
          state: 'RO',
          licensePlate: '89 SCH',
        },
      ];
      const pets = [
        {
          id: '1',
          name: 'Kara',
          size: 'Large',
          type: 'D',
          breed: null,
          weight: '0',
          serviceAnimalForSpecialNeeds: 'N',
        },
      ];
      const addLeaseData = { vehicles, pets };
      const dataToAdd = { addLeaseData };
      const savedEntry = await setup('import-resident-default-data.json', property, dataToAdd);
      await runImport(ctx, savedEntry, property);

      const party = await getPartyBy(ctx, {});
      expect(party).to.be.ok;

      const additionalPartyInfo = await getAdditionalInfoByPartyAndType(ctx, party.id);
      expect(additionalPartyInfo).to.have.length(0);
    });
  });

  describe('Having pets and vehicles in Reva and no additional info from Yardi', () => {
    it('should not override the additional info from the active lease', async () => {
      const savedEntry = await setup('import-resident-default-data.json', property);
      await runImport(ctx, savedEntry, property);

      const party = await getPartyBy(ctx, {});
      expect(party).to.be.ok;

      await repoHelper.createAPartyPet(party.id);
      await repoHelper.createAPartyVehicle(party.id);

      const additionalPartyInfo = await getAdditionalInfoByPartyAndType(ctx, party.id);
      expect(additionalPartyInfo).to.have.length(2);

      const newSavedEntry = await setup('import-resident-default-data.json', property);
      await runImport(ctx, newSavedEntry, property);

      const updatedAdditionalPartyInfo = await getAdditionalInfoByPartyAndType(ctx, party.id);
      expect(updatedAdditionalPartyInfo).to.have.length(2);
    });
  });

  describe('Having charges in Reva active lease and no charges received from Yardi data', () => {
    it('should not override the charges from the active lease', async () => {
      const savedEntry = await setup('import-resident-default-data.json', property);
      await runImport(ctx, savedEntry, property);

      const party = await getPartyBy(ctx, {});
      expect(party).to.be.ok;

      const activeLeaseWorkflowData = await getActiveLeaseWorkflowDataByPartyId(ctx, party.id);
      expect(activeLeaseWorkflowData).to.be.ok;
      expect(activeLeaseWorkflowData.recurringCharges).to.have.length(0);
      expect(activeLeaseWorkflowData.concessions).to.have.length(0);

      const recurringCharges = [
        {
          code: 'PET',
          amount: '70.00',
          endDate: null,
          inEffect: 'Y',
          quantity: 2,
          startDate: '2020-07-14T00:00:00',
          description: 'Pet Fees',
        },
      ];
      activeLeaseWorkflowData.recurringCharges = recurringCharges;
      await saveActiveLeaseWorkflowData(ctx, { ...activeLeaseWorkflowData });

      const newSavedEntry = await setup('import-resident-default-data.json', property);
      await runImport(ctx, newSavedEntry, property);

      const updatedActiveLeaseWorkflowData = await getActiveLeaseWorkflowDataByPartyId(ctx, party.id);
      expect(updatedActiveLeaseWorkflowData).to.be.ok;
      expect(updatedActiveLeaseWorkflowData.recurringCharges).to.have.length(1);
      expect(updatedActiveLeaseWorkflowData.concessions).to.have.length(0);
    });
  });
});
