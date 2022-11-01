/*
 * Copyright (c) 2022 Reva Technology Inc., all rights reserved.
 * Unauthorized copying of this file, via any medium is strictly prohibited
 * Licensed under the Elastic License 2.0; you may not use this file except
 * in compliance with the Elastic License 2.0.
 */

import { expect } from 'chai';
import { checkForMissingRmsFiles, checkForMissingTenantBackendImportFiles } from '../checkIncomingFilesHandler';
import { testCtx as ctx, createAProperty, setTenantBackendIntegration } from '../../../testUtils/repoHelper';
import { saveJob } from '../../../dal/jobsRepo';
import { getPropertiesByQuotePricingSetting } from '../../../dal/propertyRepo';
import { DALTypes } from '../../../../common/enums/DALTypes';
import { now } from '../../../../common/helpers/moment-utils';
import '../../../testUtils/setupTestGlobalContext';

const { JobStatus, Jobs, BackendMode } = DALTypes;

const RMS_PRICING_SETTING = { integration: { import: { unitPricing: true } } };
const REVA_PRICING_SETTING = { integration: { import: { unitPricing: false } } };

const HAS_MISSING_IMPORT_FILES = true;
const DOES_NOT_HAVE_MISSING_IMPORT_FILES = false;

describe('checkIncomingFilesHandler', () => {
  beforeEach(() => {
    delete ctx.cache;
  });
  const mockJobsParameters = [
    { name: Jobs.ImportRmsFiles, status: JobStatus.PROCESSED, delta: 12 },
    { name: Jobs.ImportRmsFiles, status: JobStatus.PENDING, delta: 5 },
    { name: Jobs.ImportRmsFiles, status: JobStatus.IN_PROGRESS, delta: 48 },
    { name: Jobs.ImportRmsFiles, status: JobStatus.PROCESSED, delta: 23 },
    { name: Jobs.ImportUpdateDataFiles, status: JobStatus.PROCESSED, delta: 8, backend: BackendMode.YARDI },
    { name: Jobs.ImportUpdateDataFiles, status: JobStatus.PROCESSED, delta: 23, backend: BackendMode.YARDI },
    { name: Jobs.ImportUpdateDataFiles, status: JobStatus.PROCESSED, delta: 18, backend: BackendMode.MRI },
    { name: Jobs.ImportUpdateDataFiles, status: JobStatus.IN_PROGRESS, delta: 24, backend: BackendMode.MRI },
  ];

  const updateJobStatus = async (jobToUpdate, delta, status) => {
    jobToUpdate.created_at = now().add(-delta, 'hours');
    jobToUpdate.status = status;
    return await saveJob(ctx, jobToUpdate);
  };

  const getRmsJobMetadata = (properties, hasMissingFileSubset) => ({
    files: (!hasMissingFileSubset && properties.map(property => ({ originalName: `LROPricing_${property.name}_20180708.XML` }))) || [],
  });

  const getBackendJobMetadata = (backendMode = BackendMode.NONE, hasMissingFileSubset = true) => {
    const incompleteMriImportFiles = [];
    const incompleteYardiImportFiles = [{ originalName: 'ResUnitStatus_3922.csv' }];

    const completeMriImportFiles = [{ originalName: 'MriUnits-20180704T190100Z.CSV' }];
    const completeYardiImportFiles = [...incompleteYardiImportFiles, { originalName: 'ResUnitAmenities_3922.CSV' }];

    let listOfFiles;
    switch (backendMode) {
      case BackendMode.YARDI:
        listOfFiles = hasMissingFileSubset ? incompleteYardiImportFiles : completeYardiImportFiles;
        break;
      case BackendMode.MRI:
        listOfFiles = hasMissingFileSubset ? incompleteMriImportFiles : completeMriImportFiles;
        break;
      default:
        listOfFiles = [];
        break;
    }

    return {
      files: listOfFiles,
    };
  };

  const getJobMetadata = options => {
    const { name, properties, hasMissingFileSubset, backend } = options;
    return (name === Jobs.ImportRmsFiles && getRmsJobMetadata(properties, hasMissingFileSubset)) || getBackendJobMetadata(backend, hasMissingFileSubset);
  };

  const initJobsData = async (hasMissingFileSubset = true, properties = []) =>
    await Promise.all(
      mockJobsParameters.map(async jobParams => {
        const { name, delta, status, backend } = jobParams;
        const metadata = getJobMetadata({ name, properties, hasMissingFileSubset, backend });
        const createdJob = await saveJob(ctx, { name, metadata });
        return await updateJobStatus(createdJob, delta, status);
      }),
    );

  const initProperties = async () =>
    await Promise.all([
      await createAProperty(),
      await createAProperty(RMS_PRICING_SETTING),
      await createAProperty(REVA_PRICING_SETTING),
      await createAProperty(RMS_PRICING_SETTING),
      await createAProperty(REVA_PRICING_SETTING),
      await createAProperty(REVA_PRICING_SETTING),
    ]);

  describe('checkForMissingRmsFiles', () => {
    describe('for tenants with no RMS backed properties', () => {
      it('should return no properties with missing import files', async () => {
        await Promise.all([await createAProperty(), await createAProperty(REVA_PRICING_SETTING)]);

        const propertiesWithoutFileImports = await checkForMissingRmsFiles(ctx);
        expect(propertiesWithoutFileImports).to.not.be.undefined;
        expect(propertiesWithoutFileImports.length).to.equal(0);
      });
    });

    describe('for tenants with RMS backed properties', () => {
      it('should return properties with missing import files if not all properties received files', async () => {
        await initProperties();

        const rmsProperties = await getPropertiesByQuotePricingSetting(ctx, true);
        await initJobsData(HAS_MISSING_IMPORT_FILES, rmsProperties);

        const propertiesWithoutFileImports = await checkForMissingRmsFiles(ctx);
        expect(propertiesWithoutFileImports).to.not.be.undefined;
        expect(propertiesWithoutFileImports.length).to.equal(rmsProperties.length);
      });
    });

    describe('for tenants with RMS backed properties', () => {
      it('should not return properties with missing import files if all properties received files', async () => {
        await initProperties();

        const rmsProperties = await getPropertiesByQuotePricingSetting(ctx, true);
        await initJobsData(DOES_NOT_HAVE_MISSING_IMPORT_FILES, rmsProperties);

        const propertiesWithoutFileImports = await checkForMissingRmsFiles(ctx);
        expect(propertiesWithoutFileImports).to.not.be.undefined;
        expect(propertiesWithoutFileImports.length).to.equal(0);
      });
    });
  });

  describe('checkForMissingTenantBackendImportFiles', () => {
    describe('for tenants with no backend integration', () => {
      it('should return no missing import files', async () => {
        const tenantHasMissingBackendImportFiles = await checkForMissingTenantBackendImportFiles(ctx);
        expect(tenantHasMissingBackendImportFiles).to.be.false;
      });
    });

    beforeEach(async () => {
      await createAProperty({ integration: { import: { inventoryState: true } } });
    });

    describe('for tenants with YARDI backend integration', () => {
      it('should return missing import files if import files have not been received', async () => {
        await setTenantBackendIntegration(BackendMode.YARDI);
        const tenantHasMissingBackendImportFiles = await checkForMissingTenantBackendImportFiles(ctx);
        expect(tenantHasMissingBackendImportFiles).to.be.true;
      });

      it('should return missing import files if not all import files have been received', async () => {
        await setTenantBackendIntegration(BackendMode.YARDI);
        await initJobsData(HAS_MISSING_IMPORT_FILES);
        const tenantHasMissingBackendImportFiles = await checkForMissingTenantBackendImportFiles(ctx);
        expect(tenantHasMissingBackendImportFiles).to.be.true;
      });

      it('should return no missing import files if all import files have been received', async () => {
        await setTenantBackendIntegration(BackendMode.YARDI);
        await initJobsData(DOES_NOT_HAVE_MISSING_IMPORT_FILES);
        const tenantHasMissingBackendImportFiles = await checkForMissingTenantBackendImportFiles(ctx);
        expect(tenantHasMissingBackendImportFiles).to.be.false;
      });
    });

    describe('for tenants with RMI backend integration', () => {
      it('should return missing import files if import files have not been received', async () => {
        await setTenantBackendIntegration(BackendMode.MRI);
        const tenantHasMissingBackendImportFiles = await checkForMissingTenantBackendImportFiles(ctx);
        expect(tenantHasMissingBackendImportFiles).to.be.true;
      });

      it('should return missing import files if not all import files have been received', async () => {
        await setTenantBackendIntegration(BackendMode.MRI);
        await initJobsData(HAS_MISSING_IMPORT_FILES);
        const tenantHasMissingBackendImportFiles = await checkForMissingTenantBackendImportFiles(ctx);
        expect(tenantHasMissingBackendImportFiles).to.be.true;
      });

      it('should return no missing import files if all import files have been received', async () => {
        await setTenantBackendIntegration(BackendMode.MRI);
        await initJobsData(DOES_NOT_HAVE_MISSING_IMPORT_FILES);
        const tenantHasMissingBackendImportFiles = await checkForMissingTenantBackendImportFiles(ctx);
        expect(tenantHasMissingBackendImportFiles).to.be.false;
      });
    });
  });
});
