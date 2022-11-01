/*
 * Copyright (c) 2022 Reva Technology Inc., all rights reserved.
 * Unauthorized copying of this file, via any medium is strictly prohibited
 * Licensed under the Elastic License 2.0; you may not use this file except
 * in compliance with the Elastic License 2.0.
 */

import newId from 'uuid/v4';
import { initQuery } from '../database/factory';

export const saveAnalyticsLog = async ({ ctx, type, component, subComponent, entity, activityDetails, activityContext }) => {
  const id = newId();
  const [res] = await initQuery(ctx)
    .insert({
      id,
      type,
      component,
      subComponent,
      entity,
      activityDetails,
      context: activityContext,
    })
    .into('AnalyticsLog')
    .returning('*');
  return res;
};

export const getAnalyticsLogs = async ctx => await initQuery(ctx).from('AnalyticsLog');
