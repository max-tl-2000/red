/*
 * Copyright (c) 2022 Reva Technology Inc., all rights reserved.
 * Unauthorized copying of this file, via any medium is strictly prohibited
 * Licensed under the Elastic License 2.0; you may not use this file except
 * in compliance with the Elastic License 2.0.
 */

import { getTeamSettingsToExport } from '../../../dal/teamsRepo';
import { buildDataPumpFormat, mapToExportSheet } from '../../helpers/export';

const MAPPERS_TO_SHEET = [
  {
    dbField: 'callQueue timeToVoiceMail',
    columnHeader: 'callQueue\ntimeToVoiceMail',
  },
  {
    dbField: 'callQueue enabled',
    columnHeader: 'callQueue\nenabled',
  },
  {
    dbField: 'call wrapUpDelayAfterCallEnds',
    columnHeader: 'call\nwrapUpDelayAfterCallEnds',
  },
  {
    dbField: 'call initialDelayAfterSignOn',
    columnHeader: 'call\ninitialDelayAfterSignOn',
  },
  {
    dbField: 'features disableNewLeasePartyCreation',
    columnHeader: 'features\ndisableNewLeasePartyCreation',
  },
  {
    dbField: 'comms allowBlockContactFlag',
    columnHeader: 'comms\nallowBlockContactFlag',
  },
];

export const exportTeamSettings = async (ctx, { columnHeaders: columnHeadersOrdered }) => {
  const teamSettings = await getTeamSettingsToExport(ctx);
  const teamSettingsMapped = mapToExportSheet(teamSettings, MAPPERS_TO_SHEET);

  return buildDataPumpFormat(teamSettingsMapped, columnHeadersOrdered);
};
