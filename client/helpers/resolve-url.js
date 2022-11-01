/*
 * Copyright (c) 2022 Reva Technology Inc., all rights reserved.
 * Unauthorized copying of this file, via any medium is strictly prohibited
 * Licensed under the Elastic License 2.0; you may not use this file except
 * in compliance with the Elastic License 2.0.
 */

import { HOSTNAME_FROM_URL } from 'regex';
import cfg from './cfg';
import { addParamsToUrl } from '../../common/helpers/urlParams';

export const resolveTenantInUrl = (baseUrl, token) => {
  const rentappHostname = cfg('rentapp').hostname;
  const url = baseUrl.replace(HOSTNAME_FROM_URL, `$1${rentappHostname}$2`);

  return `${url}${token}`;
};

export const convertTenantToRentappUrl = ({ partyId, quoteId, leaseTermId, canReviewApplication, canSeeCreditReport, screeningDelayedDecision }, token) => {
  // TODO: From a REST perspective the ID in this URL is expected to be a partyApplicationId
  // should refactor to be part of party domain or change the URL to not look like this
  const baseUrl = `${window.location.origin}/partyApplications/${partyId}/review/`;
  const url = resolveTenantInUrl(baseUrl, token);
  return addParamsToUrl(url, { quoteId, leaseTermId, canReviewApplication, canSeeCreditReport, screeningDelayedDecision });
};

export const getApplyNowUrl = token => {
  const baseUrl = `${window.location.origin}/welcome/`;
  return resolveTenantInUrl(baseUrl, token);
};

export const getEditApplicationUrl = token => {
  const baseUrl = `${window.location.origin}/applicationAdditionalInfo/`;
  return resolveTenantInUrl(baseUrl, token);
};
