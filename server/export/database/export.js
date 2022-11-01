/*
 * Copyright (c) 2022 Reva Technology Inc., all rights reserved.
 * Unauthorized copying of this file, via any medium is strictly prohibited
 * Licensed under the Elastic License 2.0; you may not use this file except
 * in compliance with the Elastic License 2.0.
 */

import { spreadsheet } from '../../../common/helpers/spreadsheet';
import { getColumnsInTheImportOrder } from '../helpers/export';
import { removeSpacesBetweenWords } from '../../helpers/importUtils';
import {
  exportProperties,
  exportPropertyGroups,
  exportBusinessEntity,
  exportPropertyCloseSchedule,
  exportInventory,
  exportBuildings,
  exportAmenities,
  exportLeaseNames,
  exportLeaseTerms,
  exportLayouts,
  exportInventoryGroups,
  exportFees,
  exportConcessions,
  exportEmployees,
  exportTeamMembers,
  exportTeams,
  exportTeamSettings,
  exportPropertySettings,
  exportPartySettings,
  exportApplicationSettings,
  exportGlobalSettings,
  exportDisclosures,
  exportTeamSalesTargets,
  exportTeamMemberSalesTargets,
  exportOfficeHours,
  exportSources,
  exportCampaigns,
  exportPrograms,
  exportProgramReferrers,
  exportVoiceMessages,
  exportVoiceMenuItems,
  exportCommsTemplates,
  exportCommsTemplateSettings,
  exportTemplateShortCodes,
  exportOutgoingCalls,
  exportExternalPhones,
  exportScreeningCriterias,
  exportPropertyPartySettings,
  exportProgramReferences,
  exportMarketingLayoutGroups,
  exportMarketingLayouts,
  exportMarketingAssets,
  exportLifestyles,
  exportMarketingQuestions,
  exportMarketingSearch,
  exportIntegrationSettings,
  exportRxpSettings,
  exportLeaseDocumentTemplate,
  exportPartyCohorts,
} from './exportSheet';

const SHEETS = [
  {
    workbookSheetName: spreadsheet.BusinessEntity.workbookSheetName,
    exportData: exportBusinessEntity,
  },
  {
    workbookSheetName: spreadsheet.PropertyGroup.workbookSheetName,
    exportData: exportPropertyGroups,
  },
  {
    workbookSheetName: spreadsheet.Property.workbookSheetName,
    exportData: exportProperties,
  },
  {
    workbookSheetName: spreadsheet.PartyCohorts.workbookSheetName,
    exportData: exportPartyCohorts,
  },
  {
    workbookSheetName: spreadsheet.PropertyCloseSchedule.workbookSheetName,
    exportData: exportPropertyCloseSchedule,
  },
  {
    workbookSheetName: spreadsheet.Inventory.workbookSheetName,
    exportData: exportInventory,
  },
  {
    workbookSheetName: spreadsheet.Building.workbookSheetName,
    exportData: exportBuildings,
  },
  {
    workbookSheetName: spreadsheet.Amenity.workbookSheetName,
    exportData: exportAmenities,
  },
  {
    workbookSheetName: spreadsheet.LeaseName.workbookSheetName,
    exportData: exportLeaseNames,
  },
  {
    workbookSheetName: spreadsheet.LeaseTerm.workbookSheetName,
    exportData: exportLeaseTerms,
  },
  {
    workbookSheetName: spreadsheet.Layout.workbookSheetName,
    exportData: exportLayouts,
  },
  {
    workbookSheetName: spreadsheet.InventoryGroup.workbookSheetName,
    exportData: exportInventoryGroups,
  },
  {
    workbookSheetName: spreadsheet.Fee.workbookSheetName,
    exportData: exportFees,
  },
  {
    workbookSheetName: spreadsheet.Concession.workbookSheetName,
    exportData: exportConcessions,
  },
  {
    workbookSheetName: spreadsheet.Employee.workbookSheetName,
    exportData: exportEmployees,
  },
  {
    workbookSheetName: spreadsheet.TeamMember.workbookSheetName,
    exportData: exportTeamMembers,
  },
  {
    workbookSheetName: spreadsheet.Team.workbookSheetName,
    exportData: exportTeams,
  },
  {
    workbookSheetName: spreadsheet.TeamSetting.workbookSheetName,
    exportData: exportTeamSettings,
  },
  {
    workbookSheetName: spreadsheet.PropertySetting.workbookSheetName,
    exportData: exportPropertySettings,
  },
  {
    workbookSheetName: spreadsheet.PartySetting.workbookSheetName,
    exportData: exportPartySettings,
  },
  {
    workbookSheetName: spreadsheet.ApplicationSetting.workbookSheetName,
    exportData: exportApplicationSettings,
  },
  {
    workbookSheetName: spreadsheet.GlobalSetting.workbookSheetName,
    exportData: exportGlobalSettings,
  },
  {
    workbookSheetName: spreadsheet.Disclosure.workbookSheetName,
    exportData: exportDisclosures,
  },
  {
    workbookSheetName: spreadsheet.TeamSalesTarget.workbookSheetName,
    exportData: exportTeamSalesTargets,
  },
  {
    workbookSheetName: spreadsheet.TeamMemberSalesTarget.workbookSheetName,
    exportData: exportTeamMemberSalesTargets,
  },
  {
    workbookSheetName: spreadsheet.OfficeHour.workbookSheetName,
    exportData: exportOfficeHours,
  },
  {
    workbookSheetName: spreadsheet.Source.workbookSheetName,
    exportData: exportSources,
  },
  {
    workbookSheetName: spreadsheet.Campaign.workbookSheetName,
    exportData: exportCampaigns,
  },
  {
    workbookSheetName: spreadsheet.Program.workbookSheetName,
    exportData: exportPrograms,
  },
  {
    workbookSheetName: spreadsheet.ProgramReferrer.workbookSheetName,
    exportData: exportProgramReferrers,
  },
  {
    workbookSheetName: spreadsheet.VoiceMessages.workbookSheetName,
    exportData: exportVoiceMessages,
  },
  {
    workbookSheetName: spreadsheet.VoiceMenuItems.workbookSheetName,
    exportData: exportVoiceMenuItems,
  },
  {
    workbookSheetName: spreadsheet.CommsTemplate.workbookSheetName,
    exportData: exportCommsTemplates,
  },
  {
    workbookSheetName: spreadsheet.CommsTemplateSettings.workbookSheetName,
    exportData: exportCommsTemplateSettings,
  },
  {
    workbookSheetName: spreadsheet.TemplateShortCode.workbookSheetName,
    exportData: exportTemplateShortCodes,
  },
  {
    workbookSheetName: spreadsheet.OutgoingCall.workbookSheetName,
    exportData: exportOutgoingCalls,
  },
  {
    workbookSheetName: spreadsheet.ExternalPhone.workbookSheetName,
    exportData: exportExternalPhones,
  },
  {
    workbookSheetName: spreadsheet.ScreeningCriteria.workbookSheetName,
    exportData: exportScreeningCriterias,
  },
  {
    workbookSheetName: spreadsheet.PropertyPartySettings.workbookSheetName,
    exportData: exportPropertyPartySettings,
  },
  {
    workbookSheetName: spreadsheet.ProgramReferences.workbookSheetName,
    exportData: exportProgramReferences,
  },
  {
    workbookSheetName: spreadsheet.MarketingLayoutGroups.workbookSheetName,
    exportData: exportMarketingLayoutGroups,
  },
  {
    workbookSheetName: spreadsheet.MarketingLayouts.workbookSheetName,
    exportData: exportMarketingLayouts,
  },
  {
    workbookSheetName: spreadsheet.MarketingAssets.workbookSheetName,
    exportData: exportMarketingAssets,
  },
  {
    workbookSheetName: spreadsheet.Lifestyle.workbookSheetName,
    exportData: exportLifestyles,
  },
  {
    workbookSheetName: spreadsheet.MarketingQuestions.workbookSheetName,
    exportData: exportMarketingQuestions,
  },
  {
    workbookSheetName: spreadsheet.MarketingSearch.workbookSheetName,
    columnHeaders: spreadsheet.MarketingSearch.columnHeaders,
    exportData: exportMarketingSearch,
  },
  {
    workbookSheetName: spreadsheet.IntegrationSettings.workbookSheetName,
    exportData: exportIntegrationSettings,
  },
  {
    workbookSheetName: spreadsheet.RxpSettings.workbookSheetName,
    exportData: exportRxpSettings,
  },
  {
    workbookSheetName: spreadsheet.LeaseTemplates.workbookSheetName,
    exportData: exportLeaseDocumentTemplate,
  },
];

export const getSheetsToExport = sheetsSelected =>
  sheetsSelected.reduce((acc, { sheetName }) => {
    const sheetFound = SHEETS.find(sheetObject => removeSpacesBetweenWords(sheetObject.workbookSheetName) === sheetName);
    if (sheetFound) acc.push(sheetFound);
    return acc;
  }, []);

export const exportDataByWorkbookSheet = async (ctx, workbookSheetsSelected, propertyIdsToExport) => {
  const dataPumps = [];
  const errors = [];
  const sheetsToExport = getSheetsToExport(workbookSheetsSelected);

  for (let i = 0; i < sheetsToExport.length; i++) {
    try {
      const columnHeaders = getColumnsInTheImportOrder(sheetsToExport[i].workbookSheetName, workbookSheetsSelected);
      const data = await sheetsToExport[i].exportData(ctx, { propertyIdsToExport, columnHeaders });

      dataPumps.push({
        sheetName: sheetsToExport[i].workbookSheetName,
        columnHeaders,
        data,
      });
    } catch (error) {
      errors.push({
        error: error.message,
        sheetName: sheetsToExport[i].workbookSheetName,
      });
    }
  }

  return {
    dataPumps,
    errors: !errors.length ? null : errors,
  };
};
