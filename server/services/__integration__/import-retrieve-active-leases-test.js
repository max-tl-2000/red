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
import { DATE_US_FORMAT, YEAR_MONTH_DAY_FORMAT } from '../../../common/date-constants';
import * as repoHelper from '../../testUtils/repoHelper';
import { residentImportTrackingKeys } from '../../testUtils/expectedKeys';
import { retrieveData } from '../importActiveLeases/retrieve-data';
import {
  getAllResidentImportTrackingEntries,
  setStatusById,
  setResidentImportTrackingAsAddedToExceptionReport,
  updateActiveLeaseCreatedAtDate,
} from '../../dal/import-repo';
import { saveActiveLeaseWorkflowData } from '../../dal/activeLeaseWorkflowRepo';
import { insertExternalInfo } from '../../dal/exportRepo';
import { saveRecurringJob } from '../../dal/jobsRepo';
import { updateTenant } from '../tenantService';

const runRetrieveData = async (ctx, entry, property, primaryExternalId) =>
  await retrieveData(ctx, {
    propertyExternalId: property.externalId,
    mockedEntries: entry ? [entry] : [],
    backendMode: DALTypes.BackendMode.NONE,
    propertyLastSuccessfulSyncDate: now().format(YEAR_MONTH_DAY_FORMAT),
    shouldSaveEntries: true,
    primaryExternalId,
  });

const createActiveLeaseParty = async (ctx, mockedEntry, property, { created_at } = {}) => {
  const user = await repoHelper.createAUser();
  const party = await repoHelper.createAParty({
    userId: user.id,
    workflowName: DALTypes.WorkflowName.ACTIVE_LEASE,
    workflowState: DALTypes.WorkflowState.ACTIVE,
    assignedPropertyId: property.id,
  });

  await insertExternalInfo(ctx, {
    isPrimary: true,
    externalId: mockedEntry.primaryExternalId,
    partyId: party.id,
    propertyId: property.id,
  });

  const activeLeaseWorkflowData = await saveActiveLeaseWorkflowData(ctx, {
    created_at,
    leaseData: {
      leaseStartDate: now().format(DATE_US_FORMAT),
      leaseEndDate: now().add(10, 'days').format(DATE_US_FORMAT),
      leaseTerm: 12,
      moveInDate: now().format(DATE_US_FORMAT),
    },
    partyId: party.id,
    updated_at: party.updated_at,
    state: DALTypes.ActiveLeaseState.NONE,
    metadata: { moveInConfirmed: true },
  });
  await updateActiveLeaseCreatedAtDate(ctx, activeLeaseWorkflowData.id, created_at);
};

describe('Retrieve imported data', () => {
  const ctx = { tenantId: tenant.id };
  let property;
  const loadResidentsData = async filename => {
    const rawDataString = await promisify(fs.readFile)(path.join(__dirname, 'resources/', filename), 'utf8');
    return JSON.parse(rawDataString);
  };

  beforeEach(async () => {
    const settings = {
      renewals: { renewalCycleStart: 90 },
      integration: { import: { residentData: true, unitPricing: false } },
    };
    property = await repoHelper.createAProperty(settings, { name: '13780' });
    const recurringJob = {
      name: DALTypes.Jobs.ImportAndProcessPartyWorkflows,
      lastRunAt: now().toJSON(),
      metadata: { progress: { 13780: { lastSuccessfulSyncDate: now().add(-1, 'days') } } },
      schedule: '0 */3 * * * *',
      timezone: 'America/Los_Angeles',
      notes: 'Run every 3 minutes',
      status: 'Idle',
    };

    await saveRecurringJob(ctx, recurringJob);
  });

  describe('Running retrieve data', () => {
    it('should insert one record in ResidentImportTracking table', async () => {
      const mockedEntry = await loadResidentsData('import-resident-default-data.json');
      const formattedEntries = await runRetrieveData(ctx, mockedEntry, property);
      expect(formattedEntries).to.have.length(1);

      const residentImportTrackingRecord = await getAllResidentImportTrackingEntries(ctx);
      expect(residentImportTrackingRecord).to.have.length(1);
      expect(residentImportTrackingRecord[0]).to.have.all.keys(residentImportTrackingKeys);
    });

    it('should not insert records in ResidentImportTracking table if there are no entries', async () => {
      const formattedEntries = await runRetrieveData(ctx, '', property);
      expect(formattedEntries).to.have.length(0);

      const residentImportTrackingRecord = await getAllResidentImportTrackingEntries(ctx);
      expect(residentImportTrackingRecord).to.have.length(0);
    });

    it('should insert one record when a new entry for same external id does not exists', async () => {
      const mockedEntry = await loadResidentsData('import-resident-default-data.json');
      const formattedEntries = await runRetrieveData(ctx, mockedEntry, property);
      expect(formattedEntries).to.have.length(1);

      const residentImportTrackingRecord = await getAllResidentImportTrackingEntries(ctx);
      expect(residentImportTrackingRecord).to.have.length(1);
    });

    it('should insert one record when a renewal party exist for same external id', async () => {
      const mockedEntry = await loadResidentsData('import-resident-default-data.json');
      const firstImport = await runRetrieveData(ctx, mockedEntry, property);
      await setStatusById(ctx, { id: firstImport[0].id, status: DALTypes.ResidentImportStatus.PROCESSED, importResult: {} });

      const user = await repoHelper.createAUser();
      const party = await repoHelper.createAParty({ userId: user.id, workflowName: DALTypes.WorkflowName.RENEWAL, assignedPropertyId: property.id });
      await insertExternalInfo(ctx, {
        isPrimary: true,
        externalId: mockedEntry.primaryExternalId,
        partyId: party.id,
        propertyId: property.id,
      });

      const formattedEntries = await runRetrieveData(ctx, mockedEntry, property);
      expect(formattedEntries).to.have.length(1);

      const residentImportTrackingRecords = await getAllResidentImportTrackingEntries(ctx);
      expect(residentImportTrackingRecords).to.have.length(2);
    });

    it('should insert one record when a renewal party exist for same external id and the entry was not proccessed after the archive', async () => {
      const mockedEntry = await loadResidentsData('import-resident-default-data.json');
      const firstImport = await runRetrieveData(ctx, mockedEntry, property);
      await setStatusById(ctx, { id: firstImport[0].id, status: DALTypes.ResidentImportStatus.PROCESSED, importResult: {} });

      const user = await repoHelper.createAUser();
      const party = await repoHelper.createAParty({
        userId: user.id,
        workflowName: DALTypes.WorkflowName.RENEWAL,
        workflowState: DALTypes.WorkflowState.ARCHIVED,
        archiveDate: now().add(5, 'days'),
        assignedPropertyId: property.id,
      });
      await insertExternalInfo(ctx, {
        isPrimary: true,
        externalId: mockedEntry.primaryExternalId,
        partyId: party.id,
        propertyId: property.id,
      });

      const formattedEntries = await runRetrieveData(ctx, mockedEntry, property);
      expect(formattedEntries).to.have.length(1);

      const residentImportTrackingRecords = await getAllResidentImportTrackingEntries(ctx);
      expect(residentImportTrackingRecords).to.have.length(2);
    });

    it('should not insert one record when a renewal party exist for same external id and the entry was already proccessed after the archive', async () => {
      const mockedEntry = await loadResidentsData('import-resident-default-data.json');
      const firstImport = await runRetrieveData(ctx, mockedEntry, property);
      await setStatusById(ctx, { id: firstImport[0].id, status: DALTypes.ResidentImportStatus.PROCESSED, importResult: {} });

      const user = await repoHelper.createAUser();
      const party = await repoHelper.createAParty({
        userId: user.id,
        workflowName: DALTypes.WorkflowName.RENEWAL,
        workflowState: DALTypes.WorkflowState.ARCHIVED,
        archiveDate: now().add(-5, 'days'),
        assignedPropertyId: property.id,
      });
      await insertExternalInfo(ctx, {
        isPrimary: true,
        externalId: mockedEntry.primaryExternalId,
        partyId: party.id,
        propertyId: property.id,
      });

      const formattedEntries = await runRetrieveData(ctx, mockedEntry, property);
      expect(formattedEntries).to.have.length(0);

      const residentImportTrackingRecords = await getAllResidentImportTrackingEntries(ctx);
      expect(residentImportTrackingRecords).to.have.length(1);
    });

    it('should insert one record when the entry is different than the last one already inserted for same external id', async () => {
      const mockedEntry = await loadResidentsData('import-resident-default-data.json');
      const firstImport = await runRetrieveData(ctx, mockedEntry, property);
      await setStatusById(ctx, { id: firstImport[0].id, status: DALTypes.ResidentImportStatus.PROCESSED, importResult: {} });

      mockedEntry.unitRent = 300;
      const formattedEntries = await runRetrieveData(ctx, mockedEntry, property);
      expect(formattedEntries).to.have.length(1);

      const residentImportTrackingRecords = await getAllResidentImportTrackingEntries(ctx);
      expect(residentImportTrackingRecords).to.have.length(2);
    });

    it('should insert one record when the last processed entry has exception report', async () => {
      const mockedEntry = await loadResidentsData('import-resident-default-data.json');
      const firstImport = await runRetrieveData(ctx, mockedEntry, property);
      await setStatusById(ctx, { id: firstImport[0].id, status: DALTypes.ResidentImportStatus.PROCESSED, importResult: {} });
      await setResidentImportTrackingAsAddedToExceptionReport(ctx, firstImport[0].id);

      const formattedEntries = await runRetrieveData(ctx, mockedEntry, property);
      expect(formattedEntries).to.have.length(1);

      const residentImportTrackingRecords = await getAllResidentImportTrackingEntries(ctx);
      expect(residentImportTrackingRecords).to.have.length(2);
    });

    describe('when there is no exception report added, no renewal spawned and no difference between the entries', () => {
      it('should update lastSyncDate value from the last record', async () => {
        const mockedEntry = await loadResidentsData('import-resident-default-data.json');
        const firstImport = await runRetrieveData(ctx, mockedEntry, property);
        await setStatusById(ctx, { id: firstImport[0].id, status: DALTypes.ResidentImportStatus.PROCESSED, importResult: {} });
        const firstImportResidentImportTrackingRecord = await getAllResidentImportTrackingEntries(ctx);
        expect(firstImportResidentImportTrackingRecord).to.have.length(1);

        const formattedEntries = await runRetrieveData(ctx, mockedEntry, property);
        expect(formattedEntries).to.have.length(0);

        const residentImportTrackingRecords = await getAllResidentImportTrackingEntries(ctx);
        expect(residentImportTrackingRecords).to.have.length(1);

        expect(firstImportResidentImportTrackingRecord[0].lastSyncDate).to.not.equal(residentImportTrackingRecords[0].lastSyncDate);
      });
    });

    it('should insert one record when we trigger the import manually for a specific party', async () => {
      const mockedEntry = await loadResidentsData('import-resident-default-data.json');
      const firstImport = await runRetrieveData(ctx, mockedEntry, property);
      await setStatusById(ctx, { id: firstImport[0].id, status: DALTypes.ResidentImportStatus.PROCESSED, importResult: {} });

      const formattedEntries = await runRetrieveData(ctx, mockedEntry, property, mockedEntry.primaryExternalId);
      expect(formattedEntries).to.have.length(1);

      const residentImportTrackingRecords = await getAllResidentImportTrackingEntries(ctx);
      expect(residentImportTrackingRecords).to.have.length(2);
    });

    it('should insert one record when the optimization flag is turned off', async () => {
      const mockedEntry = await loadResidentsData('import-resident-default-data.json');
      const firstImport = await runRetrieveData(ctx, mockedEntry, property);
      await setStatusById(ctx, { id: firstImport[0].id, status: DALTypes.ResidentImportStatus.PROCESSED, importResult: {} });
      await updateTenant(ctx.tenantId, {
        metadata: {
          ...tenant.metadata,
          disableResidentsImportOptimization: true,
        },
      });
      const formattedEntries = await runRetrieveData(ctx, mockedEntry, property);
      expect(formattedEntries).to.have.length(1);

      const residentImportTrackingRecords = await getAllResidentImportTrackingEntries(ctx);
      expect(residentImportTrackingRecords).to.have.length(2);
    });

    it('should insert one record when the active lease was created between lastSyncDate and today date', async () => {
      const mockedEntry = await loadResidentsData('import-resident-default-data.json');
      const firstImport = await runRetrieveData(ctx, mockedEntry, property);
      await setStatusById(ctx, { id: firstImport[0].id, status: DALTypes.ResidentImportStatus.PROCESSED, importResult: {} });

      await createActiveLeaseParty(ctx, mockedEntry, property, { created_at: now() });

      const formattedEntries = await runRetrieveData(ctx, mockedEntry, property);
      expect(formattedEntries).to.have.length(1);

      const residentImportTrackingRecords = await getAllResidentImportTrackingEntries(ctx);
      expect(residentImportTrackingRecords).to.have.length(2);
    });

    it('should not insert one record when the active lease was created before the lastSyncDate', async () => {
      const mockedEntry = await loadResidentsData('import-resident-default-data.json');
      const firstImport = await runRetrieveData(ctx, mockedEntry, property);
      await setStatusById(ctx, { id: firstImport[0].id, status: DALTypes.ResidentImportStatus.PROCESSED, importResult: {} });

      await createActiveLeaseParty(ctx, mockedEntry, property, { created_at: now().add(-1, 'days') });

      const formattedEntries = await runRetrieveData(ctx, mockedEntry, property);
      expect(formattedEntries).to.have.length(0);

      const residentImportTrackingRecords = await getAllResidentImportTrackingEntries(ctx);
      expect(residentImportTrackingRecords).to.have.length(1);
    });
  });
});
