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
import { enhance } from '../../../common/helpers/contactInfoUtils';
import { DALTypes } from '../../../common/enums/DALTypes';
import { AdditionalInfoTypes } from '../../../common/enums/partyTypes';
import * as repoHelper from '../../testUtils/repoHelper';
import { createRenewalPartyWithQuote } from '../../testUtils/partyWorkflowTestHelper';
import { workflowCycleProcessor } from '../../workers/party/workflowCycleHandler';
import { buildImportEntry } from '../importActiveLeases/retrieve-data';
import { processData } from '../importActiveLeases/process-data/process-data';
import { saveImportEntry } from '../../dal/import-repo';
import { getPartyBy, getPartyMembersByPartyIds, getRenewalPartyIdBySeedPartyId } from '../../dal/partyRepo';
import { getLastExceptionReportByExternalIdAndRuleId, getAllExceptionReports } from '../../dal/exceptionReportRepo';
import {
  MemberExceptionReportRules,
  PartyExceptionReportRules,
  OtherExceptionReportRules,
  ExceptionReportMetadataReplacement,
} from '../../helpers/exceptionReportRules';
import { getEPMIWithASpecificER } from '../../../resident/server/dal/external-party-member-repo';

const runImport = async (ctx, entry, property) =>
  await processData(ctx, { property, entries: [entry], forceSync: false, isInitialImport: false, forceSyncLeaseData: false });

describe('Exception report tests', () => {
  const ctx = { tenantId: tenant.id, backendMode: DALTypes.BackendMode.NONE };

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

    const building = await repoHelper.createABuilding({ name: '02' });

    const inventory = await repoHelper.createAnInventory({
      name: '223',
      propertyId,
      buildingId: building.id,
      inventoryGroupId: inventoryGroup.id,
      externalId: '223',
    });

    return { property, inventory };
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

  const startRenewalCycle = async () => {
    await repoHelper.toggleEnableRenewalsFeature(true);
    await workflowCycleProcessor(ctx);
  };

  const firstNameToImport = 'Adam';
  const lastNameToImport = 'Levine';
  const middleNameToImport = 'Noah';
  const emailToImport = 'user1+test@test.com';
  const phoneNumberToImport = '12025550130';
  const primaryExternalId = 'H000000001';
  let property;
  let inventory;

  beforeEach(async () => {
    const { property: createdProperty, inventory: createdInventory } = await createPropertyData();
    property = createdProperty;
    inventory = createdInventory;
  });

  describe('PERSON', () => {
    describe('Importing a person with email that already exists in another party', () => {
      it('should create the party, party member and person without adding the email', async () => {
        const contactInfo = enhance([{ type: 'email', value: emailToImport }]);
        await repoHelper.createAPerson('Test Test', 'Test', contactInfo);

        const savedEntry = await setup('import-resident-default-data.json', property);
        await runImport(ctx, savedEntry, property);

        const party = await getPartyBy(ctx, {});
        expect(party).to.be.ok;

        const partyMembers = await getPartyMembersByPartyIds(ctx, [party.id]);
        expect(partyMembers).to.be.ok;
        expect(partyMembers).to.have.length(1);

        const [partyMember] = partyMembers;
        expect(partyMember.fullName).to.equal('Adam Noah Levine');
        expect(partyMember.contactInfo.defaultPhone).to.equal('12025550130');
        expect(partyMember.contactInfo.defaultEmail).to.be.undefined;
        expect(partyMember.contactInfo.emails).to.deep.equal([]);
      });
    });

    describe('Importing a person with name and phone that already exists in another party', () => {
      it('should create the party member and link it to the conflicting person', async () => {
        const contactInfo = enhance([{ type: 'phone', value: phoneNumberToImport }]);
        const conflictingPerson = await repoHelper.createAPerson(
          [firstNameToImport, middleNameToImport, lastNameToImport].join(' '),
          firstNameToImport,
          contactInfo,
        );

        const savedEntry = await setup('import-resident-default-data.json', property);
        await runImport(ctx, savedEntry, property);

        const party = await getPartyBy(ctx, {});
        expect(party).to.be.ok;

        const partyMembers = await getPartyMembersByPartyIds(ctx, [party.id]);
        expect(partyMembers).to.be.ok;
        expect(partyMembers).to.have.length(1);

        const [partyMember] = partyMembers;
        expect(partyMember.fullName).to.equal([firstNameToImport, middleNameToImport, lastNameToImport].join(' '));
        expect(partyMember.contactInfo.defaultPhone).to.equal(phoneNumberToImport);
        expect(partyMember.personId).to.equal(conflictingPerson.id);
      });
    });

    describe('Importing a person with cleared phone', () => {
      it('should add R4 exception report details in EPMI table -> metadata', async () => {
        const firstImport = await setup('import-resident-default-data.json', property);
        await runImport(ctx, firstImport, property);

        const updatedMembers = [{ id: primaryExternalId, phone: '' }];
        const dataToOverride = { updatedMembers };

        const savedEntry = await setup('import-resident-default-data.json', property, {}, dataToOverride);
        await runImport(ctx, savedEntry, property);

        const ruleId4 = ExceptionReportMetadataReplacement.PHONE_CLEARED.ruleId;
        const externalMemberWithERDetails = await getEPMIWithASpecificER(ctx, savedEntry.primaryExternalId, ruleId4);

        expect(externalMemberWithERDetails).to.be.ok;
        expect(externalMemberWithERDetails.externalId).to.equal(savedEntry.primaryExternalId);
      });
    });

    describe('Importing a person with cleared email', () => {
      it('should add R5 exception report details in EPMI table -> metadata', async () => {
        const firstImport = await setup('import-resident-default-data.json', property);
        await runImport(ctx, firstImport, property);

        const updatedMembers = [{ id: primaryExternalId, email: '' }];
        const dataToOverride = { updatedMembers };

        const savedEntry = await setup('import-resident-default-data.json', property, {}, dataToOverride);
        await runImport(ctx, savedEntry, property);

        const ruleId5 = ExceptionReportMetadataReplacement.EMAIL_CLEARED.ruleId;
        const externalMemberWithERDetails = await getEPMIWithASpecificER(ctx, savedEntry.primaryExternalId, ruleId5);

        expect(externalMemberWithERDetails).to.be.ok;
        expect(externalMemberWithERDetails.externalId).to.equal(savedEntry.primaryExternalId);
      });
    });
  });

  describe('MEMBER', () => {
    describe('Importing a member with updated name when renewal party exists', () => {
      it('should create R6 exception report', async () => {
        const newLeaseEndDate = now({ timezone: property.timezone }).add(60, 'days').startOf('day');
        const updateLeaseData = { leaseEndDate: newLeaseEndDate };
        const overrideLeaseEndDate = { updateLeaseData };

        const firstImport = await setup('import-resident-default-data.json', property, {}, overrideLeaseEndDate);
        await runImport(ctx, firstImport, property);

        await startRenewalCycle();

        const updatedMembers = [{ id: primaryExternalId, firstName: 'Test' }];
        const dataToOverride = { updatedMembers, updateLeaseData };

        const savedEntry = await setup('import-resident-default-data.json', property, {}, dataToOverride);
        await runImport(ctx, savedEntry, property);

        const ruleId6 = MemberExceptionReportRules.NAME_UPDATED_AFTER_RENEWAL_START.ruleId;
        const exceptionReport = await getLastExceptionReportByExternalIdAndRuleId(ctx, savedEntry.primaryExternalId, ruleId6);
        expect(exceptionReport).to.be.ok;
        expect(exceptionReport.residentImportTrackingId).to.equal(savedEntry.id);
        expect(exceptionReport.conflictingRule).to.equal(MemberExceptionReportRules.NAME_UPDATED_AFTER_RENEWAL_START.description);
      });
    });

    describe('Importing a member with updated name that already exists, when renewal party is active', () => {
      it('should create R6 exception report', async () => {
        const newLeaseEndDate = now({ timezone: property.timezone }).add(60, 'days').startOf('day');
        const updateLeaseData = { leaseEndDate: newLeaseEndDate };
        const overrideData = { updateLeaseData };

        const firstImport = await setup('import-resident-default-data.json', property, {}, overrideData);
        await runImport(ctx, firstImport, property);

        await startRenewalCycle();

        await repoHelper.createAPerson('Test Test', 'Test');

        const updatedMembers = [{ id: primaryExternalId, firstName: 'Test', lastName: 'Test' }];
        const dataToOverride = { updatedMembers, updateLeaseData };

        const savedEntry = await setup('import-resident-default-data.json', property, {}, dataToOverride);
        await runImport(ctx, savedEntry, property);

        const ruleId6 = MemberExceptionReportRules.NAME_UPDATED_AFTER_RENEWAL_START.ruleId;
        const exceptionReport = await getLastExceptionReportByExternalIdAndRuleId(ctx, savedEntry.primaryExternalId, ruleId6);
        expect(exceptionReport).to.be.ok;
        expect(exceptionReport.residentImportTrackingId).to.equal(savedEntry.id);
        expect(exceptionReport.conflictingRule).to.equal(MemberExceptionReportRules.NAME_UPDATED_AFTER_RENEWAL_START.description);
      });
    });

    describe('Importing a member with updated name and phone that already exists, when renewal party is active', () => {
      it('should create R7 exception report', async () => {
        const newLeaseEndDate = now({ timezone: property.timezone }).add(60, 'days').startOf('day');
        const updateLeaseData = { leaseEndDate: newLeaseEndDate };

        const firstImport = await setup(
          'import-resident-default-data.json',
          property,
          {},
          { updateLeaseData, updatedMembers: [{ id: primaryExternalId, phone: '12025550101' }] },
        );
        await runImport(ctx, firstImport, property);

        await startRenewalCycle();

        const contactInfo = enhance([{ type: 'phone', value: phoneNumberToImport }]);
        await repoHelper.createAPerson('Test Test', 'Test', contactInfo);

        const updatedMembers = [{ id: primaryExternalId, firstName: 'Test', lastName: 'Test' }];
        const dataToOverride = { updatedMembers, updateLeaseData };

        const savedEntry = await setup('import-resident-default-data.json', property, {}, dataToOverride);
        await runImport(ctx, savedEntry, property);

        const ruleId7 = MemberExceptionReportRules.RESIDENT_UPDATE_WITH_EXISTING_NAME_AND_PHONE.ruleId;
        const exceptionReport = await getLastExceptionReportByExternalIdAndRuleId(ctx, savedEntry.primaryExternalId, ruleId7);
        expect(exceptionReport).to.be.ok;
        expect(exceptionReport.residentImportTrackingId).to.equal(savedEntry.id);
        expect(exceptionReport.conflictingRule).to.equal(MemberExceptionReportRules.RESIDENT_UPDATE_WITH_EXISTING_NAME_AND_PHONE.description);
      });
    });

    describe('Importing a member with updated vacate date when the renewal party is active', () => {
      it('should create R8 exception report', async () => {
        const newLeaseEndDate = now({ timezone: property.timezone }).add(60, 'days').startOf('day');
        const updateLeaseData = { leaseEndDate: newLeaseEndDate };
        const overrideLeaseEndDate = { updateLeaseData };

        const firstImport = await setup('import-resident-default-data.json', property, {}, overrideLeaseEndDate);
        await runImport(ctx, firstImport, property);

        await startRenewalCycle();

        const updatedMembers = [{ id: primaryExternalId, vacateDate: now().add(5, 'days') }];
        const dataToOverride = { updatedMembers, updateLeaseData };

        const savedEntry = await setup('import-resident-default-data.json', property, {}, dataToOverride);
        await runImport(ctx, savedEntry, property);

        const ruleId8 = MemberExceptionReportRules.OCCUPANT_VACATE_DATE_UPDATED_AFTER_RENEWAL_START.ruleId;
        const exceptionReport = await getLastExceptionReportByExternalIdAndRuleId(ctx, savedEntry.primaryExternalId, ruleId8);
        expect(exceptionReport).to.be.ok;
        expect(exceptionReport.residentImportTrackingId).to.equal(savedEntry.id);
        expect(exceptionReport.conflictingRule).to.equal(MemberExceptionReportRules.OCCUPANT_VACATE_DATE_UPDATED_AFTER_RENEWAL_START.description);
      });
    });

    describe('Importing a member with updated type when the renewal party is active', () => {
      it('should create R9 exception report', async () => {
        const newLeaseEndDate = now({ timezone: property.timezone }).add(60, 'days').startOf('day');
        const updateLeaseData = { leaseEndDate: newLeaseEndDate };
        const overrideLeaseEndDate = { updateLeaseData };

        const firstImport = await setup('import-resident-default-data.json', property, {}, overrideLeaseEndDate);
        await runImport(ctx, firstImport, property);

        await startRenewalCycle();

        const updatedMembers = [{ id: primaryExternalId, type: DALTypes.MemberType.GUARANTOR }];
        const dataToOverride = { updatedMembers, updateLeaseData };

        const savedEntry = await setup('import-resident-default-data.json', property, {}, dataToOverride);
        await runImport(ctx, savedEntry, property);

        const ruleId9 = ExceptionReportMetadataReplacement.MEMBER_TYPE_CHANGED_AFTER_RENEWAL_START.ruleId;
        const externalMemberWithERDetails = await getEPMIWithASpecificER(ctx, savedEntry.primaryExternalId, ruleId9);

        expect(externalMemberWithERDetails).to.be.ok;
        expect(externalMemberWithERDetails.externalId).to.equal(savedEntry.primaryExternalId);
      });
    });
  });

  describe('PARTY', () => {
    describe('Importing a new member when renewal party exists', () => {
      it('should create R10 exception report', async () => {
        const newLeaseEndDate = now({ timezone: property.timezone }).add(60, 'days').startOf('day');
        const updateLeaseData = { leaseEndDate: newLeaseEndDate };
        const dataToOverride = { updateLeaseData };

        const firstImport = await setup('import-resident-default-data.json', property, {}, dataToOverride);
        await runImport(ctx, firstImport, property);

        await startRenewalCycle();

        const newResident = buildNewMember({
          id: 'H000000002',
          type: DALTypes.ExternalMemberType.RESIDENT,
          lastName: 'Levine',
          firstName: 'Behati',
          vacateDate: null,
        });
        const dataToAdd = { addMembers: [newResident] };

        const savedEntry = await setup('import-resident-default-data.json', property, dataToAdd, dataToOverride);
        await runImport(ctx, savedEntry, property);

        const ruleId10 = PartyExceptionReportRules.NEW_RESIDENT_ADDED_AFTER_RENEWAL_START.ruleId;
        const exceptionReport = await getLastExceptionReportByExternalIdAndRuleId(ctx, newResident.id, ruleId10);
        expect(exceptionReport).to.be.ok;
        expect(exceptionReport.residentImportTrackingId).to.equal(savedEntry.id);
        expect(exceptionReport.conflictingRule).to.equal(PartyExceptionReportRules.NEW_RESIDENT_ADDED_AFTER_RENEWAL_START.description);
      });
    });

    describe('When a new member is imported for an active lease during renewal cycle', () => {
      it('should not create the R10 exception report if the member was also already manually added in the renewal party', async () => {
        const newLeaseEndDate = now({ timezone: property.timezone }).add(60, 'days').startOf('day');
        const updateLeaseData = { leaseEndDate: newLeaseEndDate };
        const dataToOverride = { updateLeaseData };

        const firstImport = await setup('import-resident-default-data.json', property, {}, dataToOverride);
        await runImport(ctx, firstImport, property);

        const party = await getPartyBy(ctx, {});
        expect(party).to.be.ok;

        await startRenewalCycle();

        const renewalPartyId = await getRenewalPartyIdBySeedPartyId(ctx, party.id);
        const newPerson = await repoHelper.createAPerson('Jan Oort', 'Jan');
        const contactInfo = [
          { type: DALTypes.ContactInfoType.PHONE, value: '12025550395', isPrimary: true },
          { type: DALTypes.ContactInfoType.EMAIL, value: 'jan@oort.com', isPrimary: true },
        ];

        await repoHelper.createAPersonContactInfo(newPerson.id, ...contactInfo);
        await repoHelper.createAPartyMember(renewalPartyId, { personId: newPerson.id });

        const partyMembers = await getPartyMembersByPartyIds(ctx, [renewalPartyId]);
        expect(partyMembers).to.be.ok;

        const newResident = buildNewMember({
          id: 'H000000002',
          type: DALTypes.ExternalMemberType.RESIDENT,
          lastName: 'Oort',
          firstName: 'Jan',
          email: 'jan@oort.com',
          vacateDate: null,
        });
        const dataToAdd = { addMembers: [newResident] };
        const savedEntry = await setup('import-resident-default-data.json', property, dataToAdd, dataToOverride);

        await runImport(ctx, savedEntry, property);

        const ruleId10 = PartyExceptionReportRules.NEW_RESIDENT_ADDED_AFTER_RENEWAL_START.ruleId;
        const exceptionReport = await getLastExceptionReportByExternalIdAndRuleId(ctx, newResident.id, ruleId10);
        expect(exceptionReport).to.not.be.ok;
      });

      it('should mark the last R10 exception report as ignored after the member is manually added in the renewal party and the match is based on name and email addres', async () => {
        const newLeaseEndDate = now({ timezone: property.timezone }).add(60, 'days').startOf('day');
        const updateLeaseData = { leaseEndDate: newLeaseEndDate };
        const dataToOverride = { updateLeaseData };

        const firstImport = await setup('import-resident-default-data.json', property, {}, dataToOverride);
        await runImport(ctx, firstImport, property);

        const party = await getPartyBy(ctx, {});
        expect(party).to.be.ok;

        await startRenewalCycle();

        const newResident = buildNewMember({
          id: 'H000000002',
          type: DALTypes.ExternalMemberType.RESIDENT,
          lastName: 'Oort',
          firstName: 'Jan',
          email: 'jan@oort.com',
          vacateDate: null,
        });
        const dataToAdd = { addMembers: [newResident] };
        const savedEntry = await setup('import-resident-default-data.json', property, dataToAdd, dataToOverride);

        await runImport(ctx, savedEntry, property);

        const ruleId10 = PartyExceptionReportRules.NEW_RESIDENT_ADDED_AFTER_RENEWAL_START.ruleId;
        const exceptionReport = await getLastExceptionReportByExternalIdAndRuleId(ctx, newResident.id, ruleId10);

        expect(exceptionReport).to.be.ok;
        expect(exceptionReport.conflictingRule).to.equal(PartyExceptionReportRules.NEW_RESIDENT_ADDED_AFTER_RENEWAL_START.description);

        const renewalPartyId = await getRenewalPartyIdBySeedPartyId(ctx, party.id);
        const newPerson = await repoHelper.createAPerson('Jan Oort', 'Jan');
        const contactInfo = [
          { type: DALTypes.ContactInfoType.PHONE, value: '12025550395', isPrimary: true },
          { type: DALTypes.ContactInfoType.EMAIL, value: 'jan@oort.com', isPrimary: true },
        ];

        await repoHelper.createAPersonContactInfo(newPerson.id, ...contactInfo);
        await repoHelper.createAPartyMember(renewalPartyId, { personId: newPerson.id });

        const partyMembers = await getPartyMembersByPartyIds(ctx, [renewalPartyId]);
        expect(partyMembers).to.be.ok;

        await runImport(ctx, savedEntry, property);

        const lastExceptionReport = await getLastExceptionReportByExternalIdAndRuleId(ctx, newResident.id, ruleId10);
        expect(lastExceptionReport).to.be.ok;
        expect(lastExceptionReport.id).to.equal(exceptionReport.id);
        expect(lastExceptionReport.ignore).to.equal(true);
        expect(lastExceptionReport.ignoreReason).to.not.be.null;
      });

      it('should mark the last R10 exception report as ignored after the member is manually added in the renewal party and the match is based on name and phone number', async () => {
        const newLeaseEndDate = now({ timezone: property.timezone }).add(60, 'days').startOf('day');
        const updateLeaseData = { leaseEndDate: newLeaseEndDate };
        const dataToOverride = { updateLeaseData };

        const firstImport = await setup('import-resident-default-data.json', property, {}, dataToOverride);
        await runImport(ctx, firstImport, property);

        const party = await getPartyBy(ctx, {});
        expect(party).to.be.ok;

        await startRenewalCycle();

        const newResident = buildNewMember({
          id: 'H000000002',
          type: DALTypes.ExternalMemberType.RESIDENT,
          lastName: 'Oort',
          firstName: 'Jan',
          phone: '12025550395',
          vacateDate: null,
        });
        const dataToAdd = { addMembers: [newResident] };
        const savedEntry = await setup('import-resident-default-data.json', property, dataToAdd, dataToOverride);

        await runImport(ctx, savedEntry, property);

        const ruleId10 = PartyExceptionReportRules.NEW_RESIDENT_ADDED_AFTER_RENEWAL_START.ruleId;
        const exceptionReport = await getLastExceptionReportByExternalIdAndRuleId(ctx, newResident.id, ruleId10);
        expect(exceptionReport).to.be.ok;
        expect(exceptionReport.conflictingRule).to.equal(PartyExceptionReportRules.NEW_RESIDENT_ADDED_AFTER_RENEWAL_START.description);

        const renewalPartyId = await getRenewalPartyIdBySeedPartyId(ctx, party.id);
        const newPerson = await repoHelper.createAPerson('Jan Oort', 'Jan');
        const contactInfo = [
          { type: DALTypes.ContactInfoType.PHONE, value: '12025550395', isPrimary: true },
          { type: DALTypes.ContactInfoType.EMAIL, value: 'cust+jan_oort@reva.tech', isPrimary: true },
        ];

        await repoHelper.createAPersonContactInfo(newPerson.id, ...contactInfo);
        await repoHelper.createAPartyMember(renewalPartyId, { personId: newPerson.id });

        const partyMembers = await getPartyMembersByPartyIds(ctx, [renewalPartyId]);
        expect(partyMembers).to.be.ok;

        await runImport(ctx, savedEntry, property);

        const lastExceptionReport = await getLastExceptionReportByExternalIdAndRuleId(ctx, newResident.id, ruleId10);
        expect(lastExceptionReport).to.be.ok;
        expect(lastExceptionReport.id).to.equal(exceptionReport.id);
        expect(lastExceptionReport.ignore).to.equal(true);
        expect(lastExceptionReport.ignoreReason).to.not.be.null;
      });

      it('should mark the last R10 exception report as ignored after the member is manually added in the renewal party and the match is based on name for child members', async () => {
        const newLeaseEndDate = now({ timezone: property.timezone }).add(60, 'days').startOf('day');
        const updateLeaseData = { leaseEndDate: newLeaseEndDate };
        const dataToOverride = { updateLeaseData };

        const firstImport = await setup('import-resident-default-data.json', property, {}, dataToOverride);
        await runImport(ctx, firstImport, property);

        const party = await getPartyBy(ctx, {});
        expect(party).to.be.ok;

        await startRenewalCycle();

        const newResident = buildNewMember({
          id: 'H000000004',
          type: DALTypes.ExternalMemberType.CHILD,
          lastName: 'Oort Jr',
          firstName: 'Jan',
        });
        const dataToAdd = { addMembers: [newResident] };
        const savedEntry = await setup('import-resident-default-data.json', property, dataToAdd, dataToOverride);

        await runImport(ctx, savedEntry, property);

        const ruleId10 = PartyExceptionReportRules.NEW_RESIDENT_ADDED_AFTER_RENEWAL_START.ruleId;
        const exceptionReport = await getLastExceptionReportByExternalIdAndRuleId(ctx, newResident.id, ruleId10);

        expect(exceptionReport).to.be.ok;
        expect(exceptionReport.conflictingRule).to.equal(PartyExceptionReportRules.NEW_RESIDENT_ADDED_AFTER_RENEWAL_START.description);

        const renewalPartyId = await getRenewalPartyIdBySeedPartyId(ctx, party.id);
        const childInfo = {
          type: AdditionalInfoTypes.CHILD,
          info: {
            fullName: 'Jan Oort Jr',
            preferredName: 'Oorty',
          },
        };
        await repoHelper.createAPartyChild(renewalPartyId, childInfo);
        await runImport(ctx, savedEntry, property);

        const lastExceptionReport = await getLastExceptionReportByExternalIdAndRuleId(ctx, newResident.id, ruleId10);
        expect(lastExceptionReport).to.be.ok;
        expect(lastExceptionReport.id).to.equal(exceptionReport.id);
        expect(lastExceptionReport.ignore).to.equal(true);
        expect(lastExceptionReport.ignoreReason).to.not.be.null;
      });
    });

    describe('Importing an updated lease end date when renewal party exists', () => {
      it('should create R12 exception report', async () => {
        const newLeaseEndDate = now({ timezone: property.timezone }).add(60, 'days').startOf('day');
        const updateLeaseData = { leaseEndDate: newLeaseEndDate };
        const dataToOverride = { updateLeaseData };

        const firstImport = await setup('import-resident-default-data.json', property, {}, dataToOverride);
        await runImport(ctx, firstImport, property);

        await startRenewalCycle();

        const updatedLeaseEndDate = now({ timezone: property.timezone }).add(30, 'days').startOf('day');
        const updatedDataToOverride = { updateLeaseData: { leaseEndDate: updatedLeaseEndDate } };

        const savedEntry = await setup('import-resident-default-data.json', property, {}, updatedDataToOverride);
        await runImport(ctx, savedEntry, property);

        const ruleId12 = PartyExceptionReportRules.LEASE_END_DATE_UPDATE_AFTER_RENEWAL_START.ruleId;
        const exceptionReport = await getLastExceptionReportByExternalIdAndRuleId(ctx, savedEntry.primaryExternalId, ruleId12);
        expect(exceptionReport).to.be.ok;
        expect(exceptionReport.residentImportTrackingId).to.equal(savedEntry.id);
        expect(exceptionReport.conflictingRule).to.equal(PartyExceptionReportRules.LEASE_END_DATE_UPDATE_AFTER_RENEWAL_START.description);
      });
    });

    describe('Importing an updated lease term when renewal party exists', () => {
      it('should create R15 exception report', async () => {
        const newLeaseEndDate = now({ timezone: property.timezone }).add(60, 'days').startOf('day');
        const updateLeaseData = { leaseEndDate: newLeaseEndDate };
        const dataToOverride = { updateLeaseData };

        const firstImport = await setup('import-resident-default-data.json', property, {}, dataToOverride);
        await runImport(ctx, firstImport, property);

        await startRenewalCycle();

        const updatedLeaseTerm = now({ timezone: property.timezone }).add(30, 'days').startOf('day');
        const updatedDataToOverride = { updateLeaseData: { leaseEndDate: newLeaseEndDate, leaseTerm: updatedLeaseTerm } };

        const savedEntry = await setup('import-resident-default-data.json', property, {}, updatedDataToOverride);
        await runImport(ctx, savedEntry, property);

        const ruleId15 = PartyExceptionReportRules.LEASE_TERM_UPDATED_AFTER_RENEWAL_START.ruleId;
        const exceptionReport = await getLastExceptionReportByExternalIdAndRuleId(ctx, savedEntry.primaryExternalId, ruleId15);
        expect(exceptionReport).to.be.ok;
        expect(exceptionReport.residentImportTrackingId).to.equal(savedEntry.id);
        expect(exceptionReport.conflictingRule).to.equal(PartyExceptionReportRules.LEASE_TERM_UPDATED_AFTER_RENEWAL_START.description);
      });
    });
  });

  describe('OTHER', () => {
    describe('Importing a deleted member when renewal party exists', () => {
      it('should create R18 exception report', async () => {
        const newLeaseEndDate = now({ timezone: property.timezone }).add(60, 'days').startOf('day');
        const updateLeaseData = { leaseEndDate: newLeaseEndDate };
        const dataToOverride = { updateLeaseData };

        const newResident = buildNewMember({
          id: 'H000000002',
          type: DALTypes.ExternalMemberType.RESIDENT,
          lastName: 'Levine',
          firstName: 'Behati',
          vacateDate: null,
        });
        const dataToAdd = { addMembers: [newResident] };

        const firstImport = await setup('import-resident-default-data.json', property, dataToAdd, dataToOverride);
        await runImport(ctx, firstImport, property);

        await startRenewalCycle();

        const savedEntry = await setup('import-resident-default-data.json', property, {}, dataToOverride);
        await runImport(ctx, savedEntry, property);

        const ruleId18 = OtherExceptionReportRules.DELETED_MEMBERS_AFTER_RENEWAL_START.ruleId;
        const exceptionReport = await getLastExceptionReportByExternalIdAndRuleId(ctx, savedEntry.primaryExternalId, ruleId18);
        expect(exceptionReport).to.be.ok;
        expect(exceptionReport.conflictingRule).to.equal(OtherExceptionReportRules.DELETED_MEMBERS_AFTER_RENEWAL_START.description);
      });
    });

    describe('Processing a 1 month active lease that should spawn a MTM active lease without 1 month lease term', () => {
      it('should create R22 exception report', async () => {
        const activeLeaseWorkflowParty = await repoHelper.createAParty({ workflowName: DALTypes.WorkflowName.ACTIVE_LEASE, assignedPropertyId: property.id });
        await repoHelper.createActiveLeaseData({
          partyId: activeLeaseWorkflowParty.id,
          leaseData: { leaseEndDate: now().add(-1, 'days'), leaseTerm: 1, inventoryId: inventory.id },
        });
        await createRenewalPartyWithQuote({ activeLeasePartyId: activeLeaseWorkflowParty.id, inventoryId: inventory.id });

        await workflowCycleProcessor(ctx);

        const ruleId22 = OtherExceptionReportRules.NO_ONE_MONTH_LEASE_TERM.ruleId;
        const exceptionReports = await getAllExceptionReports(ctx);
        expect(exceptionReports).to.have.length(1);
        expect(exceptionReports[0].ruleId).to.equal(ruleId22);
        expect(exceptionReports[0].conflictingRule).to.equal(OtherExceptionReportRules.NO_ONE_MONTH_LEASE_TERM.description);
      });
    });

    describe('Importing an active lease for which we already have another active lease active on the same unit', () => {
      it('should created R23 exception report', async () => {
        const entry = await setup('import-resident-default-data.json', property);
        await runImport(ctx, entry, property);

        const newEntry = await setup('import-resident-on-same-unit.json', property);
        await runImport(ctx, newEntry, property);

        const ruleId23 = OtherExceptionReportRules.ACTIVE_LEASE_ALREADY_EXISTS_FOR_INVENTORY.ruleId;
        const exceptionReport = await getLastExceptionReportByExternalIdAndRuleId(ctx, newEntry.primaryExternalId, ruleId23);
        expect(exceptionReport).to.be.ok;
        expect(exceptionReport.conflictingRule).to.equal(OtherExceptionReportRules.ACTIVE_LEASE_ALREADY_EXISTS_FOR_INVENTORY.description);
      });
    });
  });
});
