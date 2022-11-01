/*
 * Copyright (c) 2022 Reva Technology Inc., all rights reserved.
 * Unauthorized copying of this file, via any medium is strictly prohibited
 * Licensed under the Elastic License 2.0; you may not use this file except
 * in compliance with the Elastic License 2.0.
 */

import { mapSeries } from 'bluebird';
import loggerModule from '../../../common/helpers/logger';
import { tasksIntegrationEndpoint, postEntity, patchEntity } from '../utils';
import { completeContactInfo } from './taskDefinitions/completeContactInfo';
import { countersignLease } from './taskDefinitions/countersignLease';
import { introduceYourself } from './taskDefinitions/introduceYourself';
import { removeAnonymousEmail } from './taskDefinitions/removeAnonymousEmail';
import { contactBack } from './taskDefinitions/contactBack';
import { promoteApplication } from './taskDefinitions/promoteApplication';
import { reviewApplication } from './taskDefinitions/reviewApplication';
import { sendContract } from './taskDefinitions/sendContract';
import { sendRenewalQuote } from './taskDefinitions/sendRenewalQuote';
import { sendRenewalReminder } from './taskDefinitions/sendRenewalReminder';
import { collectServiceAnimalDoc } from './taskDefinitions/collectServiceAnimalDoc';
import { collectEmergencyContact } from './taskDefinitions/collectEmergencyContact';
import { contactPartyDeclinedDecision } from './taskDefinitions/contactPartyDeclinedDecision';

const logger = loggerModule.child({ subType: 'decision_service/taskHandler' });

const processTasks = async (ctx, party, token, definition) => {
  const endpoint = tasksIntegrationEndpoint(ctx.body?.callBackUrl, party.id);

  const createRequests = party.endDate ? [] : (await definition.createTasks(ctx, party, token)).map(task => postEntity(ctx, task, endpoint, token));

  const completeRequests = (await definition.completeTasks(ctx, party, token)).map(task => patchEntity(ctx, task, endpoint, token));

  const cancelRequests = (await definition.cancelTasks(ctx, party, token)).map(task => patchEntity(ctx, task, endpoint, token));

  const tasksRequests = [...createRequests, ...completeRequests, ...cancelRequests];

  const processedTasks = await mapSeries(tasksRequests, async promise => await promise);
  const errors = processedTasks.filter(({ error }) => error);
  if (errors && errors.length) {
    logger.trace({ ctx, errors }, 'taskHandler/processTasks');
    return { error: errors };
  }
  return {};
};

export const processCompleteContactInfo = async (ctx, party, token) => await processTasks(ctx, party, token, completeContactInfo);
export const processCounterSignLease = async (ctx, party, token) => await processTasks(ctx, party, token, countersignLease);
export const processIntroduceYourself = async (ctx, party, token) => await processTasks(ctx, party, token, introduceYourself);
export const processRemoveAnonymousEmail = async (ctx, party, token) => await processTasks(ctx, party, token, removeAnonymousEmail);
export const processContactBack = async (ctx, party, token) => await processTasks(ctx, party, token, contactBack);
export const processPromoteApplication = async (ctx, party, token) => await processTasks(ctx, party, token, promoteApplication);
export const processSendContract = async (ctx, party, token) => await processTasks(ctx, party, token, sendContract);
export const processReviewApplication = async (ctx, party, token) => await processTasks(ctx, party, token, reviewApplication);
export const processSendRenewalQuote = async (ctx, party, token) => await processTasks(ctx, party, token, sendRenewalQuote);
export const processSendRenewalReminder = async (ctx, party, token) => await processTasks(ctx, party, token, sendRenewalReminder);
export const processCollectServiceAnimalDoc = async (ctx, party, token) => await processTasks(ctx, party, token, collectServiceAnimalDoc);
export const processCollectEmergencyContact = async (ctx, party, token) => await processTasks(ctx, party, token, collectEmergencyContact);
export const processContactPartyDeclinedDecision = async (ctx, party, token) => await processTasks(ctx, party, token, contactPartyDeclinedDecision);
