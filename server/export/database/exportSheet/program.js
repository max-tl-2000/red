/*
 * Copyright (c) 2022 Reva Technology Inc., all rights reserved.
 * Unauthorized copying of this file, via any medium is strictly prohibited
 * Licensed under the Elastic License 2.0; you may not use this file except
 * in compliance with the Elastic License 2.0.
 */

import { getTenantData } from '../../../dal/tenantsRepo';
import { getProgramsToExport } from '../../../dal/programsRepo';
import { buildDataPumpFormat, getSimpleFieldsColumns } from '../../helpers/export';
import { spreadsheet, getColumnHeaders } from '../../../../common/helpers/spreadsheet';

const buildPhonePlaceHolder = (phoneNumbers, program) => {
  let placeholder;
  phoneNumbers.forEach((phone, index) => {
    if (phone.phoneNumber === program.directPhoneIdentifier) {
      placeholder = `%phone[${index}]%`;
      return;
    }
  });
  return placeholder;
};

const getPhoneNumberPlaceholder = (phoneNumbers, programs) =>
  programs.map(program => {
    if (!program.directPhoneIdentifier) return program;

    const phonePlaceholder = buildPhonePlaceHolder(phoneNumbers, program);
    return {
      ...program,
      directPhoneIdentifier: phonePlaceholder,
      displayPhoneNumber: phonePlaceholder,
    };
  });

export const exportPrograms = async (ctx, { columnHeaders: columnHeadersOrdered }) => {
  const { foreignKeys, customKeys } = spreadsheet.Program;
  const columnHeaders = getColumnHeaders(spreadsheet.Program.columns);

  const dbSimpleFields = getSimpleFieldsColumns(columnHeaders, foreignKeys);
  const simpleFieldsWithoutCustomFields = dbSimpleFields.filter(field => !customKeys.includes(field));

  const { metadata } = await getTenantData(ctx);
  const programs = await getProgramsToExport(ctx, simpleFieldsWithoutCustomFields);

  const programsWithPhoneNumberPlaceholder = getPhoneNumberPlaceholder(metadata.phoneNumbers, programs);

  return buildDataPumpFormat(programsWithPhoneNumberPlaceholder, columnHeadersOrdered);
};
