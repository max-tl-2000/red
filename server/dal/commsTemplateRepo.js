/*
 * Copyright (c) 2022 Reva Technology Inc., all rights reserved.
 * Unauthorized copying of this file, via any medium is strictly prohibited
 * Licensed under the Elastic License 2.0; you may not use this file except
 * in compliance with the Elastic License 2.0.
 */

import { insertOrUpdate, getOne, getOneWhere, initQuery, rawStatement, getAllWhere, runInTransaction, insertInto } from '../database/factory';

const COMMS_TEMPLATE_TABLE = 'CommsTemplate';

export const saveCommsTemplate = async (ctx, commsTemplate) => await insertOrUpdate(ctx, COMMS_TEMPLATE_TABLE, commsTemplate, { conflictColumns: ['name'] });

export const getCommsTemplateById = async (ctx, id) => await getOne(ctx, COMMS_TEMPLATE_TABLE, id);

export const getCommsTemplateByName = async (ctx, name) => await getOneWhere(ctx, COMMS_TEMPLATE_TABLE, { name });

export const getTemplatesShortCodesByProperty = async (ctx, propertyId) =>
  await initQuery(ctx)
    .select('TemplateShortCode.*', 'CommsTemplate.displayName', 'CommsTemplate.description')
    .from('TemplateShortCode')
    .innerJoin('CommsTemplate', 'TemplateShortCode.templateId', 'CommsTemplate.id')
    .where('propertyId', propertyId);

export const saveTemplateShortCodes = async (ctx, templateShortCodes) =>
  await runInTransaction(async trx => {
    const innerCtx = { ...ctx, trx };

    await rawStatement(innerCtx, 'TRUNCATE TABLE db_namespace."TemplateShortCode"');
    await insertInto(innerCtx, 'TemplateShortCode', templateShortCodes);
  });

export const getCommsTemplatesToExport = async (ctx, simpleFields) => {
  const simpleFieldsToSelect = simpleFields.map(field => `CommsTemplate.${field}`);

  return await initQuery(ctx).select(simpleFieldsToSelect).from('CommsTemplate');
};

export const getTemplateShortCodesToExport = async (ctx, simpleFields, propertyIdsToExport) => {
  const simpleFieldsToSelect = simpleFields.map(field => `TemplateShortCode.${field}`);

  const foreignKeysToSelect = ['Property.name as property', 'CommsTemplate.name as templateName'];

  const allFieldsToSelect = simpleFieldsToSelect.concat(foreignKeysToSelect);

  return await initQuery(ctx)
    .select(allFieldsToSelect)
    .from('TemplateShortCode')
    .innerJoin('Property', 'TemplateShortCode.propertyId', 'Property.id')
    .innerJoin('CommsTemplate', 'TemplateShortCode.templateId', 'CommsTemplate.id')
    .whereIn('propertyId', propertyIdsToExport);
};

const COMMS_TEMPLATE_SETTINGS_TABLE = 'CommsTemplateSettings';

export const getCommsTemplateSettingsToExport = async ctx => {
  const { rows = [] } = await rawStatement(
    ctx,
    `
    SELECT p.name as property, cts.action, cts.section, ct.name as template FROM db_namespace."${COMMS_TEMPLATE_SETTINGS_TABLE}" cts
      INNER JOIN db_namespace."${COMMS_TEMPLATE_TABLE}" ct ON cts."templateId" = ct.id
      INNER JOIN db_namespace."Property" p ON p.id = cts."propertyId"
  `,
  );
  return rows;
};

export const saveCommsTemplateSetting = async (ctx, commsTemplateSetting) =>
  await insertOrUpdate(ctx, COMMS_TEMPLATE_SETTINGS_TABLE, commsTemplateSetting, { conflictColumns: ['propertyId', 'section', 'action'] });

export const getCommsTemplateSettingProperties = async ctx => {
  const { rows } = await rawStatement(
    ctx,
    `SELECT "propertyId", COUNT("propertyId") as quantity from db_namespace."${COMMS_TEMPLATE_SETTINGS_TABLE}" GROUP BY "propertyId"`,
  );

  return rows;
};

export const getCommsTemplateSettingByPropertyId = async (ctx, propertyId) => await getAllWhere(ctx, COMMS_TEMPLATE_SETTINGS_TABLE, { propertyId });

export const getCommsTemplateSettingsById = async (ctx, commsTemplateSettingsId) => {
  const query = `
    SELECT * FROM db_namespace."${COMMS_TEMPLATE_SETTINGS_TABLE}" cts
    WHERE id = :commsTemplateSettingsId;
  `;

  const { rows = [] } = await rawStatement(ctx, query, [{ commsTemplateSettingsId }]);
  return rows[0];
};

export const getCommsTemplateByPropertyIdAndTemplateSetting = async (ctx, propertyId, templateSetting) => {
  const { rows } = await rawStatement(
    ctx,
    `
    SELECT ct.*, cts.id "commsTemplateSettingsId" from db_namespace."${COMMS_TEMPLATE_TABLE}" ct
      INNER JOIN db_namespace."${COMMS_TEMPLATE_SETTINGS_TABLE}" cts ON cts."templateId" = ct.id
      WHERE cts."propertyId" = :propertyId AND cts.action = :action AND cts.section = :section
  `,
    [{ propertyId, section: templateSetting.section, action: templateSetting.action }],
  );

  return rows.length ? rows[0] : null;
};

export const isPersonUnsubscribedFromComm = async (ctx, personId, commsTemplateSettingsId) => {
  const query = `
    SELECT count(*)
    FROM db_namespace."NotificationUnsubscription"
    WHERE "commsTemplateSettingsId" = :commsTemplateSettingsId AND "personId" = :personId;
  `;

  const { rows } = await rawStatement(ctx, query, [{ personId, commsTemplateSettingsId }]);
  return Number(rows[0].count) > 0;
};
