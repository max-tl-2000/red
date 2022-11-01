/*
 * Copyright (c) 2022 Reva Technology Inc., all rights reserved.
 * Unauthorized copying of this file, via any medium is strictly prohibited
 * Licensed under the Elastic License 2.0; you may not use this file except
 * in compliance with the Elastic License 2.0.
 */

import { isBoolean } from '../../common/helpers/type-of';
import { trimAndSplitByComma } from '../../common/regex';
import { sanitizeDirectEmailIdentifier } from '../../common/helpers/mails';
import { UTC_TIMEZONE, SIMPLE_DATE_US_FORMAT } from '../../common/date-constants';
import { parseAsInTimezone, toMoment, DATE_ISO_FORMAT } from '../../common/helpers/moment-utils';
import { spreadsheet } from '../../common/helpers/spreadsheet';
import { extractValuesFromCommaSeparatedString } from '../../common/helpers/strings';

export function translateFlagCellValue(value) {
  if (isBoolean(value)) return value;
  let flagValue = null;
  if (typeof value !== 'undefined') {
    const cellValue = value.toLowerCase();
    if (cellValue === 'x' || cellValue === 'true') {
      flagValue = true;
    } else if (cellValue === '' || cellValue === 'false') {
      flagValue = false;
    }
  }
  return flagValue;
}

const findElementByName = (name, elements) => elements.find(e => e.name === name);

export const findInvalidElements = (elementsNames, storedElements) => {
  const invalidElements = [];
  elementsNames.forEach(eName => {
    const element = storedElements.find(e => e.name === eName);
    if (!element) {
      invalidElements.push(eName);
    }
  });
  return invalidElements;
};

export const getMatchingElementsByName = (elementNames = [], storedElements = []) => {
  if (!elementNames.length || !storedElements.length) return [];

  return elementNames.reduce((acc, eName) => {
    const element = findElementByName(eName, storedElements);
    if (element) acc.push(element);

    return acc;
  }, []);
};

export const getMatchingElementIdsByName = (elementNames, storedElements) => getMatchingElementsByName(elementNames, storedElements).map(({ id }) => id);

export const validateIfElementsExist = validateObj => {
  let elementsIds = [];
  if (validateObj.elementsStr && validateObj.storedElements) {
    const elements = trimAndSplitByComma(validateObj.elementsStr);
    elementsIds = getMatchingElementIdsByName(elements, validateObj.storedElements);

    if (elements && elementsIds.length !== elements.length) {
      const invalidElements = findInvalidElements(elements, validateObj.storedElements);

      const errorObj = [
        {
          name: validateObj.columnName,
          message: `${validateObj.errorMessage}: ${invalidElements}`,
        },
      ];

      return {
        elements: null,
        invalidElements,
        error: errorObj,
      };
    }
  }
  return {
    elements: elementsIds.length > 0 ? elementsIds : null,
    error: [],
  };
};

export const formatCampaignForSave = campaign => ({
  name: campaign.name.trim(),
  displayName: campaign.displayName,
  description: campaign.description || null,
});

export const formatEndDate = endDate => parseAsInTimezone(endDate, { timezone: UTC_TIMEZONE, format: SIMPLE_DATE_US_FORMAT }).format(DATE_ISO_FORMAT);
export const formatDbEndDate = endDate => toMoment(endDate, { timezone: UTC_TIMEZONE }).format(DATE_ISO_FORMAT);

const getCommsForwardingData = program => {
  const forwardingEnabled = translateFlagCellValue(program.forwardingEnabledFlag || program.metadata?.commsForwardingData?.forwardingEnabled);
  return {
    forwardingEnabled,
    forwardEmailToExternalTarget:
      (forwardingEnabled &&
        (extractValuesFromCommaSeparatedString(program.forwardEmailToExternalTarget) ||
          extractValuesFromCommaSeparatedString(program.metadata?.commsForwardingData?.forwardEmailToExternalTarget))) ||
      null,
    forwardCallToExternalTarget:
      (forwardingEnabled && (program.forwardCallToExternalTarget || program.metadata?.commsForwardingData?.forwardCallToExternalTarget)) || null,
    forwardSMSToExternalTarget:
      (forwardingEnabled &&
        (extractValuesFromCommaSeparatedString(program.forwardSMSToExternalTarget) ||
          extractValuesFromCommaSeparatedString(program.metadata?.commsForwardingData?.forwardSMSToExternalTarget))) ||
      null,
  };
};

export const formatProgramForSave = (program, { programDirectPhoneNumber, programDisplayPhoneNumber } = {}, includeForeignKeys) => {
  const formattedProgram = {
    name: program.name.trim(),
    displayName: program.displayName,
    reportingDisplayName: program.reportingDisplayName.trim(),
    description: program.description || null,
    directEmailIdentifier: sanitizeDirectEmailIdentifier(program.directEmailIdentifier || null),
    outsideDedicatedEmails: program.outsideDedicatedEmails ? program.outsideDedicatedEmails.split(',').map(email => email.trim()) : [],
    directPhoneIdentifier: programDirectPhoneNumber || null,
    displayPhoneNumber: programDisplayPhoneNumber || null,
    displayEmail: program.displayEmail || null,
    displayUrl: program.displayUrl || null,
    onSiteLeasingTeamId: program.onSiteLeasingTeamId,
    sourceId: program.sourceId,
    voiceMessageId: program.voiceMessageId,
    campaignId: program.campaignId,
    path: program.path,
    metadata: {
      activatePaymentPlan: translateFlagCellValue(program.activatePaymentPlan),
      gaIds: program.gaIds ? program.gaIds.split(',') : [],
      gaActions: program.gaActions ? program.gaActions.split(',') : [],
      requireMatchingPath: translateFlagCellValue(program.requireMatchingPathFlag || program.metadata?.requireMatchingPath),
      defaultMatchingPath: program.defaultMatchingPath || program.metadata?.defaultMatchingPath || null,
      requireMatchingSource: translateFlagCellValue(program.requireMatchingSourceFlag || program.metadata?.requireMatchingSource),
      defaultMatchingSourceId: program.defaultMatchingSourceId,
      commsForwardingData: getCommsForwardingData(program),
    },
    enableBotResponseOnCommunications: translateFlagCellValue(program.enableBotResponseOnCommunications),
    endDate: program.endDate ? formatEndDate(program.endDate) : null,
    programFallbackId: program.programFallbackId || null,
    selectedPropertyIds: program.selectedPropertyIds,
  };

  if (includeForeignKeys) {
    formattedProgram.voiceMessage = program.voiceMessage;
  }

  return formattedProgram;
};

export const compareNames = (firstName, secondName) => firstName.toLowerCase() === secondName.toLowerCase();

export const getAssociatedEntity = (entities, relatedEntity) => entities.find(e => e.name === relatedEntity);

export const removeTimestampPrefixFromFileName = fileName => fileName.replace(/^\d+-/, '');

export const removeSpacesBetweenWords = str => str.replace(/ /g, '');

export const standarizeSheetName = sheetName => removeSpacesBetweenWords(sheetName).toLowerCase();

export const existSheetByName = sheetName =>
  Object.values(spreadsheet)
    .map(sheet => standarizeSheetName(sheet.workbookSheetName))
    .includes(standarizeSheetName(sheetName));

export const getColumnsBySheet = sheetName =>
  Object.values(spreadsheet).find(sheet => standarizeSheetName(sheet.workbookSheetName) === standarizeSheetName(sheetName))?.columns || [];
