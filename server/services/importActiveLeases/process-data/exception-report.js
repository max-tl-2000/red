/*
 * Copyright (c) 2022 Reva Technology Inc., all rights reserved.
 * Unauthorized copying of this file, via any medium is strictly prohibited
 * Licensed under the Elastic License 2.0; you may not use this file except
 * in compliance with the Elastic License 2.0.
 */

import { saveExceptionReport, getLastDuplicateExceptionReport } from '../../../dal/exceptionReportRepo';
import { setResidentImportTrackingAsAddedToExceptionReport } from '../../../dal/import-repo';
import loggerModule from '../../../../common/helpers/logger';

const logger = loggerModule.child({ subType: 'importActiveLeases' });

const formatExceptionReportData = (data, conflictingRule) => {
  const { excludePersonData, excludePartyData } = conflictingRule;
  if (excludePersonData) return { party: { partyId: data.partyId } };
  if (excludePartyData) return { person: { ...data.exceptionReportPersonData } };

  return { person: { ...data.exceptionReportPersonData }, party: { partyId: data.partyId } };
};

export const createExceptionReport = async (ctx, data, conflictingRule) => {
  if (!data) return;

  if (!conflictingRule) {
    throw new Error('A conflicting rule is required in order to create an exception report!');
  }
  const { entry, externalId } = data;
  const { id: residentImportTrackingId, rawData: importedData } = entry || {};
  const reportData = data.reportData ? { ...data.reportData } : formatExceptionReportData(data, conflictingRule);
  const { description: ruleDescription, ruleId, exceptionType } = conflictingRule;
  const { unitId: unit } = importedData || {};
  const exceptionReportData = { reportData, unit, conflictingRule: ruleDescription, residentImportTrackingId, externalId, ruleId, exceptionType };

  try {
    const lastDuplicateExceptionReport = await getLastDuplicateExceptionReport(ctx, { externalId, reportData, ruleId });
    const shouldIgnoreReport = lastDuplicateExceptionReport && lastDuplicateExceptionReport.ignore;

    if (shouldIgnoreReport) {
      logger.trace({ ctx, externalId, ruleId, conflictingRule: ruleDescription }, 'createExceptionReport - not saved since last exception report is ignored');
      return;
    }

    const exceptionReport = await saveExceptionReport(ctx, exceptionReportData);
    residentImportTrackingId && (await setResidentImportTrackingAsAddedToExceptionReport(ctx, residentImportTrackingId));
    logger.trace({ ctx, exceptionReport }, 'createExceptionReport - result');

    const exceptionReportLogData = {
      ruleId,
      ruleDescription,
      reportData,
      created_at: exceptionReport.created_at,
      residentImportTrackingId,
      importedData,
    };
    logger.trace({ ctx, exceptionReportData: JSON.stringify(exceptionReportLogData) }, 'Exception report alert log');
  } catch (error) {
    logger.error({ ctx, error, exceptionReportData }, 'createExceptionReport failed');
    throw error;
  }
};
