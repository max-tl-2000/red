/*
 * Copyright (c) 2022 Reva Technology Inc., all rights reserved.
 * Unauthorized copying of this file, via any medium is strictly prohibited
 * Licensed under the Elastic License 2.0; you may not use this file except
 * in compliance with the Elastic License 2.0.
 */

import { saveTeamData as saveTeam, getTeamsFromTenant, getNewInactiveTeams } from '../../dal/teamsRepo';
import { DALTypes } from '../../../common/enums/DALTypes';
import { validate, Validation } from './util';
import DBColumnLength from '../../utils/dbConstants';
import { getPropertiesIdsWhereNameIn } from '../../dal/propertyRepo';
import logger from '../../../common/helpers/logger';
import { CalendarActionTypes, CalendarTargetType } from '../../../common/enums/calendarTypes';
import { isCalendarIntegrationEnabled } from '../../services/externalCalendars/cronofyService';
import { APP_EXCHANGE, EXTERNAL_CALENDARS_TYPE } from '../../helpers/message-constants';
import { sendMessage } from '../../services/pubsub';
import { getActionForCalendarSync, getExternalCalendars } from '../../helpers/externalCalendarUtils';
import { SheetImportError } from '../../common/errors';
import { getVoiceMessageByName } from '../../dal/voiceMessageRepo';
import { spreadsheet } from '../../../common/helpers/spreadsheet';
import { sanitizeDirectEmailIdentifier } from '../../../common/helpers/mails';
import { reassignPartiesFromInactiveTeams } from '../../services/party';

const PROPERTIES = 'properties';
const PROPERTIES_NOT_FOUND = 'MANDATORY_PROPERTIES_NOT_FOUND';
const VOICE_MESSAGE = 'Voice Message';
const INVALID_VOICE_MESSAGE = 'Invalid voice message';
const MISSING_CALENDAR_NAME_ERROR = 'Missing calendar name for calendar account';
const CALENDAR_NAME_CHANGE_ERROR = 'Cannot change name of the calendar';
const CALENDAR_ACCOUNT = 'calendarAccount';
const CALENDAR_ACCOUNT_OCCURENCE_ERROR = 'Cannot assign the same calendar account and name twice';
const DB_CALENDAR_ACCOUNT_OCCURENCE_ERROR = 'Calendar account and name is already assigned';

const teamRequiredFields = [
  {
    fieldName: 'name',
    validation: [Validation.NOT_EMPTY, Validation.ALPHANUMERIC],
    maxLength: DBColumnLength.Name,
  },
  {
    fieldName: 'displayName',
    validation: [Validation.NOT_EMPTY, Validation.ALPHANUMERIC],
    maxLength: DBColumnLength.Name,
  },
  {
    fieldName: 'module',
    validation: [Validation.NOT_EMPTY, Validation.ALPHANUMERIC, Validation.EXISTS_IN],
    validValues: DALTypes.ModuleType,
    maxLength: DBColumnLength.Type,
  },
  {
    fieldName: 'description',
    validation: [Validation.ALPHANUMERIC],
    maxLength: DBColumnLength.Description,
  },
  {
    fieldName: 'properties',
    validation: [Validation.NOT_EMPTY, Validation.ALPHANUMERIC],
    maxLength: DBColumnLength.Text2KB,
  },
  {
    fieldName: 'timeZone',
    validation: [Validation.NOT_EMPTY, Validation.TIME_ZONE],
    maxLength: DBColumnLength.Name,
  },
  {
    fieldName: 'inactiveFlag',
    validation: [Validation.BOOLEAN],
    maxLength: DBColumnLength.State,
  },
  {
    fieldName: 'sendCalendarCommsFlag',
    validation: [Validation.BOOLEAN],
  },
  {
    fieldName: 'associatedTeamNames',
    validation: [Validation.ALPHANUMERIC],
    maxLength: DBColumnLength.Text2KB,
  },
  {
    fieldName: 'calendarAccount',
    validation: [Validation.ALPHANUMERIC, Validation.MAIL],
    maxLength: DBColumnLength.Email,
  },
  {
    fieldName: 'calendarName',
    validation: [Validation.ALPHANUMERIC],
    maxLength: DBColumnLength.Name,
  },
  {
    fieldName: 'voiceMessage',
    validation: [Validation.NOT_EMPTY, Validation.ALPHANUMERIC],
    maxLength: DBColumnLength.Name,
  },
];
const duplicateCalendarAccountValidations = (team, teams, dbTeams) => {
  const validation = [];
  if (team.calendarName && team.calendarAccount) {
    const calendarName = team.calendarName.trim();
    const calendarAccount = team.calendarAccount && sanitizeDirectEmailIdentifier(team.calendarAccount);

    const importTeamsWithCalendarAccount = teams
      .map(t => t.data)
      .filter(t => t.calendarAccount && sanitizeDirectEmailIdentifier(t.calendarAccount) === calendarAccount && t.calendarName === calendarName);

    if (importTeamsWithCalendarAccount.length > 1) {
      validation.push({
        name: CALENDAR_ACCOUNT,
        message: CALENDAR_ACCOUNT_OCCURENCE_ERROR,
      });
    }

    const dbCalendarAccountOccurences = dbTeams.filter(
      t =>
        t.externalCalendars.calendarName &&
        t.externalCalendars.calendarAccount && // we have a valid already imported combination in db - old calendars might have the calendar name empty and those should be allowed changing
        t.externalCalendars.calendarAccount === calendarAccount &&
        t.externalCalendars.calendarName === calendarName &&
        t.name !== team.name, // different teams cannot use the same calendar account and name
    ).length;

    if (dbCalendarAccountOccurences > 0) {
      validation.push({
        name: CALENDAR_ACCOUNT,
        message: DB_CALENDAR_ACCOUNT_OCCURENCE_ERROR,
      });
    }
  }
  return validation;
};

const customTeamValidations = async (ctx, team, teams, dbTeams) => {
  const validation = [];
  const dbTeam = dbTeams.find(t => t.name === team.name);

  const propertiesNames = team.properties
    .split(',')
    .map(p => p.trim())
    .filter(p => !!p);

  const propertyIds = await getPropertiesIdsWhereNameIn(ctx, propertiesNames);
  if (propertiesNames.length !== propertyIds.length) {
    validation.push({
      name: PROPERTIES,
      message: PROPERTIES_NOT_FOUND,
    });
  }

  const validMessage = await getVoiceMessageByName(ctx, team.voiceMessage);
  if (!validMessage) {
    validation.push({
      name: VOICE_MESSAGE,
      message: INVALID_VOICE_MESSAGE,
    });
  }
  const dbExternalCalendars = dbTeam?.externalCalendars;
  if (team.calendarAccount && !team.calendarName) {
    validation.push({
      name: PROPERTIES,
      message: MISSING_CALENDAR_NAME_ERROR,
    });
  }

  if (
    dbExternalCalendars?.calendarAccount &&
    dbExternalCalendars?.calendarName &&
    dbExternalCalendars?.calendarName !== team.calendarName &&
    dbExternalCalendars?.calendarAccount === team.calendarAccount
  ) {
    validation.push({
      name: PROPERTIES,
      message: CALENDAR_NAME_CHANGE_ERROR,
    });
  }
  const calendarAccountValidationErrors = duplicateCalendarAccountValidations(team, teams, dbTeams);
  if (calendarAccountValidationErrors.length) validation.push(...calendarAccountValidationErrors);

  if (validation.length) {
    logger.warn({ ctx, team, teamImportValidations: validation }, `Team ${team.name} did not validate!`);
  }

  return validation;
};

const addMessage = async (ctx, action, teamName) =>
  await sendMessage({
    exchange: APP_EXCHANGE,
    key: EXTERNAL_CALENDARS_TYPE.PERFORM_ACTIONS_ON_CALENDAR_ACCOUNT,
    message: {
      tenantId: ctx.tenantId,
      action,
      teamName,
      entityType: CalendarTargetType.TEAM,
    },
    ctx,
  });

const processTeamForCalendarSync = async (ctx, importTeam, dbTeam) => {
  const hasCalendar = dbTeam && dbTeam.externalCalendars && dbTeam.externalCalendars.teamCalendarId;
  const action = await getActionForCalendarSync(importTeam, dbTeam, hasCalendar);

  if (action === CalendarActionTypes.NO_ACTION) return;
  const dbCalendarAccount = dbTeam && dbTeam.externalCalendars ? dbTeam.externalCalendars.calendarAccount : '';
  logger.info(
    {
      ctx,
      teamName: importTeam.name,
      action,
      oldCalendarAccount: dbCalendarAccount,
      newCalendarAccount: importTeam.calendarAccount,
      newCalendarName: importTeam.calendarName,
    },
    'processTeamForCalendarSync',
  );
  await addMessage(ctx, action, importTeam.name);
};

const saveTeamData = async (ctx, team, dbTeam) => {
  const teamData = {
    ...team,
    externalCalendars: getExternalCalendars(team.calendarAccount, dbTeam, team.calendarName),
  };
  await saveTeam(ctx, teamData, dbTeam);
};

export const importTeams = async (ctx, teams) => {
  const integrationEnabled = await isCalendarIntegrationEnabled(ctx);
  const dbTeams = await getTeamsFromTenant(ctx.tenantId, false);

  const invalidFields = await validate(
    teams,
    {
      requiredFields: teamRequiredFields,
      async onValidEntity(team) {
        try {
          const dbTeam = dbTeams.find(t => t.name === team.name);
          await saveTeamData(ctx, team, dbTeam);
          if (integrationEnabled) await processTeamForCalendarSync(ctx, team, dbTeam);
        } catch (error) {
          logger.error({ ctx, error, team }, 'Error saving team');
          throw new SheetImportError({
            message: `Error saving team - ${error.message}`,
            extraInfo: team,
          });
        }
      },
      async customCheck(team) {
        return await customTeamValidations(ctx, team, teams, dbTeams);
      },
    },
    ctx,
    spreadsheet.Team.columns,
  );

  return {
    invalidFields,
  };
};

export const additionalTeamProcess = async ctx => {
  const newInactiveTeams = await getNewInactiveTeams(ctx);
  if (!newInactiveTeams.length) return [];

  const newInactiveTeamsIds = newInactiveTeams.map(team => team.id);
  await reassignPartiesFromInactiveTeams(ctx, newInactiveTeamsIds);
  return [];
};
