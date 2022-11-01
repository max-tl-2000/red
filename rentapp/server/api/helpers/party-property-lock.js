/*
 * Copyright (c) 2022 Reva Technology Inc., all rights reserved.
 * Unauthorized copying of this file, via any medium is strictly prohibited
 * Licensed under the Elastic License 2.0; you may not use this file except
 * in compliance with the Elastic License 2.0.
 */

import { getPersonApplicationsByFilter } from '../../services/person-application';
import { getApplicationInvoicesByFilter } from '../../services/application-invoices';
import { getPropertyForRegistration } from '../../../../server/helpers/party';
import { DALTypes } from '../../../../common/enums/DALTypes';
import { getInventoryForQuote } from '../../../../server/services/inventories';

const getPropertyIdForApplication = async (ctx, quoteId) => {
  const { propertyId } = await getInventoryForQuote(ctx, quoteId, ['propertyId']);
  return propertyId;
};

const getLockedProperty = async (ctx, { partyId, propertyId }, applicationInvoice) => {
  if (!propertyId) return undefined;

  const { quoteId } = applicationInvoice;
  if (quoteId) {
    const lockedPropertyId = await getPropertyIdForApplication(ctx, quoteId);
    if (lockedPropertyId === propertyId) return undefined;

    return { quoteId, propertyId: lockedPropertyId };
  }

  const lockedProperty = await getPropertyForRegistration(ctx, { partyId });
  if (!lockedProperty || lockedProperty.id === propertyId) return undefined;

  return { propertyId: lockedProperty.id };
};

// Test Cases:
// 1. First applicant apply without a quote - property A
//  - second applicant apply with a quote - property B
//  - second applicant apply without a quote - property B
// 2. First applicant apply with a quote - property A
//  - second applicant apply with a quote - property B
//  - second applicant apply without a quote - property B
const getLockedApplicationByQuoteId = async (ctx, { partyId, quoteId, propertyId }, applicationInvoice) => {
  if (!(applicationInvoice.quoteId && quoteId)) {
    if (!quoteId || propertyId) {
      return await getLockedProperty(ctx, { partyId, propertyId }, applicationInvoice);
    }

    const lockedPropertyId = await getPropertyIdForApplication(ctx, quoteId);
    return await getLockedProperty(ctx, { partyId, propertyId: lockedPropertyId }, applicationInvoice);
  }

  if (applicationInvoice.quoteId === quoteId) return undefined;
  const lockedPropertyIdByInvoice = await getPropertyIdForApplication(ctx, applicationInvoice.quoteId);

  const lockedPropertyId = await getPropertyIdForApplication(ctx, quoteId);
  if (lockedPropertyIdByInvoice === lockedPropertyId) return undefined;

  return {
    quoteId: applicationInvoice.quoteId,
    propertyId: lockedPropertyIdByInvoice,
  };
};

// Return the locked property for application based on the first paid application (more details CPM-6825)
export const getPartyPropertyLockData = async (ctx, { partyId, quoteId, propertyId }) => {
  const personApplications = await getPersonApplicationsByFilter(ctx, {
    partyId,
  });
  const application = personApplications.find(
    personApplication =>
      personApplication.applicationStatus === DALTypes.PersonApplicationStatus.PAID ||
      personApplication.applicationStatus === DALTypes.PersonApplicationStatus.COMPLETED,
  );

  if (!application) return undefined;

  const [applicationInvoice] = await getApplicationInvoicesByFilter(ctx, {
    personApplicationId: application.id,
    paymentCompleted: true,
  });
  if (!applicationInvoice) return undefined;

  return await getLockedApplicationByQuoteId(ctx, { partyId, quoteId, propertyId }, applicationInvoice);
};
