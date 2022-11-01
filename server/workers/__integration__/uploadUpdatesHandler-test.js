/*
 * Copyright (c) 2022 Reva Technology Inc., all rights reserved.
 * Unauthorized copying of this file, via any medium is strictly prohibited
 * Licensed under the Elastic License 2.0; you may not use this file except
 * in compliance with the Elastic License 2.0.
 */

import { expect } from 'chai';
import path from 'path';
import get from 'lodash/get';
import newId from 'uuid/v4';
import { APP_EXCHANGE, IMPORT_UPDATES_MESSAGE_TYPE } from '../../helpers/message-constants';
import { DALTypes } from '../../../common/enums/DALTypes';
import { waitFor } from '../../testUtils/apiHelper';
import { setupConsumers } from '../consumer';
import { chan, createResolverMatcher, tenant } from '../../testUtils/setupTestGlobalContext';
import { sendMessage } from '../../services/pubsub';
import { createJob, getJobsByName } from '../../services/jobs';
import { updateTenant } from '../../services/tenantService';
import { createAProperty, createAInventoryGroup, createABuilding } from '../../testUtils/repoHelper';
import { insertInto } from '../../database/factory';

const INVENTORY_TABLE = 'Inventory';

describe('/uploadUpdatesHandler', () => {
  const ctx = { tenantId: tenant.id };
  let conn;
  const propertyExternalId = 'COVE';

  const createUnit = ({ building, externalId, rmsExternalId, inventoryGroupId }) => ({
    propertyId: building.propertyId,
    buildingId: building.id,
    inventoryGroupId,
    type: DALTypes.InventoryType.UNIT,
    name: `test inventory ${newId()}`,
    state: DALTypes.InventoryState.VACANT_READY,
    externalId,
    rmsExternalId,
  });

  const createUnits = async (building, externalIds) => {
    const { id: inventoryGroupId } = await createAInventoryGroup({});

    const unitsToInsert = externalIds.map(externalId => createUnit({ building, externalId, rmsExternalId: externalId, inventoryGroupId }));

    await insertInto(ctx, INVENTORY_TABLE, unitsToInsert);
  };

  const createUnitsForRmsPricing = async externalIds => {
    const property = await createAProperty({ integration: { import: { unitPricing: true } } }, { rmsExternalId: propertyExternalId });
    const propertyId = property.id;
    const building = await createABuilding({ propertyId });
    return await createUnits(building, externalIds);
  };

  const setupQueueForMessage = async (jobName, workerConfigs) => {
    conn = chan();
    const isTheSameJobName = (payload, name) => get(payload, 'jobDetails.name') === name || (payload.files && payload.files.find(f => f.name === name));
    const condition = (payload, processed) => isTheSameJobName(payload, jobName) && processed;

    const { resolvers, promises } = waitFor([condition]);
    const matcher = createResolverMatcher(resolvers);
    await setupConsumers(conn, matcher, workerConfigs, true);

    return { task: Promise.all(promises) };
  };

  describe('when receiving a new IMPORT_FILES message in the queue', () => {
    const messageKey = IMPORT_UPDATES_MESSAGE_TYPE.IMPORT_FILES;
    const category = DALTypes.JobCategory.MigrateData;

    const yardiFiles = [
      {
        originalName: 'ResUnitStatus_304.csv',
        filePath: path.join(__dirname, 'resources/updates/ResUnitStatus_304.csv'),
      },
    ];

    const rmsFiles = [
      {
        originalName: 'LROPricing_COVE_20171110.xml',
        filePath: path.join(__dirname, 'resources/updates/LROPricing_COVE_20171110.xml'),
      },
    ];

    const LroPricingExternalIds = [
      '003-SALT',
      '005-CAPT',
      '010-CHAN',
      '014-CAPT',
      '014-CHAN',
      '015-GNWD',
      '016-SALT',
      '018-SEAD',
      '022-BARB',
      '022-CAPT',
      '023-CHAN',
      '024-GNWD',
      '028-BARB',
      '038-GNWD',
      '064-BARB',
      '086-BARB',
      '112-BARB',
      '131-BARB',
      '141-BARB',
    ];

    const yardiFilesJobDetails = {
      name: DALTypes.Jobs.ImportUpdateDataFiles,
      step: DALTypes.ImportUpdateDataFilesSteps.ImportUpdates,
      category,
    };

    const rmsFilesJobDetails = {
      name: DALTypes.Jobs.ImportRmsFiles,
      step: DALTypes.ImportRmsFilesSteps.RmsUpdates,
      category,
    };

    const importUpdatesWorkerConfig = 'importUpdates';

    const sendImportFilesMessage = async (jobId, files, jobDetails, isUIImport) => {
      const message = {
        jobDetails: jobId ? { id: jobId, ...jobDetails } : undefined,
        tenantId: ctx.tenantId,
        files,
        isTestMode: true,
        isUIImport,
      };

      await sendMessage({
        exchange: APP_EXCHANGE,
        key: messageKey,
        message,
        ctx,
      });
    };

    const executeTest = async (files, jobDetails, shouldCreateJob, isUIImport) => {
      const job = shouldCreateJob ? await createJob(ctx, files, jobDetails) : {};
      const jobName = jobDetails.name;

      const workerConfigs = [importUpdatesWorkerConfig];
      const { task } = await setupQueueForMessage(jobName, workerConfigs);

      await sendImportFilesMessage(job.id, files, jobDetails, isUIImport);

      const response = await task;
      expect(response.every(p => p)).to.be.true;

      const [updatedJob] = await getJobsByName(ctx, jobName);
      const { status, steps, metadata } = updatedJob;
      expect(status).to.equal(DALTypes.JobStatus.PROCESSED);

      const updatedJobStepResult = steps[jobDetails.step].result;
      const { errors, uploaded, processed } = updatedJobStepResult;
      expect(errors.length).to.equal(0);
      expect(uploaded).to.equal(1);
      expect(processed).to.equal(1);

      const metadataFilesOriginalName = metadata.files.map(f => f.originalName);
      const filesOriginalName = files.map(({ originalName }) => originalName);
      expect(metadataFilesOriginalName).to.have.deep.members(filesOriginalName);
    };

    describe('and the message was sent from the Admin page', () => {
      describe('and its a Yardi file', () => {
        it('should proccess the file successfully', async () => {
          await executeTest(yardiFiles, yardiFilesJobDetails, true, true);
        });
      });

      describe('and its a RMS file', () => {
        it('should proccess the file successfully', async () => {
          await createUnitsForRmsPricing(LroPricingExternalIds);
          await executeTest(rmsFiles, rmsFilesJobDetails, true);
        });
      });
    });

    describe('the message was sent from the SFTP', () => {
      describe('and is a Yardi file', () => {
        it('should proccess the file successfully', async () => {
          await updateTenant(ctx.tenantId, { metadata: { backendIntegration: { name: DALTypes.BackendMode.YARDI } } });
          const yardiFile = yardiFiles[0];
          yardiFile.name = DALTypes.Jobs.ImportUpdateDataFiles;
          await executeTest([yardiFile], yardiFilesJobDetails, false);
        });
      });

      describe('and is a RMS file', () => {
        it('should proccess the file successfully', async () => {
          await createUnitsForRmsPricing(LroPricingExternalIds);
          const rmsFile = rmsFiles[0];
          rmsFile.name = DALTypes.Jobs.ImportRmsFiles;
          await executeTest([rmsFile], rmsFilesJobDetails, false);
        });
      });
    });
  });
});
