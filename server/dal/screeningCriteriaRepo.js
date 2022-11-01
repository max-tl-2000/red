/*
 * Copyright (c) 2022 Reva Technology Inc., all rights reserved.
 * Unauthorized copying of this file, via any medium is strictly prohibited
 * Licensed under the Elastic License 2.0; you may not use this file except
 * in compliance with the Elastic License 2.0.
 */

import { insertOrUpdate, initQuery, rawStatement } from '../database/factory';
import { DALTypes } from '../../common/enums/DALTypes';

const { PartyTypes } = DALTypes;
const SCREENING_CRITERIA_TABLE_NAME = 'ScreeningCriteria';

export const saveScreeningCriteria = async (ctx, screeningCriteria) => await insertOrUpdate(ctx, 'ScreeningCriteria', screeningCriteria);

export const savePropertyPartySetting = async (ctx, propertyPartySetting) => await insertOrUpdate(ctx, 'PropertyPartySettings', propertyPartySetting);

export const getScreeningCriteriasToExport = async (ctx, simpleFields) => {
  const simpleFieldsToSelect = simpleFields.map(field => `ScreeningCriteria.${field}`);

  return await initQuery(ctx).select(simpleFieldsToSelect).from('ScreeningCriteria');
};

export const getPropertyPartySettingsToExport = async (ctx, simpleFields, propertyIdsToExport) => {
  const simpleFieldsToSelect = simpleFields.map(field => `PropertyPartySettings.${field}`);
  const foreignKeysToSelect = ['Property.name as property', 'ScreeningCriteria.name as screeningCriteria'];

  const allFieldsToSelect = simpleFieldsToSelect.concat(foreignKeysToSelect);

  return await initQuery(ctx)
    .select(allFieldsToSelect)
    .from('PropertyPartySettings')
    .innerJoin('Property', 'PropertyPartySettings.propertyId', 'Property.id')
    .innerJoin('ScreeningCriteria', 'PropertyPartySettings.screeningCriteriaId', 'ScreeningCriteria.id')
    .whereIn('Property.id', propertyIdsToExport);
};

const getScreeningCriteriaCols = async (ctx, exceptCols = ['id', 'name', 'created_at', 'updated_at']) => {
  const { tenantId } = ctx;
  const query = `SELECT
      array_to_string(ARRAY(SELECT 'criteria' || '.' || quote_ident(c.column_name)
    FROM information_schema.columns As c
    WHERE table_name = :screeningCriteriaTableName AND table_schema = :tenantId
    AND  c.column_name NOT IN(${exceptCols.map(col => `'${col}'`).join(',')})
    ), ',') AS "screeningCriteriaCols"`;

  const { rows } = await rawStatement(ctx, query, [{ screeningCriteriaTableName: SCREENING_CRITERIA_TABLE_NAME, tenantId }]);

  return (rows[0] && rows[0].screeningCriteriaCols) || '';
};

export const getScreeningCriteriaByPropertyIds = async (ctx, propertyIds, options = { partyType: PartyTypes.TRADITIONAL, inactive: false }) => {
  const { partyType, inactive } = options;
  const screeningCriteriaCols = await getScreeningCriteriaCols(ctx);
  const query = `SELECT
      settings.id AS "propertyPartySettingsId",
      settings."partyType",
      settings."propertyId",
      row_to_json((SELECT criteria FROM (SELECT ${screeningCriteriaCols}) criteria)) AS "screeningCriteria"
    FROM db_namespace."PropertyPartySettings" settings
    LEFT JOIN db_namespace."${SCREENING_CRITERIA_TABLE_NAME}" criteria ON criteria.id = settings."screeningCriteriaId"
    WHERE settings."propertyId" IN (${propertyIds.map(id => `'${id}'`).join(',')})
    AND settings."partyType" = :partyType
    AND settings."inactive" = :inactive`;

  const { rows } = await rawStatement(ctx, query, [{ partyType, inactive }]);

  return rows;
};
