/*
 * Copyright (c) 2022 Reva Technology Inc., all rights reserved.
 * Unauthorized copying of this file, via any medium is strictly prohibited
 * Licensed under the Elastic License 2.0; you may not use this file except
 * in compliance with the Elastic License 2.0.
 */

import request from 'superagent';
import { Exception } from 'handlebars';
import { createJWTToken } from '../../../common/server/jwt-helpers';
import config from '../../config';
import loggerModule from '../../../common/helpers/logger';

const logger = loggerModule.child({ subType: 'exportOneToManysWorker' });

export const runExportOneToManys = async msg => {
  const { msgCtx: ctx, jobInfo } = msg;
  const url = `${config.exportApiUrl}/v1/runExportOneToManys`;

  logger.trace({ ctx, url, jobInfo }, 'Preparing to send one to manys request to the Yardi Export service');

  try {
    const token = createJWTToken(ctx, { expiresIn: '1d' });

    const res = await request
      .post(url)
      .send({
        tenantId: ctx.tenantId,
        jobInfo,
      })
      .set('accept', 'json')
      .set('Authorization', `Bearer ${token}`);

    if (res.statusCode !== 200) {
      throw new Exception(`ExportOneToManys request failed. Status: ${res.statusCode}`);
    }
    logger.trace({ ctx, reqStatus: res.statusCode }, 'One to manys request completed');

    return { processed: true };
  } catch (error) {
    logger.error({ ctx, error }, 'One to manys request failed');
    return { processed: false };
  }
};
