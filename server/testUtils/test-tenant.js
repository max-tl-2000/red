/*
 * Copyright (c) 2022 Reva Technology Inc., all rights reserved.
 * Unauthorized copying of this file, via any medium is strictly prohibited
 * Licensed under the Elastic License 2.0; you may not use this file except
 * in compliance with the Elastic License 2.0.
 */

import v4 from 'uuid/v4';
import envVal from '../../common/helpers/env-val';
import { DALTypes } from '../../common/enums/DALTypes';

const keepDB = envVal('KEEP_DB');

export const tenantId = keepDB ? '0bb68304-db3a-4d32-85f6-903e94554a5e' : v4();
export const tenant = {
  name: 'integration_test_tenant',
  id: tenantId,
  refreshed_at: new Date(),
  metadata: {
    phoneNumbers: [
      { phoneNumber: '16503381450' },
      { phoneNumber: '16503381460' },
      { phoneNumber: '16197384381' },
      { phoneNumber: '12345678923' },
      { phoneNumber: '16504375757' },
      { phoneNumber: '12345678901' },
    ],
    enablePhoneSupport: false,
    plivoSubaccountAuthId: 'testauthid',
    plivoSubaccountAuthToken: 'testauthtoken',
    payment: {
      disableRealPaymentProvider: true,
    },
    externalCalendars: { integrationEnabled: false },
    leasingProviderMode: DALTypes.LeasingProviderMode.FAKE,
  },
  settings: {
    communications: {
      disclaimerLink: 'disclaimer.com',
      contactUsLink: 'contactus.com',
      footerNotice: 'footer text',
      footerCopyright: 'copyright',
    },
    screening: {
      password: 'integrationPassword',
      username: 'integrationUserName',
      originatorId: 'integrationOriginatorId',
    },
    features: {},
  },
  partySettings: {
    traditional: {},
  },
};
