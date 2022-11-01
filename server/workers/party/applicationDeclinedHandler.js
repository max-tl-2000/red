/*
 * Copyright (c) 2022 Reva Technology Inc., all rights reserved.
 * Unauthorized copying of this file, via any medium is strictly prohibited
 * Licensed under the Elastic License 2.0; you may not use this file except
 * in compliance with the Elastic License 2.0.
 */

import { mapSeries } from 'bluebird';

import loggerModule from '../../../common/helpers/logger';
import { DALTypes } from '../../../common/enums/DALTypes';
import { rawStatement } from '../../database/factory';
import { now } from '../../../common/helpers/moment-utils';
import { addTask, updateTask } from '../../services/tasks';
import { sendApplicationDeclinedComm } from '../../services/quotePromotions';
import { getQuotePromotionsByStatus, getPersonIdsbyPartyIds, getPartyBy } from '../../dal/partyRepo';
import { getAllScreeningResultsForParty } from '../../../rentapp/server/services/screening';
import { FADV_RESPONSE_STATUS } from '../../../rentapp/common/screening-constants';
import { ScreeningDecision } from '../../../common/enums/applicationTypes';
import { getCommsTemplateByPropertyIdAndTemplateSetting } from '../../dal/commsTemplateRepo';
import { TemplateSections, TemplateActions } from '../../../common/enums/templateTypes';

const logger = loggerModule.child({ subType: 'applicationDeclinedHandler' });

const getPartiesWithActiveDeclineDecisionTasks = async ctx => {
  const query = `
    SELECT p.id, p."userId", team."timeZone", team."officeHours", t.id AS "oldTaskId", t.state AS "oldTaskState", t.metadata AS "oldTaskMetadata" 
      FROM db_namespace."Party" p
      INNER JOIN db_namespace."Tasks" t ON t."partyId" = p.id
      INNER JOIN db_namespace."Teams" team ON team.id = p."ownerTeam"
    WHERE p."workflowState" = '${DALTypes.WorkflowState.ACTIVE}'
      AND t.name = '${DALTypes.TaskNames.CONTACT_PARTY_DECLINE_DECISION}'
      AND t.state <> '${DALTypes.TaskStates.CANCELED}'
      AND t.created_at < current_timestamp - interval '1 day'
      AND NOT EXISTS (SELECT 1 FROM db_namespace."Tasks" t2 WHERE t2."partyId" = p.id and t2.name = '${DALTypes.TaskNames.PRINT_DECLINE_LETTER}')
      `;

  const { rows } = await rawStatement(ctx, query, [{}]);
  return rows;
};

export const applicationDeclinedHandler = async payload => {
  const ctx = { tenantId: payload.tenantId };
  logger.trace({ ctx, payload }, 'applicationDeclinedHandler - input params');

  const partiesDataWithDeclinedApplication = await getPartiesWithActiveDeclineDecisionTasks(ctx);

  await mapSeries(partiesDataWithDeclinedApplication, async partyDataWithDeclinedApplication => {
    try {
      const { id: partyId, userId, timeZone, oldTaskId, oldTaskState } = partyDataWithDeclinedApplication;

      const party = await getPartyBy(ctx, { id: partyId });
      const template = await getCommsTemplateByPropertyIdAndTemplateSetting(ctx, party.assignedPropertyId, {
        section: TemplateSections.SCREENING,
        action: TemplateActions.DECLINE_AA_LETTER,
      });

      const screenings = await getAllScreeningResultsForParty(ctx, partyId);
      const screeningResultsCompletedAndDeclined =
        screenings.screeningResults.every(screening => screening.status === FADV_RESPONSE_STATUS.COMPLETE) &&
        screenings.screeningResults.some(screening => screening.applicationDecision === ScreeningDecision.DECLINED);

      const isOldTaskOpenOrCompleted = oldTaskState === DALTypes.TaskStates.ACTIVE || DALTypes.TaskStates.COMPLETED;
      /* commenting this part in case that we decide to process the records in 2 steps
      const jobRunsOnOfficeHours = isCreatedOnOfficeHours({ officeHours, timeZone }, now({ timezone: timeZone }));
      */

      if (!isOldTaskOpenOrCompleted || !screeningResultsCompletedAndDeclined) {
        logger.trace({ ctx, isOldTaskOpenOrCompleted, screeningResultsCompletedAndDeclined }, 'applicationDeclinedHandler - party will not be processed');

        return;
      }

      const followupDeclineApplicationTask = {
        name: DALTypes.TaskNames.PRINT_DECLINE_LETTER,
        category: DALTypes.TaskCategories.MANUAL,
        partyId,
        userIds: [userId],
        dueDate: now({ timezone: timeZone }),
        metadata: { createdBy: userId, formatTitle: true },
      };

      await addTask(ctx, followupDeclineApplicationTask);
      const [quotePromotion] = await getQuotePromotionsByStatus(ctx, partyId, DALTypes.PromotionStatus.CANCELED);
      const senderId = quotePromotion?.modified_by || userId;
      const personIds = await getPersonIdsbyPartyIds(ctx, [partyId], { excludeInactive: true, excludeSpam: true });

      template && (await sendApplicationDeclinedComm(ctx, { partyId, personIds, templateName: template.name, senderId }));

      oldTaskState === DALTypes.TaskStates.ACTIVE && (await updateTask(ctx, oldTaskId, { state: DALTypes.TaskStates.CANCELED }));
    } catch (error) {
      logger.error({ ctx, error }, 'applicationDeclinedHandler failed');
      throw error;
    }
  });

  logger.trace({ ctx, payload }, 'applicationDeclinedHandler - done');
  return { processed: true };
};
