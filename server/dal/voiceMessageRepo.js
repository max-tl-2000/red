/*
 * Copyright (c) 2022 Reva Technology Inc., all rights reserved.
 * Unauthorized copying of this file, via any medium is strictly prohibited
 * Licensed under the Elastic License 2.0; you may not use this file except
 * in compliance with the Elastic License 2.0.
 */

import mapValues from 'lodash/mapValues';
import trim from '../../common/helpers/trim';
import { insertOrUpdate, rawStatement, initQuery } from '../database/factory';
import { formatPhoneNumberForDb } from '../helpers/phoneUtils';

export const getMenuItemsByNames = async (ctx, names) => {
  const { rows } = await rawStatement(ctx, 'SELECT * FROM db_namespace."VoiceMenuItems" WHERE "name" = ANY(:names)', [{ names }]);
  return rows;
};

export const getMenuItems = async ctx => {
  const { rows } = await rawStatement(ctx, 'SELECT * FROM db_namespace."VoiceMenuItems"');
  return rows;
};

export const saveVoiceMenuItem = async (ctx, data) => {
  const { name, action, number, displayName } = data;
  const menuItem = {
    name: trim(name),
    key: parseInt(data.key, 10),
    action: trim(action),
    number: formatPhoneNumberForDb(number) || null,
    displayName: trim(displayName),
  };
  return await insertOrUpdate(ctx, 'VoiceMenuItems', menuItem, {
    conflictColumns: ['name'],
  });
};

export const saveVoiceMessage = async (ctx, data) => {
  const message = mapValues(data, s => trim(s));

  return await insertOrUpdate(ctx, 'VoiceMessages', message, {
    conflictColumns: ['name'],
  });
};

export const getVoiceMessageById = async (ctx, id) => {
  const query = 'SELECT * FROM db_namespace."VoiceMessages" WHERE "id" = :id';
  const { rows } = await rawStatement(ctx, query, [{ id }]);
  const [messages] = rows;
  return messages;
};

export const getVoiceMessageByName = async (ctx, name) => {
  const query = 'SELECT * FROM db_namespace."VoiceMessages" WHERE "name" = :name';
  const { rows } = await rawStatement(ctx, query, [{ name }]);
  const [messages] = rows;
  return messages;
};

export const getDisplayNameByPhoneNumber = async (ctx, number) => {
  const query = 'SELECT "displayName" FROM db_namespace."VoiceMenuItems" WHERE "number" = :number';
  const { rows } = await rawStatement(ctx, query, [{ number }]);
  return rows[0].displayName;
};

export const getVoiceMessagesByProgramId = async (ctx, programId) => {
  const query = `
    SELECT v.*
    FROM db_namespace."VoiceMessages" v
      INNER JOIN db_namespace."Programs" p on p."voiceMessageId" = v.id
    WHERE p."id" = :programId`;

  const { rows } = await rawStatement(ctx, query, [{ programId }]);
  const [programMessages] = rows;
  return programMessages;
};

export const getVoiceMessagesByTeamMemberId = async (ctx, memberId) => {
  const query = `
    SELECT v.*
    FROM db_namespace."VoiceMessages" v
      INNER JOIN db_namespace."TeamMembers" t ON t."voiceMessageId" = v.id
    WHERE t."id" = :memberId`;

  const { rows } = await rawStatement(ctx, query, [{ memberId }]);
  const [teamMemberMessages] = rows;
  return teamMemberMessages;
};

export const getVoiceMessagesByTeamId = async (ctx, teamId) => {
  const query = `
    SELECT v.*
    FROM db_namespace."VoiceMessages" v
      INNER JOIN db_namespace."Teams" t ON t."voiceMessageId" = v.id
    WHERE t."id" = :teamId`;

  const { rows } = await rawStatement(ctx, query, [{ teamId }]);
  const [teamMessages] = rows;
  return teamMessages;
};

export const getVoiceMessagesToExport = async (ctx, simpleFields) => {
  const simpleFieldsToSelect = simpleFields.map(field => `VoiceMessages.${field}`);

  return await initQuery(ctx).select(simpleFieldsToSelect).from('VoiceMessages');
};

export const getVoiceMenuItemsToExport = async (ctx, simpleFields) => {
  const simpleFieldsToSelect = simpleFields.map(field => `VoiceMenuItems.${field}`);

  return await initQuery(ctx).select(simpleFieldsToSelect).from('VoiceMenuItems');
};

export const getAllVoiceMessages = async ctx => {
  const query = `
    SELECT v.*
    FROM db_namespace."VoiceMessages" v`;

  const { rows } = await rawStatement(ctx, query, [{}]);
  return rows;
};
