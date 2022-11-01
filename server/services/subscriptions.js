/*
 * Copyright (c) 2022 Reva Technology Inc., all rights reserved.
 * Unauthorized copying of this file, via any medium is strictly prohibited
 * Licensed under the Elastic License 2.0; you may not use this file except
 * in compliance with the Elastic License 2.0.
 */

import * as repo from '../dal/subscriptionsRepo';

export const getSubscriptions = async ctx => await repo.getSubscriptions(ctx);

export const updateMultipleSubscriptions = async (ctx, subscriptions) => await repo.updateMultipleSubscriptions(ctx, subscriptions);

export const deleteMultipleSubscriptions = async (ctx, subscriptionIds) => await repo.deleteMultipleSubscriptions(ctx, subscriptionIds);

export const insertMultipleSubscriptions = async (ctx, subscriptions) => await repo.insertMultipleSubscriptions(ctx, subscriptions);
