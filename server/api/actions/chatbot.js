/*
 * Copyright (c) 2022 Reva Technology Inc., all rights reserved.
 * Unauthorized copying of this file, via any medium is strictly prohibited
 * Licensed under the Elastic License 2.0; you may not use this file except
 * in compliance with the Elastic License 2.0.
 */

import nullish from '../../../common/helpers/nullish';
import DecisionServiceAdapter from '../../common/decision_service/adapters/decisionServiceAdapter';
import RestfulCorticonDecisionServiceAdapter from '../../services/adapters/restfulCorticonDecisionServiceAdapter';
import loggerModule from '../../../common/helpers/logger';
import { ServiceError } from '../../common/errors';

const logger = loggerModule.child({ subType: 'chatbot' });

const decisionService = new DecisionServiceAdapter(new RestfulCorticonDecisionServiceAdapter(logger));

export const chatbotConversation = async req => {
  logger.debug({ ctx: req }, 'chatbotConversation');

  const { rule } = req?.body;
  if (nullish(rule)) {
    throw new ServiceError({ token: 'RULE_REQUIRED', status: 400 });
  }

  if (!rule.toLowerCase().startsWith('c_')) {
    // TODO: enable this once the ruleflow has the prefix
    // throw new ServiceError({ token: 'RULE_NOT_FOUND', status: 404, data: { rule } });
  }

  let actions;
  try {
    actions = await decisionService.getActions(req);
  } catch (error) {
    throw new ServiceError({ token: 'INTERNAL_CHATBOT_ERROR', status: 500, message: error.message });
  }

  return actions;
};
