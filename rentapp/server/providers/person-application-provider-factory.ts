/*
 * Copyright (c) 2022 Reva Technology Inc., all rights reserved.
 * Unauthorized copying of this file, via any medium is strictly prohibited
 * Licensed under the Elastic License 2.0; you may not use this file except
 * in compliance with the Elastic License 2.0.
 */

import PersonApplicationProviderV1 from './person-application-provider-v1';
import PersonApplicationProviderV2 from './person-application-provider-v2';
import PersonApplicationProvider from './person-application-provider';
import { ScreeningVersion } from '../../../common/enums/screeningReportTypes';

export default class PersonApplicationProviderFactory {
  providers: Array<PersonApplicationProvider> = [];

  initProvider = (index: number = 0): PersonApplicationProvider => {
    if (index === 0) {
      this.providers[index] = (!this.providers[index] && new PersonApplicationProviderV1()) || this.providers[index];
      return this.providers[index];
    }

    this.providers[1] = (!this.providers[1] && new PersonApplicationProviderV2()) || this.providers[1];
    return this.providers[1];
  };

  getProvider = (screeningVersion: string): PersonApplicationProvider => {
    let provider;

    switch (screeningVersion) {
      case ScreeningVersion.V2:
        provider = this.initProvider(1);
        break;
      default:
        provider = this.initProvider(0);
        break;
    }

    return provider;
  };
}
