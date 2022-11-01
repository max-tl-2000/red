/*
 * Copyright (c) 2022 Reva Technology Inc., all rights reserved.
 * Unauthorized copying of this file, via any medium is strictly prohibited
 * Licensed under the Elastic License 2.0; you may not use this file except
 * in compliance with the Elastic License 2.0.
 */

import { getExternalPhonesToExport } from '../../../dal/externalPhonesRepo';
import { getTeamsByIdsWhereIn } from '../../../dal/teamsRepo';
import { buildDataPumpFormat, getSimpleFieldsColumns, getColumnHeadersMappedWithDB } from '../../helpers/export';
import { spreadsheet, getColumnHeaders } from '../../../../common/helpers/spreadsheet';
import { execConcurrent } from '../../../../common/helpers/exec-concurrent';

/* use DB_MAPPER just if the columnHeader from workbooksheet is different to the field in the DB */
const DB_MAPPERS = [
  {
    columnHeader: 'name',
    dbField: 'number',
  },
];

const getTeamsByTeamIds = async (ctx, teamIds) => {
  if (!teamIds) return null;
  const teams = await getTeamsByIdsWhereIn(ctx, teamIds);
  return teams.map(team => team.name);
};

const getTeams = async (ctx, externalPhones) =>
  await execConcurrent(externalPhones, async externalPhone => {
    if (!externalPhone.teamIds) return externalPhone;

    return {
      ...externalPhone,
      teams: await getTeamsByTeamIds(ctx, externalPhone.teamIds),
    };
  });

export const exportExternalPhones = async (ctx, { propertyIdsToExport, columnHeaders: columnHeadersOrdered }) => {
  const { foreignKeys } = spreadsheet.ExternalPhone;
  const columnHeaders = getColumnHeaders(spreadsheet.ExternalPhone.columns);
  const columnHeadersMapped = getColumnHeadersMappedWithDB(columnHeaders, DB_MAPPERS);

  const dbSimpleFields = getSimpleFieldsColumns(columnHeadersMapped, foreignKeys);
  const externalPhones = await getExternalPhonesToExport(ctx, dbSimpleFields, propertyIdsToExport);
  const externalPhonesWithTeams = await getTeams(ctx, externalPhones);

  const columnHeadersOrderedMapped = getColumnHeadersMappedWithDB(columnHeadersOrdered, DB_MAPPERS);
  return buildDataPumpFormat(externalPhonesWithTeams, columnHeadersOrderedMapped);
};
