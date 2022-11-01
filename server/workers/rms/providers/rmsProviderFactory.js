/*
 * Copyright (c) 2022 Reva Technology Inc., all rights reserved.
 * Unauthorized copying of this file, via any medium is strictly prohibited
 * Licensed under the Elastic License 2.0; you may not use this file except
 * in compliance with the Elastic License 2.0.
 */

import LROProvider from './lroProvider';
import RevaProvider from './revaProvider';

export default class RMSProviderFactory {
  constructor() {
    this.providers = [LROProvider, RevaProvider];
  }

  getProvider = (fileName, originalPath = '') => {
    let provider = null;
    for (let i = 0; i < this.providers.length; i++) {
      provider = new this.providers[i]();

      if (provider.supportsFile(fileName, originalPath)) break;
    }
    return provider;
  };
}
