/*
 * Copyright (c) 2022 Reva Technology Inc., all rights reserved.
 * Unauthorized copying of this file, via any medium is strictly prohibited
 * Licensed under the Elastic License 2.0; you may not use this file except
 * in compliance with the Elastic License 2.0.
 */

import { DALTypes } from '../../common/enums/DALTypes';
import { initQuery, insertOrUpdate } from '../database/factory';
import { now } from '../../common/helpers/moment-utils';

// TODO: for now only extracting parties as styles are incorrect
export const getNavigationHistory = async (ctx, userId) =>
  await initQuery(ctx)
    .from('NavigationHistory')
    .where('userId', userId)
    .andWhere('entity_type', DALTypes.NavigationHistoryType.PARTY)
    .andWhere('visited_at', '>=', now().subtract(7, 'days'))
    .limit(10)
    .orderBy('visited_at', 'desc');

export const saveNavigationHistoryEntry = async (ctx, entry) =>
  await insertOrUpdate(ctx.tenantId, 'NavigationHistory', entry, {
    outerTrx: ctx.trx,
    conflictColumns: ['entity_id', 'userId'],
  });
