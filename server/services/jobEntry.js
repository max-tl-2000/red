/*
 * Copyright (c) 2022 Reva Technology Inc., all rights reserved.
 * Unauthorized copying of this file, via any medium is strictly prohibited
 * Licensed under the Elastic License 2.0; you may not use this file except
 * in compliance with the Elastic License 2.0.
 */

import * as jobService from './jobs';
import { now, duration } from '../../common/helpers/moment-utils';

export default class JobEntry {
  constructor(tenantId, jobInfo) {
    this.tenantId = tenantId;
    this.jobInfo = jobInfo;
    this.start = now();
  }

  _setJobDuration = async () => {
    if (!this.jobInfo) return;

    const end = now();
    const durationMs = duration(end.diff(this.start)).asMilliseconds();
    this.job.metadata = {
      ...this.job.metadata,
      start: this.start,
      end,
      duration: durationMs,
    };
  };

  markAsStarted = async () => {
    if (!this.jobInfo) return;

    this.job = await jobService.createRecurringJob({ tenantId: this.tenantId }, this.jobInfo);
  };

  markAsFailed = async error => {
    if (!this.jobInfo) return;

    this.isFailed = true;
    this.job.metadata.error = (error || {}).toString();

    this._setJobDuration();

    await jobService.markJobAsFailed(this.tenantId, this.job);
  };

  markAsProcessed = async () => {
    if (!this.jobInfo || this.isFailed) return;

    this._setJobDuration();

    await jobService.markJobAsProcessed(this.tenantId, this.job);
  };
}
