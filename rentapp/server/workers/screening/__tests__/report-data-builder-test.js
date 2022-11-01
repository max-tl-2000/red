/*
 * Copyright (c) 2022 Reva Technology Inc., all rights reserved.
 * Unauthorized copying of this file, via any medium is strictly prohibited
 * Licensed under the Elastic License 2.0; you may not use this file except
 * in compliance with the Elastic License 2.0.
 */

import newId from 'uuid/v4';
import path from 'path';
import loggerModule from '../../../../../common/helpers/logger';
import { createReportDataBuilder } from '../v2/helpers/fadv-helper';
import { readJSON } from '../../../../../common/helpers/xfs';

describe('Report Data Builder', () => {
  const getParsedFadvResponse = async (fileName = 'v2-fadv-response.json') =>
    await readJSON(path.resolve(path.dirname(__dirname), '__tests__', 'resources', fileName));

  const ctx = { tenantId: newId(), trx: newId() };
  const logger = loggerModule.child({ subType: 'Screening v2 Report Data Builder', ctx });

  describe('When not parsedFadvResponse is passed in the constructor', () => {
    it('should throw an error', () => {
      expect(() => createReportDataBuilder(ctx)).toThrow('fadvResponse not defined');
    });
  });

  describe('When building a Credit Report data object', () => {
    it('should return an object containing the correct keys and values', async () => {
      const screeningResponse = await getParsedFadvResponse();
      const reportBuilder = createReportDataBuilder(ctx, screeningResponse, logger);
      const reportData = reportBuilder.buildCreditReport('30072231');
      expect(reportData).toMatchSnapshot();
    });

    it('and is a requried ssn reponse, should return an object with hasRequiredSsnResponse set to true ', async () => {
      const screeningResponse = await getParsedFadvResponse('required-ssn-response.json');
      const reportBuilder = createReportDataBuilder(ctx, screeningResponse, logger);
      const { hasRequiredSsnResponse } = reportBuilder.buildCreditReport('31719437');

      expect(hasRequiredSsnResponse).toEqual(true);
    });
  });

  describe('When building a Criminal Report data object', () => {
    it('should return an object containing the correct keys and values', async () => {
      const screeningResponse = await getParsedFadvResponse();
      const reportBuilder = createReportDataBuilder(ctx, screeningResponse, logger);
      const reportDataA = reportBuilder.buildCriminalReport('30072231');
      const reportDataB = reportBuilder.buildCriminalReport('30072232');

      expect(reportDataA).toMatchSnapshot();
      // EV702 F, SW852 F,
      expect(reportDataA.hasEvictionFilingsMin).toEqual(true);
      // EV702 P, SW852 P,
      expect(reportDataB.hasEvictionFilingsMin).toEqual(false);
    });
  });
});
