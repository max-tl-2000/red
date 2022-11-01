/*
 * Copyright (c) 2022 Reva Technology Inc., all rights reserved.
 * Unauthorized copying of this file, via any medium is strictly prohibited
 * Licensed under the Elastic License 2.0; you may not use this file except
 * in compliance with the Elastic License 2.0.
 */

import { initQuery, insertOrUpdate, getOne } from '../database/factory';

export const saveDisclosure = (ctx, disclosure) =>
  insertOrUpdate(ctx.tenantId, 'Disclosure', disclosure, {
    conflictColumns: ['name'],
  });

export const getDisclosures = async ctx => await initQuery(ctx).from('Disclosure').orderBy('displayOrder', 'desc');

export const getDisclosureById = (ctx, id) => getOne(ctx, 'Disclosure', id);
