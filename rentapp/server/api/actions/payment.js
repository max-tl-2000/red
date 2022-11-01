/*
 * Copyright (c) 2022 Reva Technology Inc., all rights reserved.
 * Unauthorized copying of this file, via any medium is strictly prohibited
 * Licensed under the Elastic License 2.0; you may not use this file except
 * in compliance with the Elastic License 2.0.
 */

import { ServiceError } from '../../../../server/common/errors';
import { updatePersonApplicationData, validateApplicant } from '../../services/person-application';
import { badRequestErrorIfNotAvailable } from '../../../../common/helpers/validators';
import * as provider from '../../payment/payment-provider-integration';
import { existsPersonInParty } from '../../../../server/services/party';
import { getApplicationInvoicesByFilter } from '../../services/application-invoices';
import { getFeeById } from '../../../../server/dal/feeRepo';
import { getScreeningVersion } from '../../helpers/screening-helper';
import { validateUniqueEmailApplication, validateUniqueEmail } from '../../helpers/application-helper';
import { personApplicationProvider } from '../../providers/person-application-provider-integration';
import loggerModule from '../../../../common/helpers/logger';

const logger = loggerModule.child({ subType: 'PaymentApi' });

const validatePropertyOnInvoice = async (req, { applicationFeeId, propertyId }) => {
  const fee = await getFeeById(req, applicationFeeId);
  if (!fee || fee.propertyId !== propertyId) {
    throw new ServiceError({ token: 'WRONG_PROPERTY', status: 400 });
  }
};

const getPartyApplicationWithProvider = async (ctx, applicationId) => {
  const { authUser } = ctx;
  const { partyId, tenantId } = authUser;
  let { screeningVersion } = authUser;
  screeningVersion = await getScreeningVersion({ partyId, tenantId, screeningVersion });
  const { partyApplicationId } = await personApplicationProvider(screeningVersion).getPersonApplicationById(ctx, applicationId);
  return {
    partyApplicationId,
    screeningVersion,
  };
};

export const initiatePayment = async req => {
  const { quoteId } = req;
  const { tenantId, partyId, personId, propertyId } = req.authUser;
  logger.info({ ctx: req, quoteId, tenantId, partyId, personId, propertyId }, 'initiatePayment started');

  badRequestErrorIfNotAvailable([
    { property: tenantId, message: 'MISSING_TENANT_ID' },
    { property: req.body.invoice, message: 'MISSING_INVOICE' },
    { property: req.body.invoice.propertyId, message: 'MISSING_PROPERTY' },
    { property: req.body.firstName, message: 'MISSING_FIRST_NAME' },
    { property: req.body.email, message: 'MISSING_EMAIL' },
  ]);

  await validateApplicant(req, { partyId, personId, propertyId });

  if (!(await existsPersonInParty(tenantId, partyId, personId))) {
    throw new ServiceError({
      token: 'PARTY_MEMBER_NOT_ASSOCIATED_TO_PARTY',
      status: 412,
    });
  }

  const {
    invoice: { personApplicationId },
    reportCopyRequested,
    email,
  } = req.body;

  await validateUniqueEmail(req, email, personId);
  await validateUniqueEmailApplication(req, email, partyId, personApplicationId);

  // TODO: move this logic into service
  await updatePersonApplicationData(req, personApplicationId, {
    reportCopyRequested,
  });

  const [applicationInvoice] = await getApplicationInvoicesByFilter(req, {
    personApplicationId,
    paymentCompleted: true,
  });

  if (applicationInvoice) {
    return {
      formUrl: 'payment-success.html',
      invoiceId: applicationInvoice.id,
      alreadyPaid: true,
    };
  }

  const payment = { ...req.body, authUser: req.authUser };
  await validatePropertyOnInvoice(req, payment.invoice);

  const { partyApplicationId, screeningVersion } = await getPartyApplicationWithProvider(req, personApplicationId);

  payment.invoice.partyApplicationId = partyApplicationId;

  return provider.initiatePayment({ ...payment, tenantId, screeningVersion });
};
