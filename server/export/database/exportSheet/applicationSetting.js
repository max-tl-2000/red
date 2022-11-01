/*
 * Copyright (c) 2022 Reva Technology Inc., all rights reserved.
 * Unauthorized copying of this file, via any medium is strictly prohibited
 * Licensed under the Elastic License 2.0; you may not use this file except
 * in compliance with the Elastic License 2.0.
 */

import pick from 'lodash/pick';
import { getPropertySettingsToExport } from '../../../dal/propertyRepo';
import { buildDataPumpFormat } from '../../helpers/export';

const buildApplicationSettings = properties =>
  properties.reduce((acc, property) => {
    let buildData = {};
    const applicationSettings = property.settings.applicationSettings || {};
    Object.keys(applicationSettings).forEach(partyType => {
      Object.keys(applicationSettings[partyType]).forEach(memberType => {
        buildData = {
          property: property.name,
          partyType,
          memberType,
          ...pick(applicationSettings[partyType][memberType], [
            'incomeSourcesSection',
            'addressHistorySection',
            'disclosuresSection',
            'childrenSection',
            'petsSection',
            'vehiclesSection',
            'privateDocumentsSection',
            'sharedDocumentsSection',
            'rentersInsuranceSection',
            'holdDeposit',
            'holdDepositWithoutUnit',
            'creditReportRequiredFlag',
            'criminalReportRequiredFlag',
            'creditReportValidForPeriod',
            'criminalReportValidForPeriod',
            'appFeePaymentValidForPeriod',
          ]),
        };
        acc.push(buildData);
      });
    });
    return acc;
  }, []);

export const exportApplicationSettings = async (ctx, { propertyIdsToExport, columnHeaders: columnHeadersOrdered }) => {
  const properties = await getPropertySettingsToExport(ctx, propertyIdsToExport);
  const applicationSettings = buildApplicationSettings(properties);

  return buildDataPumpFormat(applicationSettings, columnHeadersOrdered);
};
