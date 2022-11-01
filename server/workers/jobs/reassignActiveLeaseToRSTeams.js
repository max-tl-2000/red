/*
 * Copyright (c) 2022 Reva Technology Inc., all rights reserved.
 * Unauthorized copying of this file, via any medium is strictly prohibited
 * Licensed under the Elastic License 2.0; you may not use this file except
 * in compliance with the Elastic License 2.0.
 */

import { mapSeries } from 'bluebird';
import { t } from 'i18next';
import { DALTypes } from '../../../common/enums/DALTypes';
import { getPartiesByWorkflowAndState, updateParty } from '../../dal/partyRepo';
import { getAllDispatchers } from '../../dal/teamsRepo';
import { loadUsersByIds } from '../../services/users';
import { NoRetryError } from '../../common/errors';
import { COMPONENT_TYPES, ACTIVITY_TYPES } from '../../../common/enums/activityLogTypes';
import { logEntity } from '../../services/activityLogService';
import loggerModule from '../../../common/helpers/logger';
import eventTypes from '../../../common/enums/eventTypes';
import { notify } from '../../../common/server/notificationClient';
import { updateJob, updateJobStatus } from '../../services/jobs';
import { getJobById } from '../../dal/jobsRepo';
import { getFirstResidentServicesTeamIdForProperty } from '../../services/teams';

const logger = loggerModule.child({ subType: 'jobs' });

export const reassignActiveLeaseToRSTeams = async payload => {
  const { msgCtx: ctx, manuallyTriggeredJobId } = payload;
  let processed = false;
  let partiesCount = 0;
  try {
    logger.time({ ctx, manuallyTriggeredJobId }, 'Recurring Jobs - reassignActiveLeaseToRSTeams duration');

    const job = manuallyTriggeredJobId ? await getJobById(ctx, manuallyTriggeredJobId) : {};

    manuallyTriggeredJobId && (await updateJobStatus(ctx.tenantId, manuallyTriggeredJobId, DALTypes.JobStatus.IN_PROGRESS));

    const parties = await getPartiesByWorkflowAndState(ctx, DALTypes.WorkflowName.ACTIVE_LEASE, DALTypes.WorkflowState.ACTIVE);
    const allDispatchers = await getAllDispatchers(ctx);
    const allPartyOwners = await loadUsersByIds(
      ctx,
      parties.map(p => p.userId),
    );

    await mapSeries(parties, async party => {
      const residentServicesTeamId = await getFirstResidentServicesTeamIdForProperty(ctx, party.assignedPropertyId);
      const dispatcherForRsTeam = allDispatchers.find(d => d.teamId === residentServicesTeamId);

      if (dispatcherForRsTeam && residentServicesTeamId && (party.userId !== dispatcherForRsTeam.userId || party.ownerTeam !== residentServicesTeamId)) {
        logger.info(
          { ctx, partyId: party.id, userId: dispatcherForRsTeam.userId, teamId: residentServicesTeamId },
          'Reassigning party to resident service team dispatcher',
        );
        const updateDelta = {
          userId: dispatcherForRsTeam.userId,
          collaborators: [...new Set([...party.collaborators, dispatcherForRsTeam.userId])],
          teams: [...new Set([...party.teams, residentServicesTeamId])],
          ownerTeam: residentServicesTeamId,
        };
        await updateParty(ctx, { id: party.id, ...updateDelta });
        await logEntity(ctx, {
          entity: {
            partyId: party.id,
            newPrimaryAgentName: dispatcherForRsTeam.fullName,
            previousPrimaryAgentName: allPartyOwners.find(po => po.id === party.userId).fullName,
            createdByType: DALTypes.CreatedByType.SYSTEM,
          },
          activityType: ACTIVITY_TYPES.UPDATE,
          component: COMPONENT_TYPES.LEASINGTEAM,
        });
        partiesCount++;
      }
    });

    processed = true;
    manuallyTriggeredJobId &&
      (await updateJob(
        ctx.tenantId,
        { ...job, metadata: { result: t('SUCCESSFULL_REASSIGN_LEASES_TO_RS_TEAM', { partiesCount }) } },
        DALTypes.JobStatus.PROCESSED,
      ));
  } catch (error) {
    const msg = 'Error while reassigning active lease to dispatchers of resident service teams';
    logger.error({ ctx, error }, msg);
    processed = false;
    manuallyTriggeredJobId && (await updateJobStatus(ctx.tenantId, manuallyTriggeredJobId, DALTypes.JobStatus.FAILED));
    throw new NoRetryError(msg);
  } finally {
    notify({
      ctx,
      event: eventTypes.REASSIGN_AL_TO_RS_TEAM_COMPLETED,
      data: { successfully: processed, partiesCount, token: processed ? 'SUCCESSFULL_REASSIGN_LEASES_TO_RS_TEAM' : 'FAILED_REASSIGN_LEASES_TO_RS_TEAM' },
    });
  }

  logger.timeEnd({ ctx, payload }, 'Recurring Jobs - reassignActiveLeaseToRSTeams duration');

  return { processed: true };
};
