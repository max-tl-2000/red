/*
 * Copyright (c) 2022 Reva Technology Inc., all rights reserved.
 * Unauthorized copying of this file, via any medium is strictly prohibited
 * Licensed under the Elastic License 2.0; you may not use this file except
 * in compliance with the Elastic License 2.0.
 */

import groupBy from 'lodash/groupBy';
import { rawStatement } from '../database/factory';
import { DALTypes } from '../../common/enums/DALTypes';

/* TODO: Removed logging in the dashboard repo as it creates too much logging.
         We will need to reenable when we need to, we are evaluating the log levels used
         throughout the app so we don't end up logging too much if the logs are not useful. */

// import loggerModule from '../../common/helpers/logger';
// const logger = loggerModule.child({ subType: 'dal/dashboardRepo' });

export const fetchAdditionalData = async (ctx, users, parties, includeStrongMatchData) => {
  const partyIds = parties.reduce((acc, { groupedParties }) => {
    (groupedParties || []).forEach(({ id }) => acc.push(id));
    return acc;
  }, []);

  const wrapper = () =>
    includeStrongMatchData
      ? `
  SELECT * FROM db_namespace.getadditionaldata(
                            :party_ids,
                            :users,
                            '${DALTypes.StrongMatchStatus.NONE}');
  `
      : `
  SELECT * FROM db_namespace.getadditionaldata(
                            :party_ids,
                            :users,
                            NULL);
  `;

  const { rows } = await rawStatement(ctx, wrapper(), [
    {
      party_ids: partyIds,
      users,
    },
  ]);

  const [partyMembers, tasks, partyQuotePromotions, personApplications, leases] = rows.map(row => groupBy(row.c_details, s => s.partyId));
  return {
    partyMembers,
    tasks,
    partyQuotePromotions,
    personApplications,
    leases,
  };
};

const getStrongMatchData = async (ctx, allPartyIds) => {
  const queryString = `WITH psm AS
                       (
                       SELECT psm."firstPersonId" AS "personId",count(1) AS strongMatchCount
                       FROM db_namespace."PersonStrongMatches" psm
                       WHERE psm."status" = '${DALTypes.StrongMatchStatus.NONE}'
                       GROUP BY psm."firstPersonId"
                       UNION
                       SELECT psm."secondPersonId" AS "personId",count(1) AS strongMatchCount
                       FROM db_namespace."PersonStrongMatches" psm
                       WHERE psm."status" = '${DALTypes.StrongMatchStatus.NONE}'
                       GROUP BY psm."secondPersonId"
                       )
                       SELECT p.id as "partyId", p.state as "state", pers.id as "personId"
                       FROM db_namespace."Party" p
                        INNER JOIN db_namespace."PartyMember" pm ON p.id = pm."partyId"
                        INNER JOIN db_namespace."Person" pers ON pers.id = pm."personId"
                        LEFT JOIN psm ON pers.id = psm."personId"
                       WHERE ARRAY[p.id::varchar(36)] <@ :allPartyIds
                        AND psm.strongMatchCount > 0
                        AND pm."endDate" IS NULL`;

  const results = await rawStatement(ctx, queryString, [{ allPartyIds }]);
  return results.rows;
};

const getDashboardDataQuery = `
    SELECT c_state AS state,
           c_total AS total,
           c_today AS today,
           c_tomorrow AS tomorrow,
           c_allpartyids AS "allPartyIds",
           c_groupedparties AS "groupedParties"
    FROM db_namespace.getdashboarddata(
                                :startIndex,
                                :endIndex,
                                :ranks,
                                :teams,
                                :users,
                                :callBackTask);
  `;

export const loadDashboardData = async (ctx, { users, teams }, { showOnlyToday, includeStrongMatchData /* ,partyId */ }) => {
  const { rows } = await rawStatement(ctx, getDashboardDataQuery, [
    {
      teams,
      users,
      callBackTask: DALTypes.TaskNames.CALL_BACK,
      startIndex: 1,
      endIndex: 400, // until server side pagination is used
      ranks: showOnlyToday ? [0, 1, 2, 3, 4] : [0, 1, 2, 3, 4, 5, 6, 7],
    },
  ]);

  const allPartyIds = rows.map(row => row.allPartyIds).reduce((a, b) => a.concat(b), []);

  const strongMatchData = includeStrongMatchData ? await getStrongMatchData(ctx, allPartyIds) : [];

  const additionalData = await fetchAdditionalData(ctx, users, rows, includeStrongMatchData);
  return { rows, additionalData, strongMatchData };
};
