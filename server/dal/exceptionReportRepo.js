/*
 * Copyright (c) 2022 Reva Technology Inc., all rights reserved.
 * Unauthorized copying of this file, via any medium is strictly prohibited
 * Licensed under the Elastic License 2.0; you may not use this file except
 * in compliance with the Elastic License 2.0.
 */

import { rawStatement } from '../database/factory';
import loggerModule from '../../common/helpers/logger';

const logger = loggerModule.child({ subtype: 'exceptionReportRepo' });

export const getAllExceptionReports = async ctx => {
  logger.trace({ ctx }, 'getAllExceptionReports');

  const { rows } = await rawStatement(
    ctx,
    `
        SELECT * FROM db_namespace."ExceptionReport";
    `,
  );

  return rows;
};

export const getExceptionReportsByExternalId = async (ctx, externalId) => {
  logger.trace({ ctx, externalId }, 'getExceptionReportByExternalId');

  const { rows } = await rawStatement(
    ctx,
    `
      SELECT * FROM db_namespace."ExceptionReport"
      WHERE "externalId" = :externalId;
      `,
    [{ externalId }],
  );

  return rows;
};

export const getLastExceptionReportByExternalIdAndRuleId = async (ctx, externalId, ruleId) => {
  logger.trace({ ctx, externalId }, 'getLastExceptionReportByExternalId');

  const { rows } = await rawStatement(
    ctx,
    `
      SELECT * FROM db_namespace."ExceptionReport"
      WHERE "externalId" = :externalId
      AND "ruleId" =:ruleId
      ORDER BY "created_at" desc
      LIMIT 1;
      `,
    [{ externalId, ruleId }],
  );

  return rows && rows[0];
};

export const getLastDuplicateExceptionReport = async (ctx, { externalId = null, reportData, ruleId }) => {
  logger.trace({ ctx, externalId, reportData, ruleId }, 'getDuplicatedExceptionReport');

  const { rows } = await rawStatement(
    ctx,
    `
      SELECT * FROM db_namespace."ExceptionReport"
      WHERE "externalId" = :externalId
      AND "ruleId" = :ruleId
      AND "reportData" = :reportData
      ORDER BY "created_at" desc
      LIMIT 1;
      `,
    [{ externalId, reportData: JSON.stringify(reportData), ruleId }],
  );

  return rows && rows[0];
};

export const saveExceptionReport = async (ctx, data) => {
  logger.trace({ ctx, data }, 'saveExceptionReport');

  const { externalId = null, residentImportTrackingId = null, reportData, conflictingRule, ruleId, exceptionType, unit = null, ignore = false } = data;

  const { rows } = await rawStatement(
    ctx,
    `
      INSERT INTO db_namespace."ExceptionReport"
        ("id", "externalId", "residentImportTrackingId", "conflictingRule", "reportData", "ruleId", "exceptionType", "unit", "ignore")
      VALUES ("public".gen_random_uuid(), :externalId, :residentImportTrackingId, :conflictingRule, :reportData, :ruleId, :exceptionType, :unit, :ignore)
      RETURNING *;
      `,
    [
      {
        externalId,
        residentImportTrackingId,
        conflictingRule,
        reportData: JSON.stringify(reportData),
        ruleId,
        exceptionType,
        unit,
        ignore,
      },
    ],
  );

  return rows[0];
};

export const markLastExceptionReportAsIgnored = async (ctx, { externalId, ignoreReason, ruleId }) => {
  logger.trace({ ctx, externalId, ruleId, ignoreReason: ignoreReason.reason }, 'markLastExceptionReportAsIgnored');

  return await rawStatement(
    ctx,
    `WITH last_exception_report_id AS (
      SELECT *
      FROM db_namespace."ExceptionReport" er
      WHERE er."externalId" = :externalId
        AND er."ruleId" = :ruleId
      ORDER by er.created_at DESC
      LIMIT 1
      )
      UPDATE db_namespace."ExceptionReport" er
      SET "ignore" = true, "ignoreReason" = :ignoreReason::jsonb
      FROM last_exception_report_id AS le
      WHERE er.id = le.id;`,
    [{ externalId, ruleId, ignoreReason }],
  );
};
