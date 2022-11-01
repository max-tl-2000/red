/*
 * Copyright (c) 2022 Reva Technology Inc., all rights reserved.
 * Unauthorized copying of this file, via any medium is strictly prohibited
 * Licensed under the Elastic License 2.0; you may not use this file except
 * in compliance with the Elastic License 2.0.
 */

import { deferred } from './deferred';

// TODO:  why do some of these start with / and others do not?
export const paths = {
  HOME: '/',
  PRINT: '/friendlyPrint/party/:partyId/comm/:communicationId(/:autoprint)',
  CONTACT_US: 'contactUs',
  REGISTER: 'register/:inviteToken',
  PROSPECT_DETAILS: 'prospect/:prospectId',
  PUBLISHED_QUOTE: 'publishedQuote/:quoteId',
  QUOTE: 'quote/:quoteId',
  SIGN_LEASE_IN_OFFICE: '/leases/:envelopeId/sign/Resident*',
  EXECUTE_LEASE: '/leaseExecution/:token',
  REVIEW_LEASE: '/leaseReview/:token',
  SIGN_GUARANTEE_LEASE_IN_OFFICE: '/leases/:envelopeId/sign/Guarantor*',
  COUNTERSIGN_LEASE_IN_OFFICE: '/leases/:envelopeId/sign/CounterSigner1',
  RESIDENT_SIGN_LEASE_FROM_EMAIL: 'signature-token',
  DOWNLOAD_LEASE: 'leases/download',
  DOWNLOAD_LEASE_PREVIEW: 'leases/downloadPreview',
  PROSPECT_DETAILS_APPOINTMENT: 'prospect/:prospectId/appointment/:appointmentId',
  SIGNATURE_CONFIRMATION: '/signatureConfirmation/:token',
  PERSON_DETAILS: 'leads/:personId',
  INVENTORY_DETAILS: 'inventory/:inventoryId',
  NEED_HELP: 'needHelp(/:email)',
  RESET_PASSWORD: 'resetPassword/:resetToken',
  SEARCH: 'search',
  TENANT_ADMIN: 'tenantAdmin',
  TENANT_RINGCENTRAL_TOKEN: 'RingCentralTokenRefreshPage',
  ADMIN: 'admin',
  PARTY_PAGE_UNIFIED: 'party(/:partyId)',
  PARTY_PAGE_UNIFIED_APPOINTMENT: 'party/:partyId/appointment/:appointmentId',
  PARTY_PAGE_UNIFIED_LEASE: 'party/:partyId/lease/:leaseId/sign/:partyMemberId',
  TEST_DOCUSIGN: '/test/fakeDocuSignPage',
  APP_SETTINGS: '/applicationSettings',
  SUBSCRIPTIONS: '/subscriptions',
  COMMUNICATION_MANAGEMENT: '/cohortComms',
  NOT_FOUND: '*',
};

export const pathExists = (pathName, pathsToCheck) => {
  // React prints a warning when this is required, which causes a lot of noise during unit tests
  // So, dynamically loading it. See CPM-19998
  const { match } = require('react-router');

  const dfd = deferred({ timeout: 1000 });

  const pathsToUse = pathsToCheck || paths;
  match(
    {
      routes: Object.values(pathsToUse).map(path => ({ path })),
      location: pathName,
    },
    (error, redirectLocation, renderProps) => {
      if (error) dfd.resolve(false);

      const [{ path }] = renderProps.routes;
      if (path === paths.NOT_FOUND) dfd.resolve(false);

      dfd.resolve(true);
    },
  );

  return dfd;
};

export const constructUrl = (path, host, params = {}) => {
  // see TODO above
  if (path[0] !== '/') path = `/${path}`;

  return `https://${host}${Object.entries(params).reduce((acc, [key, value]) => acc.replace(`:${key}`, value), path)}`.replace('*', '');
};
