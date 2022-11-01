/*
 * Copyright (c) 2022 Reva Technology Inc., all rights reserved.
 * Unauthorized copying of this file, via any medium is strictly prohibited
 * Licensed under the Elastic License 2.0; you may not use this file except
 * in compliance with the Elastic License 2.0.
 */

import pick from 'lodash/pick';
import path from 'path';
import diff from 'deep-diff';
import { performance } from 'perf_hooks';
import { parse } from '../helpers/workbook';
import config from '../config';
import { importBusinessEntities } from './inventory/businessEntity';
import { importProperties, additionalPropertyProcess } from './inventory/property';
import { importPartyCohorts } from './inventory/partyCohort';
import { importPropertyCloseSchedules } from './inventory/propertyCloseSchedule';
import { importBuildings } from './inventory/building';
import { importLayouts } from './inventory/layout';
import { importInventories, additionalInventoryProcess } from './inventory/inventory';
import { importAmenities, additionalAmenityProcess } from './inventory/amenity';
import { importLeaseNames } from './inventory/leaseName';
import { importLeaseTerms } from './inventory/leaseTerm';
import { importPropertyGroups } from './inventory/propertyGroup';
import { importInventoryGroups } from './inventory/inventoryGroup';
import { importFees, additionalFeeProcess } from './inventory/fee';
import { importConcessions } from './inventory/concession';
import { importEmployees } from './inventory/employee';
import { importTeams, additionalTeamProcess } from './inventory/teams';
import { importTeamSalesTargets } from './inventory/teamSalesTarget';
import { importSources } from './inventory/sources';
import { importTeamMembers, additionalTeamMembersValidation } from './inventory/teamMembers';
import { importTeamMemberSalesTargets } from './inventory/teamMemberSalesTarget';
import { importPropertySettings } from './inventory/propertySetting';
import { importGlobalSettings } from './inventory/globalSetting';
import { importDisclosures } from './inventory/disclosures';
import { importLifestyles } from './inventory/lifestyle';
import { importOfficeHours } from './inventory/officeHours';
import { importTeamSettings } from './inventory/teamSettings';
import { importExternalPhones } from './inventory/externalPhones';
import { importOutgoingCalls } from './inventory/outgoingCalls';
import { removeUnassignedAddress } from '../dal/addressRepo';
import { getTenant } from '../services/tenantService';
import { importCampaigns } from './inventory/campaigns';
import { importPrograms, additionalProgramsProcess } from './inventory/programs';
import { importProgramReferences } from './inventory/programReferences';
import { importProgramReferrers } from './inventory/programReferrers';
import { importApplicationSettings } from './inventory/applicationSettings';
import { importPartySettings } from './inventory/partySettings';
import { importMarketingSearch } from './inventory/marketingSearch';
import { importCommsTemplates } from './inventory/commsTemplate';
import { importCommsTemplateSettings } from './inventory/commsTemplateSettings';
import { importVoiceMessages } from './inventory/voiceMessages';
import { importVoiceMenuItems } from './inventory/voiceMenuItems';
import { importTemplateShortCodes } from './inventory/templateShortCode';
import { importScreeningCriterias } from './inventory/screeningCriteria';
import { importPropertyPartySettings } from './inventory/propertyPartySettings';
import { importMarketingQuestions } from './inventory/marketingQuestions';
import { convertEntitiesInAnExpectedType } from './inventory/util';
import { isCustomerAdmin } from '../../common/helpers/auth';
import loggerModule from '../../common/helpers/logger';
import { SheetImportError } from '../common/errors';
import { spreadsheet, getColumnHeaders } from '../../common/helpers/spreadsheet';
import { getPartySettings } from '../services/party-settings.js';
import { updatePartyGuarantorHolds, updateTenantIgnoreImportUpdateOptimizationUntilFlag } from '../helpers/settings';
import { getAllPropertySettingsByKey } from '../dal/propertyRepo';
import { importMarketingLayoutGroups } from './inventory/marketingLayoutGroups';
import { importMarketingLayouts } from './inventory/marketingLayouts';
import { importMarketingAssets } from './inventory/marketingAsset';
import { checkForMissingColumns } from './helpers/inventory';
import { importIntegrationSettings } from './inventory/integrationSettings';
import { importRxpSettings } from './inventory/rxpSettings';
import { importLeaseDocumentTemplate } from './inventory/leaseDocumentTemplate';

const logger = loggerModule.child({ subType: 'Data Import' });
const HEADER_ROW_INDEX = 1;

export const isEmptyRow = obj => !obj || !Object.keys(obj).some(key => obj[key]);

export const getEntitiesFromSheet = (workbookSheet, initialRowParam, batchSizeParam, rowToPropertyFunction) => {
  try {
    const batchSize = typeof batchSizeParam === 'undefined' || batchSizeParam > workbookSheet.length ? workbookSheet.length : batchSizeParam;

    const initialRow = typeof initialRowParam === 'undefined' ? 0 : initialRowParam;
    const entitiesArray = [];

    for (let i = initialRow; i < initialRow + batchSize; i++) {
      const row = workbookSheet[i];
      if (!isEmptyRow(row)) {
        entitiesArray.push({
          index: i + HEADER_ROW_INDEX,
          data: rowToPropertyFunction(row),
        });
      }
    }
    return entitiesArray;
  } catch (error) {
    logger.error({ error }, 'Failed while getting entities from sheet');
    return null;
  }
};

export const getBusinessEntityFromWorkbook = (workbookSheet, initialRow, batchSize, columnHeaders) =>
  getEntitiesFromSheet(workbookSheet, initialRow, batchSize, row => {
    const businessEntity = pick(row, columnHeaders);

    businessEntity.contactInfo = {
      name: row.name,
      email: row.email,
      phone: row.phone,
    };

    return businessEntity;
  });

export const getPropertyGroupFromWorkbook = (workbookSheet, initialRow, batchSize, columnHeaders) =>
  getEntitiesFromSheet(workbookSheet, initialRow, batchSize, row => pick(row, columnHeaders));

const getBuildingFromWorkbook = (workbookSheet, initialRow, batchSize, columnHeaders) =>
  getEntitiesFromSheet(workbookSheet, initialRow, batchSize, row => {
    const building = pick(row, columnHeaders);

    return building;
  });

export const getPropertyFromWorkbook = (workbookSheet, initialRow, batchSize, columnHeaders) =>
  getEntitiesFromSheet(workbookSheet, initialRow, batchSize, row => {
    const property = pick(row, columnHeaders);

    property.contactInfo = {
      name: row.name,
      email: row.email,
      phone: row.phone,
    };

    return property;
  });

const getPropertyCloseScheduleFromWorkbook = (workbookSheet, initialRow, batchSize, columnHeaders) =>
  getEntitiesFromSheet(workbookSheet, initialRow, batchSize, row => pick(row, columnHeaders));

const getLayoutsFromWorkbook = (workbookSheet, initialRow, batchSize, columnHeaders) =>
  getEntitiesFromSheet(workbookSheet, initialRow, batchSize, row => {
    const layout = pick(row, columnHeaders);

    return layout;
  });

const getInventoryFromWorkbook = (workbookSheet, initialRow, batchSize, columnHeaders) =>
  getEntitiesFromSheet(workbookSheet, initialRow, batchSize, row => {
    const inventory = pick(row, columnHeaders);

    inventory.multipleItemTotal = row.multipleItemTotal ? row.multipleItemTotal : null;
    inventory.layout = row.layout ? row.layout : null;

    return inventory;
  });

const getAmenitesFromWorkbook = (workbookSheet, initialRow, batchSize, columnHeaders) =>
  getEntitiesFromSheet(workbookSheet, initialRow, batchSize, row => pick(row, columnHeaders));

export const getLifestylesFromWorkbook = (woorkbookSheet, initialRow, batchSize, columnHeaders) =>
  getEntitiesFromSheet(woorkbookSheet, initialRow, batchSize, row => pick(row, columnHeaders));

const getLeaseNameFromWorkbook = (workbookSheet, initialRow, batchSize, columnHeaders) =>
  getEntitiesFromSheet(workbookSheet, initialRow, batchSize, row => pick(row, columnHeaders));

const getLeaseTermFromWorkbook = (workbookSheet, initialRow, batchSize, columnHeaders) =>
  getEntitiesFromSheet(workbookSheet, initialRow, batchSize, row => pick(row, columnHeaders));

const getConcessionFromWorkbook = (workbookSheet, initialRow, batchSize, columnHeaders) =>
  getEntitiesFromSheet(workbookSheet, initialRow, batchSize, row => pick(row, columnHeaders));

const getEmployeesFromWorkbook = (workbookSheet, initialRow, batchSize, columnHeaders) =>
  getEntitiesFromSheet(workbookSheet, initialRow, batchSize, row => pick(row, columnHeaders));

const getTeamsFromWorkbook = (workbookSheet, initialRow, batchSize, columnHeaders) =>
  getEntitiesFromSheet(workbookSheet, initialRow, batchSize, row => pick(row, columnHeaders));

const getTeamMembersFromWorkbook = (workbookSheet, initialRow, batchSize, columnHeaders) =>
  getEntitiesFromSheet(workbookSheet, initialRow, batchSize, row => pick(row, columnHeaders));

const getSourcesFromWorkbook = (workbookSheet, initialRow, batchSize, columnHeaders) =>
  getEntitiesFromSheet(workbookSheet, initialRow, batchSize, row => pick(row, columnHeaders));

const getProgramReferencesFromWorkbook = (workbookSheet, initialRow, batchSize, columnHeaders) =>
  getEntitiesFromSheet(workbookSheet, initialRow, batchSize, row => pick(row, columnHeaders));

const getCampaignsFromWorkbook = (workbookSheet, initialRow, batchSize, columnHeaders) =>
  getEntitiesFromSheet(workbookSheet, initialRow, batchSize, row => pick(row, columnHeaders));

const getProgramsFromWorkbook = (workbookSheet, initialRow, batchSize, columnHeaders) =>
  getEntitiesFromSheet(workbookSheet, initialRow, batchSize, row => pick(row, columnHeaders));

const getProgramReferrersFromWorkbook = (workbookSheet, initialRow, batchSize, columnHeaders) =>
  getEntitiesFromSheet(workbookSheet, initialRow, batchSize, row => pick(row, columnHeaders));

const getInventoryGroupFromInventory = (workbookSheet, initialRow, batchSize, columnHeaders) =>
  getEntitiesFromSheet(workbookSheet, initialRow, batchSize, row => pick(row, columnHeaders));

const getFeeFromWorkbook = (workbookSheet, initialRow, batchSize, columnHeaders) =>
  getEntitiesFromSheet(workbookSheet, initialRow, batchSize, row => pick(row, columnHeaders));

export const getCommsTemplatesFromWorkbook = (workbookSheet, initialRow, batchSize, columnHeaders) =>
  getEntitiesFromSheet(workbookSheet, initialRow, batchSize, row => pick(row, columnHeaders));

export const getCommsTemplatesSettingsFromWorkbook = (workbookSheet, initialRow, batchSize, columnHeaders) =>
  getEntitiesFromSheet(workbookSheet, initialRow, batchSize, row => pick(row, columnHeaders));

const getDisclosuresFromWorkbook = (workbookSheet, initialRow, batchSize, columnHeaders) =>
  getEntitiesFromSheet(workbookSheet, initialRow, batchSize, row => pick(row, columnHeaders));

const getPropertySettingsFromWorkbook = (workbookSheet, initialRow, batchSize, columnHeaders) =>
  getEntitiesFromSheet(workbookSheet, initialRow, batchSize, row => pick(row, columnHeaders));

export const getGlobalSettingsFromWorkbook = (workbookSheet, initialRow, batchSize, columnHeaders) =>
  getEntitiesFromSheet(workbookSheet, initialRow, batchSize, row => pick(row, columnHeaders));

const getTeamSalesTargetsFromWorkbook = (workbookSheet, initialRow, batchSize, columnHeaders) =>
  getEntitiesFromSheet(workbookSheet, initialRow, batchSize, row => pick(row, columnHeaders));

const getTeamMemberSalesTargetsFromWorkbook = (workbookSheet, initialRow, batchSize, columnHeaders) =>
  getEntitiesFromSheet(workbookSheet, initialRow, batchSize, row => pick(row, columnHeaders));

const getOfficeHoursFromWorkbook = (workbookSheet, initialRow, batchSize, columnHeaders) =>
  getEntitiesFromSheet(workbookSheet, initialRow, batchSize, row => pick(row, columnHeaders));

const getTeamSettingsFromWorkbook = (workbookSheet, initialRow, batchSize, columnHeaders) =>
  getEntitiesFromSheet(workbookSheet, initialRow, batchSize, row => pick(row, columnHeaders));

const getExternalPhonesFromWorkbook = (workbookSheet, initialRow, batchSize, columnHeaders) =>
  getEntitiesFromSheet(workbookSheet, initialRow, batchSize, row => pick(row, columnHeaders));

const getOutgoingCallsFromWorkbook = (workbookSheet, initialRow, batchSize, columnHeaders) =>
  getEntitiesFromSheet(workbookSheet, initialRow, batchSize, row => pick(row, columnHeaders));

const getApplicationSettingsFromWorkbook = (workbookSheet, initialRow, batchSize, columnHeaders) =>
  getEntitiesFromSheet(workbookSheet, initialRow, batchSize, row => pick(row, columnHeaders));

const getPartySettingsFromWorkbook = (workbookSheet, initialRow, batchSize, columnHeaders) =>
  getEntitiesFromSheet(workbookSheet, initialRow, batchSize, row => pick(row, columnHeaders));

const getVoiceMessagesFromImport = (workbookSheet, initialRow, batchSize, columnHeaders) =>
  getEntitiesFromSheet(workbookSheet, initialRow, batchSize, row => pick(row, columnHeaders));

const getVoiceMenuItemsFromImport = (workbookSheet, initialRow, batchSize, columnHeaders) =>
  getEntitiesFromSheet(workbookSheet, initialRow, batchSize, row => pick(row, columnHeaders));

export const getTemplateShortCodesFromWorkbook = (workbookSheet, initialRow, batchSize, columnHeaders) =>
  getEntitiesFromSheet(workbookSheet, initialRow, batchSize, row => pick(row, columnHeaders));

const getScreeningCriteriasFromWorkbook = (workbookSheet, initialRow, batchSize, columnHeaders) =>
  getEntitiesFromSheet(workbookSheet, initialRow, batchSize, row => pick(row, columnHeaders));

const getPropertyPartySettingsFromWorkbook = (workbookSheet, initialRow, batchSize, columnHeaders) =>
  getEntitiesFromSheet(workbookSheet, initialRow, batchSize, row => pick(row, columnHeaders));

const getMarketingQuestionsFromWorkbook = (workbookSheet, initialRow, batchSize, columnHeaders) =>
  getEntitiesFromSheet(workbookSheet, initialRow, batchSize, row => pick(row, columnHeaders));

const getMarketingLayoutGroupsFromWorkbook = (workbookSheet, initialRow, batchSize, columnHeaders) =>
  getEntitiesFromSheet(workbookSheet, initialRow, batchSize, row => pick(row, columnHeaders));

const getMarketingLayoutsFromWorkbook = (workbookSheet, initialRow, batchSize, columnHeaders) =>
  getEntitiesFromSheet(workbookSheet, initialRow, batchSize, row => pick(row, columnHeaders));

const getMarketingAssetsFromWorkbook = (workbookSheet, initialRow, batchSize, columnHeaders) =>
  getEntitiesFromSheet(workbookSheet, initialRow, batchSize, row => pick(row, columnHeaders));

const getMarketingSearchFromWorkbook = (workbookSheet, initialRow, batchSize, columnHeaders) =>
  getEntitiesFromSheet(workbookSheet, initialRow, batchSize, row => pick(row, columnHeaders));

const getRxpSettingsFromWorkbook = (workbookSheet, initialRow, batchSize, columnHeaders) =>
  getEntitiesFromSheet(workbookSheet, initialRow, batchSize, row => pick(row, columnHeaders));

const getIntegrationSettingsFromWorkbook = (workbookSheet, initialRow, batchSize, columnHeaders) =>
  getEntitiesFromSheet(workbookSheet, initialRow, batchSize, row => pick(row, columnHeaders));

const getLeaseTemplatesFromWorkbook = (workbookSheet, initialRow, batchSize, columnHeaders) =>
  getEntitiesFromSheet(workbookSheet, initialRow, batchSize, row => pick(row, columnHeaders));

export const getPartyCohortsFromWorkbook = (workbookSheet, initialRow, batchSize, columnHeaders) =>
  getEntitiesFromSheet(workbookSheet, initialRow, batchSize, row => pick(row, columnHeaders));

const mapColumnNameToColumnIndex = workbookSheet => {
  const firstRow = workbookSheet[0] || {};
  return Object.keys(firstRow).reduce((map, key, index) => map.set(key, index), new Map());
};

const getCellsFromInvalidValues = (workbookSheetName, workbookSheet, invalidValues) => {
  const invalidCells = [];
  const mapNameToColumn = mapColumnNameToColumnIndex(workbookSheet);

  (invalidValues || []).forEach(invalidValue => {
    invalidValue?.invalidFields?.forEach?.(invalidField => {
      invalidCells.push({
        column: mapNameToColumn.get(invalidField.name),
        row: invalidValue.index,
        fieldName: invalidField.name,
        comment: invalidField.message,
        sheetName: workbookSheetName,
      });
    });
  });
  return invalidCells;
};

const BATCH_SIZE_ALL = 'all';

// List of sheets to be processed, have to be in order of prerequisites
// First Business Entities, then Property Groups and so on.
export const ALL_SHEETS = [
  {
    workbookSheetName: spreadsheet.GlobalSetting.workbookSheetName,
    getEntities: getGlobalSettingsFromWorkbook,
    importEntities: importGlobalSettings,
    headers: spreadsheet.GlobalSetting.columns,
  },
  {
    workbookSheetName: spreadsheet.PartySetting.workbookSheetName,
    getEntities: getPartySettingsFromWorkbook,
    importEntities: importPartySettings,
    headers: spreadsheet.PartySetting.columns,
  },
  {
    workbookSheetName: spreadsheet.BusinessEntity.workbookSheetName,
    getEntities: getBusinessEntityFromWorkbook,
    importEntities: importBusinessEntities,
    headers: spreadsheet.BusinessEntity.columns,
  },
  {
    workbookSheetName: spreadsheet.PropertyGroup.workbookSheetName,
    getEntities: getPropertyGroupFromWorkbook,
    importEntities: importPropertyGroups,
    headers: spreadsheet.PropertyGroup.columns,
  },
  {
    workbookSheetName: spreadsheet.Disclosure.workbookSheetName,
    getEntities: getDisclosuresFromWorkbook,
    importEntities: importDisclosures,
    headers: spreadsheet.Disclosure.columns,
  },
  {
    workbookSheetName: spreadsheet.PartyCohorts.workbookSheetName,
    getEntities: getPartyCohortsFromWorkbook,
    importEntities: importPartyCohorts,
    headers: spreadsheet.PartyCohorts.columns,
  },
  {
    workbookSheetName: spreadsheet.Property.workbookSheetName,
    getEntities: getPropertyFromWorkbook,
    importEntities: importProperties,
    additionalProcess: additionalPropertyProcess,
    isAllowedForCustomerAdmin: true,
    headers: spreadsheet.Property.columns,
  },
  {
    workbookSheetName: spreadsheet.PropertyCloseSchedule.workbookSheetName,
    getEntities: getPropertyCloseScheduleFromWorkbook,
    importEntities: importPropertyCloseSchedules,
    headers: spreadsheet.PropertyCloseSchedule.columns,
  },
  {
    workbookSheetName: spreadsheet.ApplicationSetting.workbookSheetName,
    getEntities: getApplicationSettingsFromWorkbook,
    importEntities: importApplicationSettings,
    headers: spreadsheet.ApplicationSetting.columns,
  },
  {
    workbookSheetName: spreadsheet.IntegrationSettings.workbookSheetName,
    getEntities: getIntegrationSettingsFromWorkbook,
    importEntities: importIntegrationSettings,
    headers: spreadsheet.IntegrationSettings.columns,
  },
  {
    workbookSheetName: spreadsheet.RxpSettings.workbookSheetName,
    getEntities: getRxpSettingsFromWorkbook,
    importEntities: importRxpSettings,
    headers: spreadsheet.RxpSettings.columns,
  },
  {
    workbookSheetName: spreadsheet.Source.workbookSheetName,
    getEntities: getSourcesFromWorkbook,
    importEntities: importSources,
    headers: spreadsheet.Source.columns,
  },
  {
    workbookSheetName: spreadsheet.CommsTemplate.workbookSheetName,
    getEntities: getCommsTemplatesFromWorkbook,
    importEntities: importCommsTemplates,
    headers: spreadsheet.CommsTemplate.columns,
  },
  {
    workbookSheetName: spreadsheet.CommsTemplateSettings.workbookSheetName,
    getEntities: getCommsTemplatesSettingsFromWorkbook,
    importEntities: importCommsTemplateSettings,
    headers: spreadsheet.CommsTemplateSettings.columns,
  },
  {
    workbookSheetName: spreadsheet.VoiceMenuItems.workbookSheetName,
    getEntities: getVoiceMenuItemsFromImport,
    importEntities: importVoiceMenuItems,
    headers: spreadsheet.VoiceMenuItems.columns,
  },
  {
    workbookSheetName: spreadsheet.VoiceMessages.workbookSheetName,
    getEntities: getVoiceMessagesFromImport,
    importEntities: importVoiceMessages,
    headers: spreadsheet.VoiceMessages.columns,
  },
  {
    workbookSheetName: spreadsheet.Team.workbookSheetName,
    getEntities: getTeamsFromWorkbook,
    importEntities: importTeams,
    additionalProcess: additionalTeamProcess,
    isAllowedForCustomerAdmin: true,
    headers: spreadsheet.Team.columns,
  },
  {
    workbookSheetName: spreadsheet.TeamSetting.workbookSheetName,
    getEntities: getTeamSettingsFromWorkbook,
    importEntities: importTeamSettings,
    headers: spreadsheet.TeamSetting.columns,
  },
  {
    workbookSheetName: spreadsheet.Campaign.workbookSheetName,
    getEntities: getCampaignsFromWorkbook,
    importEntities: importCampaigns,
    headers: spreadsheet.Campaign.columns,
  },
  {
    workbookSheetName: spreadsheet.Program.workbookSheetName,
    getEntities: getProgramsFromWorkbook,
    importEntities: importPrograms,
    additionalProcess: additionalProgramsProcess,
    headers: spreadsheet.Program.columns,
    batchSize: BATCH_SIZE_ALL,
  },
  {
    workbookSheetName: spreadsheet.Amenity.workbookSheetName,
    getEntities: getAmenitesFromWorkbook,
    importEntities: importAmenities,
    additionalProcess: additionalAmenityProcess,
    isAllowedForCustomerAdmin: true,
    headers: spreadsheet.Amenity.columns,
  },
  {
    workbookSheetName: spreadsheet.Lifestyle.workbookSheetName,
    getEntities: getLifestylesFromWorkbook,
    importEntities: importLifestyles,
    headers: spreadsheet.Lifestyle.columns,
  },
  {
    workbookSheetName: spreadsheet.MarketingQuestions.workbookSheetName,
    getEntities: getMarketingQuestionsFromWorkbook,
    importEntities: importMarketingQuestions,
    headers: spreadsheet.MarketingQuestions.columns,
  },
  {
    workbookSheetName: spreadsheet.MarketingLayoutGroups.workbookSheetName,
    getEntities: getMarketingLayoutGroupsFromWorkbook,
    importEntities: importMarketingLayoutGroups,
    headers: spreadsheet.MarketingLayoutGroups.columns,
  },
  {
    workbookSheetName: spreadsheet.MarketingAssets.workbookSheetName,
    getEntities: getMarketingAssetsFromWorkbook,
    importEntities: importMarketingAssets,
    headers: spreadsheet.MarketingAssets.columns,
  },
  {
    workbookSheetName: spreadsheet.MarketingLayouts.workbookSheetName,
    getEntities: getMarketingLayoutsFromWorkbook,
    importEntities: importMarketingLayouts,
    headers: spreadsheet.MarketingLayouts.columns,
  },
  {
    workbookSheetName: spreadsheet.PropertySetting.workbookSheetName,
    getEntities: getPropertySettingsFromWorkbook,
    importEntities: importPropertySettings,
    headers: spreadsheet.PropertySetting.columns,
  },
  {
    workbookSheetName: spreadsheet.Building.workbookSheetName,
    getEntities: getBuildingFromWorkbook,
    importEntities: importBuildings,
    isAllowedForCustomerAdmin: true,
    headers: spreadsheet.Building.columns,
  },
  {
    workbookSheetName: spreadsheet.LeaseName.workbookSheetName,
    getEntities: getLeaseNameFromWorkbook,
    importEntities: importLeaseNames,
    headers: spreadsheet.LeaseName.columns,
  },
  {
    workbookSheetName: spreadsheet.LeaseTerm.workbookSheetName,
    getEntities: getLeaseTermFromWorkbook,
    importEntities: importLeaseTerms,
    headers: spreadsheet.LeaseTerm.columns,
    batchSize: BATCH_SIZE_ALL,
  },
  {
    workbookSheetName: spreadsheet.Layout.workbookSheetName,
    getEntities: getLayoutsFromWorkbook,
    importEntities: importLayouts,
    headers: spreadsheet.Layout.columns,
    batchSize: BATCH_SIZE_ALL,
  },
  {
    workbookSheetName: spreadsheet.Fee.workbookSheetName,
    getEntities: getFeeFromWorkbook,
    importEntities: importFees,
    additionalProcess: additionalFeeProcess,
    headers: spreadsheet.Fee.columns,
  },
  {
    workbookSheetName: spreadsheet.InventoryGroup.workbookSheetName,
    getEntities: getInventoryGroupFromInventory,
    importEntities: importInventoryGroups,
    isAllowedForCustomerAdmin: true,
    headers: spreadsheet.InventoryGroup.columns,
    batchSize: BATCH_SIZE_ALL,
  },
  {
    workbookSheetName: spreadsheet.Inventory.workbookSheetName,
    getEntities: getInventoryFromWorkbook,
    importEntities: importInventories,
    additionalProcess: additionalInventoryProcess,
    isAllowedForCustomerAdmin: true,
    headers: spreadsheet.Inventory.columns,
  },
  {
    workbookSheetName: spreadsheet.Concession.workbookSheetName,
    getEntities: getConcessionFromWorkbook,
    importEntities: importConcessions,
    headers: spreadsheet.Concession.columns,
  },
  {
    workbookSheetName: spreadsheet.Employee.workbookSheetName,
    getEntities: getEmployeesFromWorkbook,
    importEntities: importEmployees,
    isAllowedForCustomerAdmin: true,
    headers: spreadsheet.Employee.columns,
  },
  {
    workbookSheetName: spreadsheet.TeamSalesTarget.workbookSheetName,
    getEntities: getTeamSalesTargetsFromWorkbook,
    importEntities: importTeamSalesTargets,
    headers: spreadsheet.TeamSalesTarget.columns,
  },
  {
    workbookSheetName: spreadsheet.TeamMember.workbookSheetName,
    getEntities: getTeamMembersFromWorkbook,
    importEntities: importTeamMembers,
    additionalProcess: additionalTeamMembersValidation,
    isAllowedForCustomerAdmin: true,
    headers: spreadsheet.TeamMember.columns,
  },
  {
    workbookSheetName: spreadsheet.TeamMemberSalesTarget.workbookSheetName,
    getEntities: getTeamMemberSalesTargetsFromWorkbook,
    importEntities: importTeamMemberSalesTargets,
    headers: spreadsheet.TeamMemberSalesTarget.columns,
  },
  {
    workbookSheetName: spreadsheet.OfficeHour.workbookSheetName,
    getEntities: getOfficeHoursFromWorkbook,
    importEntities: importOfficeHours,
    headers: spreadsheet.OfficeHour.columns,
  },
  {
    workbookSheetName: spreadsheet.ExternalPhone.workbookSheetName,
    getEntities: getExternalPhonesFromWorkbook,
    importEntities: importExternalPhones,
    headers: spreadsheet.ExternalPhone.columns,
  },
  {
    workbookSheetName: spreadsheet.ProgramReferences.workbookSheetName,
    getEntities: getProgramReferencesFromWorkbook,
    importEntities: importProgramReferences,
    headers: spreadsheet.ProgramReferences.columns,
  },
  {
    workbookSheetName: spreadsheet.ProgramReferrer.workbookSheetName,
    getEntities: getProgramReferrersFromWorkbook,
    importEntities: importProgramReferrers,
    headers: spreadsheet.ProgramReferrer.columns,
    batchSize: BATCH_SIZE_ALL,
  },
  {
    workbookSheetName: spreadsheet.OutgoingCall.workbookSheetName,
    getEntities: getOutgoingCallsFromWorkbook,
    importEntities: importOutgoingCalls,
    headers: spreadsheet.OutgoingCall.columns,
  },
  {
    workbookSheetName: spreadsheet.TemplateShortCode.workbookSheetName,
    getEntities: getTemplateShortCodesFromWorkbook,
    importEntities: importTemplateShortCodes,
    headers: spreadsheet.TemplateShortCode.columns,
  },
  {
    workbookSheetName: spreadsheet.ScreeningCriteria.workbookSheetName,
    getEntities: getScreeningCriteriasFromWorkbook,
    importEntities: importScreeningCriterias,
    headers: spreadsheet.ScreeningCriteria.columns,
  },
  {
    workbookSheetName: spreadsheet.PropertyPartySettings.workbookSheetName,
    getEntities: getPropertyPartySettingsFromWorkbook,
    importEntities: importPropertyPartySettings,
    headers: spreadsheet.PropertyPartySettings.columns,
  },
  {
    workbookSheetName: spreadsheet.MarketingSearch.workbookSheetName,
    getEntities: getMarketingSearchFromWorkbook,
    importEntities: importMarketingSearch,
    headers: spreadsheet.MarketingSearch.columns,
  },
  {
    workbookSheetName: spreadsheet.LeaseTemplates.workbookSheetName,
    getEntities: getLeaseTemplatesFromWorkbook,
    importEntities: importLeaseDocumentTemplate,
    headers: spreadsheet.LeaseTemplates.columns,
  },
];

const CUSTOMER_ADMIN_SHEETS = ALL_SHEETS.filter(sheet => sheet.isAllowedForCustomerAdmin);

const additionalProcessAndGetCustomErrors = async (ctx, sheetObject, { validEntities, invalidEntities }) => {
  if (!sheetObject.additionalProcess) return [];

  return await sheetObject.additionalProcess(ctx, validEntities, invalidEntities);
};

const checkMissingColumnsAndThrowError = (columnHeadersFromSheet, expectedColumnHeaders) => {
  const missingColumns = checkForMissingColumns(columnHeadersFromSheet, expectedColumnHeaders);

  if (missingColumns.length) {
    throw new SheetImportError({ message: `Following column headers not found: ${missingColumns.join(',')}` });
  }
};

const checkForMissingSheets = sheetNames => {
  const employeeAndTeamMembersWorkbooks = sheetNames.filter(
    key => key === spreadsheet.Employee.workbookSheetName || key === spreadsheet.TeamMember.workbookSheetName.replace(' ', ''),
  );
  if (employeeAndTeamMembersWorkbooks.length === 1) {
    throw new SheetImportError({
      message: `Import both ${spreadsheet.Employee.workbookSheetName} and ${spreadsheet.TeamMember.workbookSheetName} sheets or none of them`,
    });
  }
};

export const processWorkbook = async (ctx, workbook, sheetsObjects) => {
  checkForMissingSheets(Object.keys(workbook));

  let invalidCells = [];
  const entityCounts = [];
  const executionTimes = {};

  for (let i = 0; i < sheetsObjects.length; i++) {
    const sheetObject = sheetsObjects[i];
    const sheetJsonName = sheetObject.workbookSheetName.replace(/ /g, '');
    const expectedColumnHeaders = getColumnHeaders(sheetObject.headers);
    const { data, columnHeaders: columnHeadersFromSheet } = workbook[sheetJsonName] || {};

    logger.info({ ctx, sheetJsonName }, 'Importing sheet');

    if (workbook[sheetJsonName]) {
      try {
        let validEntities = [];
        let invalidEntities = [];
        let entitiesLeft = data.length;
        let initialRow = 0;

        checkMissingColumnsAndThrowError(columnHeadersFromSheet, expectedColumnHeaders);

        const totalImportTimeStart = performance.now();
        while (entitiesLeft > 0) {
          const batchSize = sheetObject.batchSize === BATCH_SIZE_ALL ? undefined : config.import.batchSize;
          const entities = sheetObject.getEntities(data, initialRow, batchSize, expectedColumnHeaders);
          logger.info({ ctx, sheetJsonName, numEntitiesImported: entities.length }, 'Done loading entities for import');
          if (entities.length > 0) entityCounts.push({ sheetName: sheetJsonName, count: entities.length });
          logger.time({ ctx }, `[IMPORT] - importEntities[${sheetJsonName}]`);

          const entitiesConvertedToExpectedType = convertEntitiesInAnExpectedType(entities, sheetObject.headers);
          const { invalidFields = [], validFields = [] } = (await sheetObject.importEntities(ctx, entitiesConvertedToExpectedType)) || {};
          logger.timeEnd({ ctx }, `[IMPORT] - importEntities[${sheetJsonName}]`);

          invalidEntities = invalidEntities.concat(invalidFields);
          validEntities = validEntities.concat(validFields);
          entitiesLeft -= batchSize;
          initialRow += batchSize;
        }

        const customErrors = await additionalProcessAndGetCustomErrors(ctx, sheetObject, { validEntities, invalidEntities });
        invalidEntities = invalidEntities.concat(customErrors);

        const sheetInvalidCells = getCellsFromInvalidValues(sheetObject.workbookSheetName, data, invalidEntities);
        invalidCells = invalidCells.concat(sheetInvalidCells);

        const totalImportTimeEnd = performance.now();
        executionTimes[sheetJsonName] = (totalImportTimeEnd - totalImportTimeStart).toFixed(5);
      } catch (error) {
        if (error instanceof SheetImportError && error.invalidCells) {
          const sheetInvalidCells = getCellsFromInvalidValues(sheetObject.workbookSheetName, data, error.invalidCells);
          invalidCells = invalidCells.concat(sheetInvalidCells);
        }

        throw new SheetImportError({
          message: error.message,
          sheetName: sheetJsonName,
          invalidCells,
        });
      }
    }
  }

  return {
    invalidCells,
    entityCounts,
    executionTimes,
  };
};

const cleanUpData = async ctx => await removeUnassignedAddress(ctx);

export const enforceInventoryFileNameAndEnvironmentInProd = (filePath, tenantName) => {
  const expectedPrefix = `${tenantName} Prod`;

  const fileName = path.basename(filePath, path.extname(filePath));
  if (!fileName.toLowerCase().startsWith(expectedPrefix.toLowerCase())) {
    throw new SheetImportError(`Spreadsheets uploaded must have the prefix: ${tenantName} Prod`);
  }
};

const getPercentOfTimeImport = (executionTimes, totalTime) =>
  Object.keys(executionTimes).reduce((acc, sheetName) => {
    const percent = (executionTimes[sheetName] * 100) / totalTime;
    acc[sheetName] = `${executionTimes[sheetName]} ms - ${percent} %`;
    return acc;
  }, {});

export const importInventory = async (ctx, filePath, originalFilePath, authUser) => {
  try {
    logger.time({ ctx }, '[IMPORT] - GLOBAL');
    const tenant = await getTenant(ctx);
    config.isProdEnv && enforceInventoryFileNameAndEnvironmentInProd(originalFilePath || filePath, tenant.name);
    const isCustomerAdminUser = isCustomerAdmin(authUser);
    const workbook = await parse(filePath);
    const oldPartySettings = await getPartySettings(ctx);
    const oldPropertySettings = await getAllPropertySettingsByKey(ctx, 'integration');

    const timeStart = performance.now();
    const { invalidCells, entityCounts, executionTimes } = await processWorkbook(
      { ...ctx, tenant },
      workbook,
      isCustomerAdminUser ? CUSTOMER_ADMIN_SHEETS : ALL_SHEETS,
    );
    const timeEnd = performance.now();

    const totalTime = timeEnd - timeStart;
    logger.info(getPercentOfTimeImport(executionTimes, totalTime), `[IMPORT] - Total time: ${Math.round(totalTime)} ms`);
    const newPartySettings = await getPartySettings(ctx);
    const partySettingsDiff = diff(oldPartySettings, newPartySettings);
    await updatePartyGuarantorHolds(ctx, partySettingsDiff);

    const newPropertySettings = await getAllPropertySettingsByKey(ctx, 'integration');
    const propertySettingsDiff = diff(oldPropertySettings, newPropertySettings);
    await updateTenantIgnoreImportUpdateOptimizationUntilFlag(tenant, propertySettingsDiff);

    await cleanUpData(ctx);
    logger.timeEnd({ ctx }, '[IMPORT] - GLOBAL');
    return { invalidCells, entityCounts };
  } catch (error) {
    const hasInvalidCells = error instanceof SheetImportError && error.invalidCells;
    const invalidCells = hasInvalidCells ? error.invalidCells : [];
    hasInvalidCells && delete error.invalidCells;

    logger.error({ ctx, error }, error.message);
    return { invalidCells, error };
  }
};
