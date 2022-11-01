/*
 * Copyright (c) 2022 Reva Technology Inc., all rights reserved.
 * Unauthorized copying of this file, via any medium is strictly prohibited
 * Licensed under the Elastic License 2.0; you may not use this file except
 * in compliance with the Elastic License 2.0.
 */

import config from '../../../config';
import { ServiceError } from '../../../common/errors';
import { createModel } from '../../../../client/helpers/Form/FormModel';

const validateRequest = req => {
  const { customeroldApiToken } = config;
  const reqApiToken = req.query?.apiToken;

  if (!reqApiToken) {
    throw new ServiceError({
      token: 'API_TOKEN_REQUIRED',
      status: 403,
    });
  }

  if (reqApiToken !== customeroldApiToken) {
    throw new ServiceError({
      token: 'API_TOKEN_INVALID',
      status: 403,
    });
  }
};

export const sendCustomerOldRentDefermentDoc = async req => {
  validateRequest(req);

  const model = createModel(
    {
      addendumEffectiveDate: '',
      addendumExpirationDate: '',
      amountDeferred: '',
      countersignerAgent: '',
      countersignerAgentEmail: '',
      periodOfDeferment: '',
      propertyAddress: '',
      propertyCity: '',
      propertyName: '',
      repaymentTerms: '',
      unitNumber: '',

      residentName01: '',
      residentName01Email: '',

      residentName02: '',
      residentName02Email: '',

      residentName03: '',
      residentName03Email: '',

      residentName04: '',
      residentName04Email: '',

      residentName05: '',
      residentName05Email: '',

      residentName06: '',
      residentName06Email: '',
    },
    {
      addendumEffectiveDate: { required: '"Addendum effective date" is required' },
      addendumExpirationDate: { required: '"Addendum expiration date" is required' },
      amountDeferred: { required: '"Amount" is required' },
      countersignerAgent: { required: '"Autorized countersigner agent" is required' }, // map to counterSignerDescriptor
      countersignerAgentEmail: { required: '"Autorized countersigner agent\'s email" is required' },
      periodOfDeferment: { required: '"Period of deferment" is required' },
      propertyAddress: { required: '"Property Address" is required' },
      propertyCity: { required: '"PropertyCity/State/Zip" is required' },
      propertyName: { required: '"Property Name" is required' },
      repaymentTerms: { required: '"Repayment terms" is required' },
      unitNumber: { required: '"Apartment unit number" is required' },

      residentName01: { required: '"Resident 01 name" is required' },
      residentName01Email: { required: '"Resident 01 email" is required' },

      residentName02: '',
      residentName02Email: '',

      residentName03: '',
      residentName03Email: '',

      residentName04: '',
      residentName04Email: '',

      residentName05: '',
      residentName05Email: '',

      residentName06: '',
      residentName06Email: '',
    },
  );

  const {
    addendumEffectiveDate,
    addendumExpirationDate,
    amountDeferred,
    countersignerAgent, // map to counterSignerDescriptor
    countersignerAgentEmail,
    periodOfDeferment,
    propertyAddress,
    propertyCity,
    propertyName,
    repaymentTerms,
    unitNumber,

    residentName01,
    residentName01Email,

    residentName02,
    residentName02Email,

    residentName03,
    residentName03Email,

    residentName04,
    residentName04Email,

    residentName05,
    residentName05Email,

    residentName06,
    residentName06Email,
  } = req.body;

  model.updateFrom({
    addendumEffectiveDate,
    addendumExpirationDate,
    amountDeferred,
    countersignerAgent,
    countersignerAgentEmail,
    periodOfDeferment,
    propertyAddress,
    propertyCity,
    propertyName,
    repaymentTerms,
    unitNumber,

    residentName01,
    residentName01Email,

    residentName02,
    residentName02Email,

    residentName03,
    residentName03Email,

    residentName04,
    residentName04Email,

    residentName05,
    residentName05Email,

    residentName06,
    residentName06Email,
  });

  await model.validate();

  if (!model.valid) {
    throw new ServiceError({
      token: 'INVALID_DATA',
      status: 400,
      data: model.summary,
    });
  }

  const data = model.serializedData;

  const { createLeaseDeferralEnvelope } = require('../../../docusignCustomerOld/sendEnvelopeWithTemplate'); // eslint-disable-line global-require

  await createLeaseDeferralEnvelope(req, data);

  return { success: true };
};
