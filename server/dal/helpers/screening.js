/*
 * Copyright (c) 2022 Reva Technology Inc., all rights reserved.
 * Unauthorized copying of this file, via any medium is strictly prohibited
 * Licensed under the Elastic License 2.0; you may not use this file except
 * in compliance with the Elastic License 2.0.
 */

import { knex } from '../../database/factory';
import { prepareRawQuery } from '../../common/schemaConstants';

// eslint-disable-next-line
export const getAllScreeningResultsForPartyQuery = (ctx, partyId) =>
  knex.raw(
    prepareRawQuery(
      `SELECT
        "rentapp_SubmissionRequest"."created_at",
        "rentapp_SubmissionResponse"."created_at" AS "submissionResponseCreatedAt",
        "rentapp_SubmissionRequest"."transactionNumber"
      FROM db_namespace."rentapp_PartyApplication"
      INNER JOIN db_namespace."rentapp_SubmissionRequest" ON "rentapp_PartyApplication"."id" = "rentapp_SubmissionRequest"."partyApplicationId"
      LEFT OUTER JOIN db_namespace."rentapp_SubmissionResponse" ON "rentapp_SubmissionRequest"."id" = "rentapp_SubmissionResponse"."submissionRequestId"
      LEFT OUTER JOIN db_namespace."Property" ON "Property"."id" = "rentapp_SubmissionRequest"."propertyId"
      WHERE "rentapp_PartyApplication"."partyId" = :partyId AND "rentapp_SubmissionRequest"."isObsolete" = :isObsolete
      UNION ALL
        SELECT '1900-01-01','1900-01-01','0'
      ORDER BY "created_at" DESC, "submissionResponseCreatedAt" DESC limit 1`,
      ctx.tenantId,
    ),
    {
      partyId,
      isObsolete: false,
    },
  );
