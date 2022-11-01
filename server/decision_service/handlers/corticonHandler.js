/*
 * Copyright (c) 2022 Reva Technology Inc., all rights reserved.
 * Unauthorized copying of this file, via any medium is strictly prohibited
 * Licensed under the Elastic License 2.0; you may not use this file except
 * in compliance with the Elastic License 2.0.
 */

import loggerModule from '../../../common/helpers/logger';
import { integrationEndpoint } from '../utils';
import { CORTICON_ACTIONS } from '../adapters/actions/corticon';

const logger = loggerModule.child({ subType: 'decision_service/corticonHandler' });

export const processCorticonActions = async (ctx, party, token, actions) => {
  const actionPromises = actions
    .map(({ action, payloads, sessionId }) => {
      const corticonAction = CORTICON_ACTIONS[action];

      if (!corticonAction) {
        logger.warn({ ctx, action }, 'corticon returned an action that is not supported');
        return corticonAction;
      }

      const { actionFn, actionIntegrationPath } = corticonAction;

      // in some cases if we don't provide an actionIntegrationPath, we can define
      // the endpoint inside the actionFn. In those situations trying to define an
      // endpoint here won't be useful
      const endpoint = actionIntegrationPath ? integrationEndpoint(ctx.body?.callBackUrl, party.id, actionIntegrationPath) : undefined;
      return payloads.map(async p => await actionFn(ctx, p, endpoint, token, { reqId: sessionId }));
    })
    .reduce((acc, arr) => [...acc, ...arr], []);

  const processedActions = await Promise.all(actionPromises);
  const errors = processedActions.filter(action => action && action.error);
  if (errors && errors.length) {
    logger.trace({ ctx, errors }, 'corticonHandler/processCorticonActions');
    return { error: errors };
  }
  return {};
};
