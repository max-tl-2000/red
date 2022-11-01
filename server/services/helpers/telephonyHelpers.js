/*
 * Copyright (c) 2022 Reva Technology Inc., all rights reserved.
 * Unauthorized copying of this file, via any medium is strictly prohibited
 * Licensed under the Elastic License 2.0; you may not use this file except
 * in compliance with the Elastic License 2.0.
 */

import { getTeamsByIds } from '../../dal/teamsRepo';
import { DALTypes } from '../../../common/enums/DALTypes';
import loggerModule from '../../../common/helpers/logger';
import { encodeSIP } from '../../../common/helpers/strings';

const logger = loggerModule.child({ subType: 'telephonyHelpers' });

export const shouldRecordCallForTeams = (callDirection, teams) =>
  teams
    .map(t => t.metadata.callRecordingSetup)
    .some(
      s =>
        s &&
        (s === DALTypes.CallRecordingSetup.INBOUND_AND_OUTBOUND ||
          (s === DALTypes.CallRecordingSetup.INBOUND && callDirection === DALTypes.CommunicationDirection.IN) ||
          (s === DALTypes.CallRecordingSetup.OUTBOUND && callDirection === DALTypes.CommunicationDirection.OUT)),
    );

export const shouldRecordCall = async (ctx, { id: commId, teams: teamIds, direction }) => {
  logger.debug({ ctx, commId, direction }, 'shouldRecordCall - params');
  const teams = await getTeamsByIds(ctx, teamIds);
  const shouldRecord = shouldRecordCallForTeams(direction, teams);
  logger.debug({ ctx, commId, direction, shouldRecord }, 'shouldRecordCall - result');
  return shouldRecord;
};

export const extractSipUsername = (ctx, endpoint) => {
  logger.debug({ ctx, endpoint }, 'extracting SIP username');

  // looking for "sip:JohnDoe42@phone.plivo.com" patterns
  const plivoSipUsernameExpression = /sip:(\w+)@phone\.plivo\.com/i;
  const matchResult = plivoSipUsernameExpression.exec(endpoint);

  if (!matchResult) return { isSipEndpoint: false };

  const [, username] = matchResult;
  return { isSipEndpoint: true, username };
};

export const toQualifiedSipEndpoint = endpoint => `sip:${endpoint.username}@phone.plivo.com`;
export const toCommIdSipHeader = commId => `commId=${encodeSIP(commId)}`;

export const getAnsweringUserInfo = (ctx, user, answeringEndpoint) => {
  if (user.ringPhones?.length && user.ringPhones.includes(`+${answeringEndpoint}`)) {
    return { isAnsweringUser: true, hasAnsweredFromExternalEndpoint: true };
  }

  const { isSipEndpoint, username } = extractSipUsername(ctx, answeringEndpoint);

  if (isSipEndpoint) {
    const endpoint = user.sipEndpoints.find(e => e.username === username);

    return {
      isAnsweringUser: !!endpoint,
      hasAnsweredFromExternalEndpoint: endpoint && !endpoint.isUsedInApp,
    };
  }

  return {};
};
