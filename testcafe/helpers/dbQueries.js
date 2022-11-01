/*
 * Copyright (c) 2022 Reva Technology Inc., all rights reserved.
 * Unauthorized copying of this file, via any medium is strictly prohibited
 * Licensed under the Elastic License 2.0; you may not use this file except
 * in compliance with the Elastic License 2.0.
 */

import { rawStatement } from '../../server/database/factory.js';
import loggerModule from '../../common/helpers/logger';
import { DALTypes } from '../../common/enums/DALTypes';

const logger = loggerModule.child({ subtype: 'dbchecksTestcafe' });

export const getPartyIsObsoleteValue = async (ctx, partyId) => {
  logger.trace({ ctx, partyId }, 'getPartyIsObsoleteValue');
  const { rows } = await rawStatement(
    ctx,
    `SELECT * from db_namespace."rentapp_SubmissionRequest" as sr
    left join db_namespace."rentapp_PartyApplication" as pa on pa.id = sr."partyApplicationId"
    where pa."partyId" = :partyId
    order by sr."created_at" desc;`,
    [{ partyId }],
  );
  return rows;
};

export const getEndedAsMergedAtColumn = async (ctx, partyId) => {
  logger.trace({ ctx, partyId }, 'getEndedAsMergedAtColumn');
  const { rows } = await rawStatement(
    ctx,
    `SELECT * from db_namespace."rentapp_PersonApplication" as pa
    where pa."partyId" = :partyId;`,
    [{ partyId }],
  );
  return rows;
};

export const getPartyApplicationStatus = async (ctx, partyId) => {
  logger.trace({ ctx, partyId }, 'getPartyApplicationStatus');
  const { rows } = await rawStatement(
    ctx,
    `SELECT pa.id, pa."personId", pa."applicationStatus", i.id as "invoiceId" FROM db_namespace."rentapp_PersonApplication" As pa
    LEFT JOIN db_namespace."rentapp_ApplicationInvoices" As i ON pa.id = i."personApplicationId"
    WHERE pa."partyId" = :partyId;`,
    [{ partyId }],
  );
  return rows;
};

export const getMriGuestCardRequestBody = async (ctx, partyId) => {
  logger.trace({ ctx, partyId }, 'getMriGuestCardRequestBody');
  const { rows } = await rawStatement(
    ctx,
    `SELECT "requestBody" from db_namespace."MRIExportTracking" mt
        WHERE "partyId" = :partyId
        AND api = 'MRI_S-PMRM_GuestCardsBySiteID'`,
    [{ partyId }],
  );
  return (rows[0] || {}).requestBody;
};

export const getMriClearSelectedUnitRequestBody = async (ctx, partyId) => {
  logger.trace({ ctx, partyId }, 'getMriClearSelectedUnitRequestBody');
  const { rows } = await rawStatement(
    ctx,
    `SELECT "requestBody" from db_namespace."MRIExportTracking" mt
        WHERE "partyId" = :partyId
        AND api = 'ClearSelectedUnit'`,
    [{ partyId }],
  );
  return (rows[0] || {}).requestBody;
};

export const getMriSelectUnitRequestBody = async (ctx, partyId) => {
  logger.trace({ ctx, partyId }, 'getMriSelectUnitRequestBody');
  const { rows } = await rawStatement(
    ctx,
    `SELECT "requestBody" from db_namespace."MRIExportTracking" mt
        WHERE "partyId" = :partyId
        AND api = 'MRI_S-PMRM_SelectUnit'`,
    [{ partyId }],
  );
  return (rows[0] || {}).requestBody;
};

export const getMriConfirmLeaseRequestBody = async (ctx, partyId) => {
  logger.trace({ ctx, partyId }, 'getMriConfirmLeaseRequestBody');
  const { rows } = await rawStatement(
    ctx,
    `SELECT "requestBody" from db_namespace."MRIExportTracking" mt
        WHERE "partyId" = :partyId
        AND api = 'ConfirmLease'`,
    [{ partyId }],
  );
  return (rows[0] || {}).requestBody;
};

export const getPartyAdditionalInfo = async (ctx, partyId) => {
  logger.trace({ ctx, partyId }, 'getParty_AdditionalInfo');
  const { rows } = await rawStatement(
    ctx,
    `SELECT "info" FROM db_namespace."Party_AdditionalInfo" mt
        WHERE "partyId" = :partyId
        AND type = 'pet'
        AND (info ->> 'isServiceAnimal')::boolean IS TRUE`,
    [{ partyId }],
  );
  return rows;
};

export const checkLeaseTermData = async (ctx, partyId, initialTermLength, publishedTermLength) => {
  logger.trace({ ctx, partyId }, 'checkLeaseTermData');
  const { rows } = await rawStatement(
    ctx,
    `SELECT * FROM db_namespace."Lease" l
      WHERE l."partyId" = :partyId
      AND l."baselineData" -> 'publishedLease' ->> 'termLength' = :publishedTermLength
      AND l."baselineData" -> 'publishedLease' ->> 'originalTermLength' = :initialTermLength`,
    [{ partyId, initialTermLength, publishedTermLength }],
  );
  return rows;
};

export const getInventoryByNameAndPropertyId = async (ctx, propertyId, unitName) => {
  logger.trace({ ctx, propertyId, unitName }, 'getCurrentStatus');
  const { rows } = await rawStatement(
    ctx,
    `SELECT * FROM db_namespace."Inventory" inv
      WHERE inv."propertyId" = :propertyId
      AND inv."name" = :unitName
      AND inv.type = '${DALTypes.InventoryType.UNIT}'`,
    [{ propertyId, unitName }],
  );
  return rows[0];
};

export const changeInventoryStatus = async (ctx, inventoryId, newState) => {
  logger.trace({ ctx, inventoryId, newState }, 'changeInventoryStatus');
  const { rows } = await rawStatement(
    ctx,
    `UPDATE db_namespace."Inventory"
      SET state = :newState
      WHERE id = :inventoryId`,
    [{ inventoryId, newState }],
  );
  return rows[0];
};

export const getPropertyIntegrationImportSettings = async (ctx, name) => {
  logger.trace({ ctx, name }, 'getPropertyIntegrationImportSettings');
  const { rows } = await rawStatement(
    ctx,
    `SELECT settings-> 'integration' -> 'import' as "importSettings"
    FROM db_namespace."Property"
    WHERE "name" = :name;`,
    [{ name }],
  );
  return rows[0].importSettings;
};

export const getRmsPricingRowsByPropertyId = async (ctx, propertyId) => {
  logger.trace({ ctx, propertyId }, 'getRmsPricingRowsByPropertyId');
  const { rows } = await rawStatement(
    ctx,
    `SELECT * FROM db_namespace."RmsPricing"
    WHERE "propertyId"= :propertyId
    AND "type"='${DALTypes.InventoryType.UNIT}'`,
    [{ propertyId }],
  );
  return rows;
};

export const getLeasesByPartyId = async (ctx, partyId) => {
  logger.trace({ ctx, partyId }, 'getLeasesByPartyId');
  const { rows } = await rawStatement(
    ctx,
    `SELECT * FROM db_namespace."Lease"
    WHERE "partyId"= :partyId`,
    [{ partyId }],
  );
  return rows;
};

export const updateSettingsTenant = async ctx => {
  logger.trace({ ctx }, 'updateSettingsTenant');
  const { rows } = await rawStatement(
    ctx,
    `UPDATE admin."Tenant"
    SET settings -> 'lease' -> "allowCounterSigningInPast" = TRUE
    WHERE "name" = 'cucumber'`,
    [],
  );
  return rows[0];
};

export const getCommunicationByPartyIdAndType = async (ctx, partyId, type) => {
  logger.trace({ ctx, partyId, type }, 'getCommunicationByPartyIdAndType');
  const { rows } = await rawStatement(
    ctx,
    `SELECT * FROM db_namespace."Communication"
    WHERE :partyId = any(parties)
    AND type = :type;`,
    [{ partyId, type }],
  );
  return rows;
};
