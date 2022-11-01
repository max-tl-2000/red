/*
 * Copyright (c) 2022 Reva Technology Inc., all rights reserved.
 * Unauthorized copying of this file, via any medium is strictly prohibited
 * Licensed under the Elastic License 2.0; you may not use this file except
 * in compliance with the Elastic License 2.0.
 */

import { validate, Validation } from './util';
import { getTenantData } from '../../dal/tenantsRepo';
import DBColumnLength from '../../utils/dbConstants';
import { getTeamBy, updateTeam } from '../../dal/teamsRepo';
import { DALTypes } from '../../../common/enums/DALTypes';
import { spreadsheet } from '../../../common/helpers/spreadsheet';

const TEAM_SETTINGS = 'teamSettings';
const INVALID_TEAM_DISABLE_NEW_LEASE_PARTY =
  "Invalid disableNewLeasePartyCreation setup. disableNewLeasePartyCreation can't be set to 'true' when enableRenewals from Global Settings sheet is set to 'false'.";

const teamSettingsRequiredFields = [
  {
    fieldName: 'team',
    validation: [Validation.NOT_EMPTY, Validation.ALPHANUMERIC],
    maxLength: DBColumnLength.Name,
  },
  {
    fieldName: 'callQueue\nenabled',
    validation: [Validation.BOOLEAN],
    maxLength: DBColumnLength.State,
  },
  {
    fieldName: 'callQueue\ntimeToVoiceMail',
    validation: [Validation.NOT_EMPTY, Validation.POSITIVE_INTEGER],
    maxLength: DBColumnLength.Period,
  },
  {
    fieldName: 'call\nwrapUpDelayAfterCallEnds',
    validation: [Validation.NOT_EMPTY, Validation.POSITIVE_INTEGER],
    maxLength: DBColumnLength.Period,
  },
  {
    fieldName: 'call\ninitialDelayAfterSignOn',
    validation: [Validation.NOT_EMPTY, Validation.POSITIVE_INTEGER],
    maxLength: DBColumnLength.Period,
  },
  {
    fieldName: 'comms\nallowBlockContactFlag',
    validation: [Validation.BOOLEAN],
    maxLength: DBColumnLength.State,
  },
  {
    fieldName: 'features\ndisableNewLeasePartyCreation',
    validation: [Validation.BOOLEAN],
    maxLength: DBColumnLength.State,
  },
];

const PREREQUISITES = [
  {
    field: 'team',
    tableFieldName: 'name',
    table: 'Teams',
    idReceiver: 'teamId',
  },
];

const makeAdditionalValidations = async (ctx, teamSettings) => {
  const errors = [];
  const disableNewLeasePartyCreation = teamSettings['features\ndisableNewLeasePartyCreation'];
  const { settings } = await getTenantData(ctx);
  const { features: { enableRenewals } = {} } = settings;
  if (enableRenewals === false && disableNewLeasePartyCreation === true) {
    errors.push({ name: TEAM_SETTINGS, message: INVALID_TEAM_DISABLE_NEW_LEASE_PARTY });
  }
  return errors;
};

const getTeamSettingsMetadata = teamSettings => {
  const { team, ...settings } = teamSettings;

  return Object.keys(settings).reduce((acc, key) => {
    const [group, setting] = key.split('\n');
    const value = settings[key];
    acc[group] = acc[group] || {};

    if (setting) {
      acc[group][setting] = value;
    } else {
      acc[group] = value;
    }

    return acc;
  }, {});
};

const determineCallRoutingStrategy = (team, settings) => {
  const existingCallRoutingStrategy = team.metadata.callRoutingStrategy;
  if (!settings.callQueue.enabled) return existingCallRoutingStrategy;

  if (![DALTypes.CallRoutingStrategy.EVERYBODY, DALTypes.CallRoutingStrategy.ROUND_ROBIN].includes(existingCallRoutingStrategy)) {
    return DALTypes.CallRoutingStrategy.ROUND_ROBIN;
  }

  return existingCallRoutingStrategy;
};

const saveTeamSettings = async (ctx, teamName, metadata) => {
  const team = await getTeamBy(ctx, { name: teamName });

  const callRoutingStrategy = determineCallRoutingStrategy(team, metadata);

  await updateTeam(ctx, team.id, { metadata: { ...metadata, comms: { ...team.metadata.comms, ...metadata.comms }, callRoutingStrategy } });
};

export const importTeamSettings = async (ctx, settings) => {
  const invalidFields = await validate(
    settings,
    {
      requiredFields: teamSettingsRequiredFields,
      prerequisites: PREREQUISITES,
      async onValidEntity(teamSettings) {
        const metadata = getTeamSettingsMetadata(teamSettings);
        await saveTeamSettings(ctx, teamSettings.team, metadata);
      },
      async customCheck(teamSettings) {
        return await makeAdditionalValidations(ctx, teamSettings);
      },
    },
    ctx,
    spreadsheet.TeamSetting.columns,
  );

  return {
    invalidFields,
  };
};
