/*
 * Copyright (c) 2022 Reva Technology Inc., all rights reserved.
 * Unauthorized copying of this file, via any medium is strictly prohibited
 * Licensed under the Elastic License 2.0; you may not use this file except
 * in compliance with the Elastic License 2.0.
 */

import PersonApplicationProviderFactory from './person-application-provider-factory';
import PersonApplicationProvider from './person-application-provider';

const applicationProvider = new PersonApplicationProviderFactory();

export const personApplicationProvider = (screeningVersion: string): PersonApplicationProvider => applicationProvider.getProvider(screeningVersion);
