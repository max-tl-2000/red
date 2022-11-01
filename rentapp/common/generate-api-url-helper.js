/*
 * Copyright (c) 2022 Reva Technology Inc., all rights reserved.
 * Unauthorized copying of this file, via any medium is strictly prohibited
 * Licensed under the Elastic License 2.0; you may not use this file except
 * in compliance with the Elastic License 2.0.
 */

import { addParamsToUrl } from '../../common/helpers/urlParams';

export const getBaseRentappUrl = () => window.location.origin;

export const createDocumentDownloadURL = (baseUrl, documentId, token) =>
  `${baseUrl}/api/personApplications/current/documents/${documentId}/retrieve?token=${token}`;

export const createViewScreeningReportSummaryUrl = (baseUrl, { partyId, quoteId, leaseTermId }, token) => {
  const url = `${baseUrl}/api/screeningSummary/${partyId}/view/report`;
  return addParamsToUrl(url, { token, quoteId, leaseTermId });
};
