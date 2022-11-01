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
import { AdditionalInfoTypes } from '../../../common/enums/partyTypes';
import { PetTypes } from '../../../common/enums/petTypes';
import { workflowCycleProcessor } from '../../workers/party/workflowCycleHandler';
import { processData } from '../importActiveLeases/process-data/process-data';
import { saveImportEntry } from '../../dal/import-repo';
import { getAllExternalInfoByParty } from '../../dal/exportRepo';
import { PartyExceptionReportRules } from '../../helpers/exceptionReportRules';
import { getActiveLeaseWorkflowDataByPartyId, saveActiveLeaseWorkflowData } from '../../dal/activeLeaseWorkflowRepo';
import { getPartyBy, getAdditionalInfoByPartyAndType } from '../../dal/partyRepo';
import { getLastExceptionReportByExternalIdAndRuleId } from '../../dal/exceptionReportRepo';
import { parseDate } from '../importActiveLeases/process-data/helpers';

const runImport = async (ctx, entry, property) =>
  await processData(ctx, { property, entries: [entry], forceSync: false, isInitialImport: false, forceSyncLeaseData: false });

describe('Import MRI specific data', () => {
  const ctx = { tenantId: tenant.id, backendMode: DALTypes.BackendMode.MRI };
  let inventory;

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

    inventory = await repoHelper.createAnInventory({
      name: '223',
      propertyId,
      buildingId: building.id,
      inventoryGroupId: inventoryGroup.id,
      externalId: '223',
    });

    await repoHelper.createAnInventory({
      name: '224',
      propertyId,
      buildingId: building.id,
      inventoryGroupId: inventoryGroup.id,
      externalId: '224',
    });

    return { property };
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

  const startRenewalCycle = async () => {
    await repoHelper.toggleEnableRenewalsFeature(true);
    await workflowCycleProcessor(ctx);
  };

  let property;

  beforeEach(async () => {
    const { property: createdProperty } = await createPropertyData();
    property = createdProperty;
  });

  describe('Importing an active lease with pets and vehicles', () => {
    it('should create the party additional info', async () => {
      const savedEntry = await setup('import-mri-resident-default-data.json', property);
      await runImport(ctx, savedEntry, property);

      const party = await getPartyBy(ctx, {});
      expect(party).to.be.ok;

      const additionalPartyInfo = await getAdditionalInfoByPartyAndType(ctx, party.id);
      expect(additionalPartyInfo).to.have.length(2);

      const pets = additionalPartyInfo.filter(ad => ad.type === AdditionalInfoTypes.PET);
      expect(pets).to.have.length(1);
      const vehicles = additionalPartyInfo.filter(ad => ad.type === AdditionalInfoTypes.VEHICLE);
      expect(vehicles).to.have.length(1);
    });
  });

  describe('Importing an active lease with updated pets and vehicles', () => {
    it('should update the party additional info', async () => {
      const vehicles = [
        {
          make: 'Audi',
          color: 'black',
          model: 'A4',
          state: 'RO',
          licensePlate: '90 SCH',
        },
      ];
      const pets = [
        {
          id: '1',
          name: 'Luna',
          size: 'Large',
          type: 'C',
          breed: null,
          weight: '0',
          serviceAnimalForSpecialNeeds: 'N',
        },
      ];

      const addLeaseData = { vehicles, pets };
      const dataToAdd = { addLeaseData };
      const savedEntry = await setup('import-mri-resident-default-data.json', property, dataToAdd);
      await runImport(ctx, savedEntry, property);

      dataToAdd.addLeaseData.vehicles[0].model = 'A8';
      dataToAdd.addLeaseData.pets[0].name = 'Bella';

      const updatedSavedEntry = await setup('import-mri-resident-default-data.json', property, dataToAdd);
      await runImport(ctx, updatedSavedEntry, property);

      const party = await getPartyBy(ctx, {});
      expect(party).to.be.ok;

      const additionalPartyInfo = await getAdditionalInfoByPartyAndType(ctx, party.id);
      expect(additionalPartyInfo).to.have.length(2);

      const updatedPet = additionalPartyInfo.find(ad => ad.type === AdditionalInfoTypes.PET && ad.info.type === PetTypes.CAT);
      expect(updatedPet.info.name).to.equal('Bella');
      const updatedVehicle = additionalPartyInfo.find(ad => ad.type === AdditionalInfoTypes.VEHICLE && ad.info.tagNumber === '90 SCH');
      expect(updatedVehicle.info.makeAndModel).to.equal('Audi A8');
    });
  });

  describe('Importing an active lease with removed pets and vehicles', () => {
    it('should mark with endDate the party additional info', async () => {
      const savedEntry = await setup('import-mri-resident-default-data.json', property);
      await runImport(ctx, savedEntry, property);

      const dataToOverride = { updateLeaseData: { vehicles: [], pets: [] } };
      const newSavedEntry = await setup('import-mri-resident-default-data.json', property, {}, dataToOverride);
      await runImport(ctx, newSavedEntry, property);

      const party = await getPartyBy(ctx, {});
      expect(party).to.be.ok;

      const additionalPartyInfo = await getAdditionalInfoByPartyAndType(ctx, party.id);
      expect(additionalPartyInfo).to.have.length(0);
    });
  });

  describe('Importing an active lease with charges', () => {
    it('should insert the charges in active lease workflow data', async () => {
      const savedEntry = await setup('import-mri-resident-default-data.json', property);
      await runImport(ctx, savedEntry, property);

      const party = await getPartyBy(ctx, {});
      expect(party).to.be.ok;

      const activeLeaseWorkflowData = await getActiveLeaseWorkflowDataByPartyId(ctx, party.id);
      expect(activeLeaseWorkflowData.leaseData.unitRent).to.equal(1125);
      expect(activeLeaseWorkflowData.concessions).to.have.length(1);
      expect(activeLeaseWorkflowData.recurringCharges).to.have.length(1);
    });
  });

  describe('Importing an active lease with updated charges', () => {
    it('should update the charges in active lease workflow data', async () => {
      const savedEntry = await setup('import-mri-resident-default-data.json', property);
      await runImport(ctx, savedEntry, property);

      const dataToOverride = {
        updateLeaseData: {
          recurringCharges: [
            {
              code: 'RNT',
              amount: '1125.00',
              endDate: null,
              inEffect: 'Y',
              quantity: 1,
              startDate: '2020-07-14T00:00:00',
              description: 'Rent',
            },
          ],
        },
      };
      const newSavedEntry = await setup('import-mri-resident-default-data.json', property, {}, dataToOverride);
      await runImport(ctx, newSavedEntry, property);

      const party = await getPartyBy(ctx, {});
      expect(party).to.be.ok;

      const activeLeaseWorkflowData = await getActiveLeaseWorkflowDataByPartyId(ctx, party.id);
      expect(activeLeaseWorkflowData.leaseData.unitRent).to.equal(1125);
      expect(activeLeaseWorkflowData.concessions).to.have.length(0);
      expect(activeLeaseWorkflowData.recurringCharges).to.have.length(0);
    });
  });

  describe('Importing an active lease with updated RNT amount', () => {
    it('should update the unitRent', async () => {
      const savedEntry = await setup('import-mri-resident-default-data.json', property);
      await runImport(ctx, savedEntry, property);

      const dataToOverride = {
        updateLeaseData: {
          recurringCharges: [
            {
              code: 'RNT',
              amount: '2025.00',
              endDate: null,
              inEffect: 'Y',
              quantity: 1,
              startDate: '2020-07-14T00:00:00',
              description: 'Rent',
            },
          ],
        },
      };
      const newSavedEntry = await setup('import-mri-resident-default-data.json', property, {}, dataToOverride);
      await runImport(ctx, newSavedEntry, property);

      const party = await getPartyBy(ctx, {});
      expect(party).to.be.ok;

      const activeLeaseWorkflowData = await getActiveLeaseWorkflowDataByPartyId(ctx, party.id);
      expect(activeLeaseWorkflowData.leaseData.unitRent).to.equal(2025);
    });
  });

  describe('Exception reports', () => {
    describe('Importing an active lease with updated recurring charges when renewal cycle started', () => {
      it('should create R13 exception report', async () => {
        const newLeaseEndDate = now({ timezone: property.timezone }).add(60, 'days').startOf('day');
        const savedEntry = await setup('import-mri-resident-default-data.json', property, {}, { updateLeaseData: { leaseEndDate: newLeaseEndDate } });
        await runImport(ctx, savedEntry, property);

        await startRenewalCycle();

        const dataToOverride = {
          updateLeaseData: {
            recurringCharges: [
              {
                code: 'RNT',
                amount: '2025.00',
                endDate: null,
                inEffect: 'Y',
                quantity: 1,
                startDate: '2020-07-14T00:00:00',
                description: 'Rent',
              },
            ],
            leaseEndDate: newLeaseEndDate,
          },
        };
        const newSavedEntry = await setup('import-mri-resident-default-data.json', property, {}, dataToOverride);
        await runImport(ctx, newSavedEntry, property);

        const ruleId13 = PartyExceptionReportRules.RECURRING_CHARGES_UPDATED_AFTER_RENEWAL_START.ruleId;
        const exceptionReport = await getLastExceptionReportByExternalIdAndRuleId(ctx, newSavedEntry.primaryExternalId, ruleId13);
        expect(exceptionReport).to.be.ok;
        expect(exceptionReport.residentImportTrackingId).to.equal(newSavedEntry.id);
        expect(exceptionReport.conflictingRule).to.equal(PartyExceptionReportRules.RECURRING_CHARGES_UPDATED_AFTER_RENEWAL_START.description);
      });
    });

    describe('Importing an active lease with updated concessions when renewal cycle started', () => {
      it('should create R14 exception report', async () => {
        const newLeaseEndDate = now({ timezone: property.timezone }).add(60, 'days').startOf('day');
        const savedEntry = await setup('import-mri-resident-default-data.json', property, {}, { updateLeaseData: { leaseEndDate: newLeaseEndDate } });
        await runImport(ctx, savedEntry, property);

        await startRenewalCycle();

        const dataToOverride = {
          updateLeaseData: {
            recurringCharges: [
              {
                code: 'RNT',
                amount: '2025.00',
                endDate: null,
                inEffect: 'Y',
                quantity: 1,
                startDate: '2020-07-14T00:00:00',
                description: 'Rent',
              },
            ],
            leaseEndDate: newLeaseEndDate,
          },
        };
        const newSavedEntry = await setup('import-mri-resident-default-data.json', property, {}, dataToOverride);
        await runImport(ctx, newSavedEntry, property);

        const ruleId14 = PartyExceptionReportRules.CONCESSIONS_UPDATED_AFTER_RENEWAL_START.ruleId;
        const exceptionReport = await getLastExceptionReportByExternalIdAndRuleId(ctx, newSavedEntry.primaryExternalId, ruleId14);
        expect(exceptionReport).to.be.ok;
        expect(exceptionReport.residentImportTrackingId).to.equal(newSavedEntry.id);
        expect(exceptionReport.conflictingRule).to.equal(PartyExceptionReportRules.CONCESSIONS_UPDATED_AFTER_RENEWAL_START.description);
      });
    });

    describe('Importing an active lease with updated pets when renewal cycle started', () => {
      it('should create R16 exception report', async () => {
        const newLeaseEndDate = now({ timezone: property.timezone }).add(60, 'days').startOf('day');
        const savedEntry = await setup('import-mri-resident-default-data.json', property, {}, { updateLeaseData: { leaseEndDate: newLeaseEndDate } });
        await runImport(ctx, savedEntry, property);

        await startRenewalCycle();

        const dataToOverride = {
          updateLeaseData: {
            pets: [],
            leaseEndDate: newLeaseEndDate,
          },
        };
        const newSavedEntry = await setup('import-mri-resident-default-data.json', property, {}, dataToOverride);
        await runImport(ctx, newSavedEntry, property);

        const ruleId16 = PartyExceptionReportRules.PETS_UPDATED_AFTER_RENEWAL_START.ruleId;
        const exceptionReport = await getLastExceptionReportByExternalIdAndRuleId(ctx, newSavedEntry.primaryExternalId, ruleId16);
        expect(exceptionReport).to.be.ok;
        expect(exceptionReport.residentImportTrackingId).to.equal(newSavedEntry.id);
        expect(exceptionReport.conflictingRule).to.equal(PartyExceptionReportRules.PETS_UPDATED_AFTER_RENEWAL_START.description);
      });
    });

    describe('Importing an active lease with updated vehicles when renewal cycle started', () => {
      it('should create R17 exception report', async () => {
        const newLeaseEndDate = now({ timezone: property.timezone }).add(60, 'days').startOf('day');
        const savedEntry = await setup('import-mri-resident-default-data.json', property, {}, { updateLeaseData: { leaseEndDate: newLeaseEndDate } });
        await runImport(ctx, savedEntry, property);

        await startRenewalCycle();

        const dataToOverride = {
          updateLeaseData: {
            vehicles: [],
            leaseEndDate: newLeaseEndDate,
          },
        };
        const newSavedEntry = await setup('import-mri-resident-default-data.json', property, {}, dataToOverride);
        await runImport(ctx, newSavedEntry, property);

        const ruleId17 = PartyExceptionReportRules.VEHICLES_UPDATED_AFTER_RENEWAL_START.ruleId;
        const exceptionReport = await getLastExceptionReportByExternalIdAndRuleId(ctx, newSavedEntry.primaryExternalId, ruleId17);
        expect(exceptionReport).to.be.ok;
        expect(exceptionReport.residentImportTrackingId).to.equal(newSavedEntry.id);
        expect(exceptionReport.conflictingRule).to.equal(PartyExceptionReportRules.VEHICLES_UPDATED_AFTER_RENEWAL_START.description);
      });
    });
  });

  describe('Importing an active lease with multiple residents', () => {
    it('we should not have any externalRoommateId inserted', async () => {
      const savedEntry = await setup('import-mri-resident-default-data.json', property);
      await runImport(ctx, savedEntry, property);

      const party = await getPartyBy(ctx, {});
      expect(party).to.be.ok;

      const externalInfo = await getAllExternalInfoByParty(ctx, party.id);
      expect(externalInfo).to.have.length(2);

      const externalRoommatesInfo = externalInfo.filter(e => !!e.externalRoommateId);
      expect(externalRoommatesInfo).to.have.length(0);
    });
  });

  describe('Importing an active lease with updated lease start date', () => {
    it('should not update the lease start date', async () => {
      const leaseStartDate = now({ timezone: property.timezone }).add(1, 'day').startOf('day');
      const savedEntry = await setup('import-mri-resident-default-data.json', property, {}, { updateLeaseData: { leaseStartDate } });
      await runImport(ctx, savedEntry, property);

      const party = await getPartyBy(ctx, {});
      expect(party).to.be.ok;

      const activeLeaseWorkflowData = await getActiveLeaseWorkflowDataByPartyId(ctx, party.id);
      expect(activeLeaseWorkflowData).to.be.ok;
      activeLeaseWorkflowData.leaseData.computedExtensionEndDate = now().add(3, 'month');
      activeLeaseWorkflowData.isExtension = true;
      await saveActiveLeaseWorkflowData(ctx, { ...activeLeaseWorkflowData });

      const newLeaseStartDate = now({ timezone: property.timezone }).add(2, 'month').startOf('day');
      const newSavedEntry = await setup('import-mri-resident-default-data.json', property, {}, { updateLeaseData: { leaseStartDate: newLeaseStartDate } });
      await runImport(ctx, newSavedEntry, property);

      const updatedActiveLeaseWorkflowData = await getActiveLeaseWorkflowDataByPartyId(ctx, party.id);
      expect(updatedActiveLeaseWorkflowData).to.be.ok;

      const formattedNewLeaseStartDate = parseDate(newLeaseStartDate, property.timezone);
      expect(updatedActiveLeaseWorkflowData.leaseData.leaseStartDate).to.not.equal(formattedNewLeaseStartDate);
      const formattedOldLeaseStartDate = parseDate(leaseStartDate, property.timezone);
      expect(updatedActiveLeaseWorkflowData.leaseData.leaseStartDate).to.equal(formattedOldLeaseStartDate);
      expect(updatedActiveLeaseWorkflowData.isExtension).to.be.true;
    });
  });

  describe('Having a contact info switch done in MRI', () => {
    it('should not update or create external ids', async () => {
      const savedEntry = await setup('import-mri-resident-default-data.json', property);
      await runImport(ctx, savedEntry, property);

      const party = await getPartyBy(ctx, {});
      expect(party).to.be.ok;

      const externalInfo = await getAllExternalInfoByParty(ctx, party.id);
      expect(externalInfo).to.be.ok;
      expect(externalInfo).to.have.length(2);

      const newSavedEntry = await setup('import-mri-contact-info-switch.json', property);
      await runImport(ctx, newSavedEntry, property);

      const newExternalInfo = await getAllExternalInfoByParty(ctx, party.id);
      expect(newExternalInfo).to.be.ok;
      expect(newExternalInfo).to.have.length(2);
    });
  });

  describe('Having a promoted roommate done in MRI', () => {
    it('should not update or create new external ids', async () => {
      const savedEntry = await setup('import-mri-resident-default-data.json', property);
      await runImport(ctx, savedEntry, property);

      const party = await getPartyBy(ctx, {});
      expect(party).to.be.ok;

      const externalInfo = await getAllExternalInfoByParty(ctx, party.id);
      expect(externalInfo).to.be.ok;
      expect(externalInfo).to.have.length(2);

      const newSavedEntry = await setup('import-mri-promote-roommate.json', property);
      await runImport(ctx, newSavedEntry, property);

      const newExternalInfo = await getAllExternalInfoByParty(ctx, party.id);
      expect(newExternalInfo).to.be.ok;
      expect(newExternalInfo).to.have.length(2);
    });
  });

  describe('Having a unit transfer done in MRI', () => {
    it('should not archive the active lease', async () => {
      const savedEntry = await setup('import-mri-resident-default-data.json', property);
      await runImport(ctx, savedEntry, property);

      const party = await getPartyBy(ctx, {});
      expect(party).to.be.ok;

      const newSavedEntry = await setup('import-mri-resident-default-data.json', property, {}, { updateLeaseData: { unitId: '224' } });
      await runImport(ctx, newSavedEntry, property);

      const updatedParty = await getPartyBy(ctx, { id: party.id });
      expect(updatedParty.workflowState).to.equal(DALTypes.WorkflowState.ACTIVE);
      const activeLeaseWorkflowData = await getActiveLeaseWorkflowDataByPartyId(ctx, updatedParty.id);
      expect(activeLeaseWorkflowData.leaseData.inventoryId).to.equal(inventory.id);
    });
  });
});
