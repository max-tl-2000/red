/*
 * Copyright (c) 2022 Reva Technology Inc., all rights reserved.
 * Unauthorized copying of this file, via any medium is strictly prohibited
 * Licensed under the Elastic License 2.0; you may not use this file except
 * in compliance with the Elastic License 2.0.
 */

import { exists } from '../../../server/database/factory';
import { ServiceError } from '../../../server/common/errors';

export default class PersonApplicationProvider {
  screeningVersion: string;

  constructor(screeningVersion: string) {
    this.screeningVersion = screeningVersion;
  }

  getScreeningVersion = (): string => this.screeningVersion;

  validateApplicationExists = async (tenantId: string, applicationId: string, repo: string): Promise<boolean> => {
    if (await exists(tenantId, repo, applicationId)) {
      return true;
    }

    throw new ServiceError({
      token: 'PERSON_APPLICATION_NOT_FOUND',
      status: 404,
    });
  };
}
