/*
 * Copyright (c) 2022 Reva Technology Inc., all rights reserved.
 * Unauthorized copying of this file, via any medium is strictly prohibited
 * Licensed under the Elastic License 2.0; you may not use this file except
 * in compliance with the Elastic License 2.0.
 */

import { mapDataToFields } from './utils';

const fields = {
  nameID: {
    fn: ({ partyMember, externals }) => {
      const externalInfo = externals && externals.find(e => e.partyMemberId === partyMember.id && !e.endDate);
      return externalInfo && externalInfo.externalId;
    },
    isMandatory: true,
  },
  description: 'App fee',
  amount: {
    fn: data => data.holdDepositAmount.toFixed(2),
    isMandatory: true,
  },
  transactionReference: {
    fn: data => (data.holdDepositInvoice && data.holdDepositInvoice.transactionId ? data.holdDepositInvoice.transactionId : data.appFeeInvoice.transactionId),
    isMandatory: true,
  },
  convenienceFee: 0,
  securityCode: {
    fn: data => data.holdDepositSecurityCode,
  },
  transactionOutcome: 'Processed',
  // Note this has been misspelled from the original spec
  paymentSucceded: 'Y',
};

export const createApplicationDepositPaymentMapper = data => mapDataToFields(data, fields);
