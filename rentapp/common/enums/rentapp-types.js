/*
 * Copyright (c) 2022 Reva Technology Inc., all rights reserved.
 * Unauthorized copying of this file, via any medium is strictly prohibited
 * Licensed under the Elastic License 2.0; you may not use this file except
 * in compliance with the Elastic License 2.0.
 */

const RentappTypes = {
  TimeFrames: {
    YEARLY: 'YEARLY',
    MONTHLY: 'MONTHLY',
    WEEKLY: 'WEEKLY',
  },
  PropertyType: {
    RENT: 'RENT',
    OWN: 'OWN',
  },
  IncomeSourceType: {
    EMPLOYMENT: 'EMPLOYMENT',
    SELF_EMPLOYMENT: 'SELF_EMPLOYMENT',
    OTHER_SOURCE: 'OTHER_SOURCE',
  },
};

const Routes = {
  welcome: '/welcome/',
  registration: '/registration/',
  additionalInfo: '/applicationAdditionalInfo/',
  applicationList: '/applicationList/',
};

const AppId = 'application';

export { RentappTypes, Routes, AppId };
