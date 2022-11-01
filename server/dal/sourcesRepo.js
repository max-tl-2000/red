/*
 * Copyright (c) 2022 Reva Technology Inc., all rights reserved.
 * Unauthorized copying of this file, via any medium is strictly prohibited
 * Licensed under the Elastic License 2.0; you may not use this file except
 * in compliance with the Elastic License 2.0.
 */

import { common } from '../common/schemaConstants';
import { rawStatement, insertOrUpdate } from '../database/factory';

const getMasterSources = async () => {
  const ctx = { tenantId: common.id };
  const query = 'SELECT name, type FROM db_namespace."ProgramSources"';
  const { rows } = await rawStatement(ctx, query);
  return rows;
};

let getMasterSourcesFunc = getMasterSources;
export const setGetMasterSourcesFunc = func => (getMasterSourcesFunc = func);
export const resetGetMasterSourcesFunc = () => (getMasterSourcesFunc = getMasterSources);

export const getMasterSourceList = async () => await getMasterSourcesFunc();

export const deleteMasterSourcesByNames = async sourceNames => {
  const ctx = { tenantId: common.id };
  const query = 'DELETE FROM db_namespace."ProgramSources" WHERE ARRAY[name] <@ :sourceNames';
  await rawStatement(ctx, query, [{ sourceNames }]);
};

export const getSources = async ctx => {
  const query = `
    SELECT *
    FROM db_namespace."Sources"
    `;

  const { rows } = await rawStatement(ctx, query);
  return rows;
};

export const saveSource = async (ctx, source) => await insertOrUpdate(ctx.tenantId, 'Sources', source, { conflictColumns: ['name'] });

export const getSourceByName = async (ctx, sourceName) => {
  const query = `
    SELECT *
    FROM db_namespace."Sources"
      WHERE name = '${sourceName}'
    `;
  const { rows } = await rawStatement(ctx, query);
  return rows[0];
};

export const getSourceAndTeamPropertyProgramId = async (ctx, { sourceName, propertyId, teamId } = {}) => {
  const shouldAddTeamFilter = teamId && propertyId;
  const cte = `
    WITH _tpp AS (
      SELECT
      s.id AS "sourceId",
      tpp.id AS "teamPropertyProgramId"
      FROM db_namespace."TeamPropertyProgram" AS tpp
      INNER JOIN db_namespace."Programs" AS pro ON tpp."programId" = pro.id
      INNER JOIN db_namespace."Sources" AS s ON pro."sourceId" = s.id
      WHERE s."name" = :sourceName
      AND tpp."teamId" = :teamId
      AND tpp."propertyId" = :propertyId
      ORDER BY CASE WHEN pro."path" = 'direct' THEN 0 ELSE 1 END ASC, tpp.created_at ASC
      LIMIT 1
  )`;
  const query = `
    ${shouldAddTeamFilter ? cte : ''}

    SELECT
      s."name" AS "sourceName"
      ${shouldAddTeamFilter ? ', _tpp."teamPropertyProgramId"' : ''}
    FROM db_namespace."Sources" AS s
    ${shouldAddTeamFilter ? 'LEFT JOIN _tpp ON s.id = _tpp."sourceId"' : ''}
    WHERE s."name" = :sourceName
    LIMIT 1
    `;
  const { rows } = await rawStatement(ctx, query, [{ sourceName, propertyId, teamId }]);
  return rows[0];
};

export const getSourcesToExport = async (ctx, simpleFields) => {
  const simpleFieldsToSelect = simpleFields.map(field => `"${field}"`);

  const query = `
    SELECT ${simpleFieldsToSelect}
    FROM db_namespace."Sources"
  `;

  const { rows } = await rawStatement(ctx, query);
  return rows;
};
