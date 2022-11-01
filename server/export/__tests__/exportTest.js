/*
 * Copyright (c) 2022 Reva Technology Inc., all rights reserved.
 * Unauthorized copying of this file, via any medium is strictly prohibited
 * Licensed under the Elastic License 2.0; you may not use this file except
 * in compliance with the Elastic License 2.0.
 */

import newUUID from 'uuid/v4';
import { DALTypes } from '../../../common/enums/DALTypes';
/* eslint-disable global-require */
const { mockModules } = require('test-helpers/mocker').default(jest);

describe('exportData', () => {
  let exportData;

  let finChargesMapperMock;
  let finReceiptsMapperMock;

  const tenant = {
    id: newUUID(),
    metadata: {
      backendIntegration: {
        skipFinReceiptsExport: false,
      },
    },
  };
  const ExportType = {
    FinCharges: {
      fileType: DALTypes.ExportTypes.FIN_CHARGES,
    },
    FinReceipts: {
      fileType: DALTypes.ExportTypes.FIN_RECEIPTS,
    },
  };
  beforeEach(() => {
    jest.resetModules();
    finChargesMapperMock = jest.fn();
    finReceiptsMapperMock = jest.fn();
    ExportType.FinCharges.mapper = finChargesMapperMock;
    ExportType.FinReceipts.mapper = finReceiptsMapperMock;
    mockModules({
      '../../services/tenantService': {
        getTenant: jest.fn(() => tenant),
      },
    });

    exportData = require('../yardi/export').exportData;
  });

  describe('when backend integration is set to yardi', () => {
    it('should call export mappers', async () => {
      const exportTypes = [ExportType.FinCharges, ExportType.FinReceipts];
      const data = { tenantId: newUUID(), party: {}, lease: {}, finCharges: [], finReceipts: [] };

      await exportData({ tenantId: tenant.id }, exportTypes, data);

      expect(finChargesMapperMock.mock.calls).toHaveLength(1);
      expect(finReceiptsMapperMock.mock.calls).toHaveLength(1);
    });
  });

  describe('when backend integration is set to none, and skipFinReceiptsExport is set to true', () => {
    it('should not call finReceiptsMapper', async () => {
      tenant.metadata.backendIntegration.skipFinReceiptsExport = true;
      const exportTypes = [ExportType.FinCharges, ExportType.FinReceipts];
      const data = { tenantId: newUUID(), party: {}, lease: {}, finCharges: [], finReceipts: [] };

      await exportData({ tenantId: tenant.id }, exportTypes, data);

      expect(finChargesMapperMock.mock.calls).toHaveLength(1);
      expect(finReceiptsMapperMock.mock.calls).toHaveLength(0);
    });
  });
});
