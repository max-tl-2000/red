/*
 * Copyright (c) 2022 Reva Technology Inc., all rights reserved.
 * Unauthorized copying of this file, via any medium is strictly prohibited
 * Licensed under the Elastic License 2.0; you may not use this file except
 * in compliance with the Elastic License 2.0.
 */

import { observable, computed, autorun } from 'mobx';
import { window } from '../../common/helpers/globals';
import { push, syncedHistory, replace } from './navigator';
import { windowOpen } from './win-open';
// TODO use the rest of the paths
import { paths } from '../../common/helpers/paths';

const addAppointmentIdIfNeeded = (path, appointmentId) => {
  if (!appointmentId) return path;
  return `${path}/appointment/${appointmentId}`;
};

const addLeaseIdIfNeeded = (path, { leaseId, personId }) => {
  if (!leaseId) return path;

  if (!personId) throw new Error('personId is required to sign a lease');
  return `${path}/lease/${leaseId}/sign/${personId}`;
};

const addQueryParams = (path, options) => {
  const queryParts = [];
  const { threadId, reviewApplication, openMergeParties, isCorporateParty, openMatch, personId } = options;

  threadId && queryParts.push(`threadId=${threadId}`);

  reviewApplication && queryParts.push('reviewApplication=true');

  if (openMergeParties && !isCorporateParty) {
    queryParts.push('openMergeParties=true');

    if (!personId) throw new Error('personId is required when openMergeParties is set');

    queryParts.push(`personId=${personId}`);
  }

  if (openMatch) {
    queryParts.push('openMatch=true');

    if (!personId) throw new Error('personId is required when openMatch is set');

    queryParts.push(`personId=${personId}`);
  }

  return queryParts.length > 0 ? `${path}?${queryParts.join('&')}` : path;
};

/**
 * build the party url and the different combinations
 * @example:
 * ```
 * buildPartyUrl() => /party
 * buildPartyUrl(partyId) => /party/partyId
 * buildPartyUrl(partyId, { appointmentId }) => /party/partyId/appointment/appointmentId
 * ```
 */
export const buildPartyUrl = (partyId, options = {}) => {
  let path = '/party';

  if (!partyId) return path;

  path = `${path}/${partyId}`;

  const { appointmentId, leaseId, threadId, reviewApplication, openMergeParties, isCorporateParty, openMatch, personId, addOrigin } = options;

  path = addAppointmentIdIfNeeded(path, appointmentId);

  path = addLeaseIdIfNeeded(path, { leaseId, personId });

  path = addQueryParams(path, { threadId, reviewApplication, openMergeParties, isCorporateParty, openMatch, personId });

  const { location } = window;
  let { origin } = location;
  origin = origin || `${location.protocol}//${location.host}`;

  return addOrigin ? `${origin}${path}` : path;
};

class LeasingNavigator {
  @observable
  history;

  @computed
  get location() {
    return this.history.location;
  }

  @observable
  wasCommunicationManagementVisited = false;

  constructor(history) {
    this.history = history;
    autorun(() => {
      if (this.location.pathname.match('/cohortComms')) {
        this.wasCommunicationManagementVisited = true;
      }
    });
  }

  navigate = (...args) => push(...args);

  /**
   * Navigates to `/party` generating the proper url based on the provided parameters
   * @param {UUID} [partyId] the partyId. If not provided it will just navigate to `/party` which is the create party url
   * @param {Object} [options] the options
   * @param {UUID} [options.appointmentId] if an appointmentId is provided the path will be modified to contain `/appointment/${appointmentId}`
   * @param {Boolean} [options.openMatch] if true the queryParameter openMatch=true is added to the url. Needs a personId also to be especified
   * @param {UUID} [options.personId] if true the queryParameter personId is added to the url
   * @param {Boolean} [options.reviewApplication] if true the queryParameter reviewApplication=true is added to the url
   * @param {UUID} [options.threadId] if provided the queryParemeter threadId is added to the url
   * @param {UUID} [options.leaseId] if provided the queryParemeter leaseId is added to the url. Needs also a personId to be specified
   * @param {Boolean} [options.openMergeParties] if provided the queryParameter openMergeParties=true is added to the url. Needs also a personId
   * @param {Boolean} [options.useWindowOpen] if true, it will use windowOpen instead of push
   * @param {Boolean} [options.newTab] if true will use windowOpen and target _blank
   * @param {String} [options.target] the target that is passed to windowOpen
   */
  navigateToParty = (partyId, options) => {
    const path = buildPartyUrl(partyId, options);
    options = options || {};
    if (options.useWindowOpen || options.newTab) {
      return windowOpen(path, options.newTab ? '_blank' : options.target);
    }
    return push(path);
  };

  navigateToCommunicationManagement = () => push('/cohortComms');

  /**
   * Navigates to the inventory page identified by the provided inventoryId
   * @param {UUID} inventoryId the Inventory id. Required.
   */
  navigateToInventory = inventoryId => {
    if (!inventoryId) throw new Error('inventoryId is required');
    return push(`/inventory/${inventoryId}`);
  };

  /**
   * Naviates to the search page
   */
  navigateToSearch = () => push('/search');

  /**
   * Navigate to the personPage indentified by the provided personId
   * @param {UUID} personId the id of the person
   * @param {Object} [options] the optional parameters
   * @param {Boolean} [options.openMergePartyDialog] if true the openMergePartyDialog=true query parameter is added to the url. `partyId` becomes required when this is true
   * @param {UUID} [options.partyId] the partyId to be added as queryParameter `partyId=${partyId}`
   */
  navigateToPerson = (personId, options = {}) => {
    if (!personId) throw new Error('personId is required');

    let path = `/leads/${personId}`;

    const queryParts = [];

    const { openMergePartyDialog, partyId } = options;

    if (openMergePartyDialog) {
      queryParts.push('openMergePartyDialog=true');

      if (!partyId) throw new Error('partyId is required when openMergePartyDialog is set');
      queryParts.push(`partyId=${partyId}`);
    }

    if (queryParts.length > 0) {
      path = `${path}?${queryParts.join('&')}`;
    }

    return push(path);
  };

  /**
   * Navigates to the home route (same as dashboard route)
   */
  navigateToHome = () => push('/');

  /**
   * Navigates to the dashboard route (same as home)
   */
  navigateToDashboard = () => push('/');

  /**
   * Navigates to need help
   * @param {Object} options optional parameters
   * @param {String} [options.email] if specified the email will be appended to the url as a pathParameter
   */
  navigateToNeedHelp = ({ email } = {}) => {
    let path = '/needHelp';
    if (email) {
      path = `${path}/${email}`;
    }
    return push(path);
  };

  navigateToSignatureConfirmationWithToken = token => {
    let path = paths.SIGNATURE_CONFIRMATION;
    path = path.replace(':token', token);
    return push(path);
  };

  /**
   * Navigates to tenantAdmin page
   */
  navigateToTenantAdmin = () => push('/tenantAdmin');

  openTenantAdminTab = () => {
    windowOpen('/tenantAdmin', { target: 'newWindow' });
  };

  openLeaseDocumentTab = (token, forReview = true) => {
    const previewSuffix = forReview ? 'Preview' : '';
    const path = `/leases/download${previewSuffix}?token=${token}`;
    windowOpen(path, { target: 'newWindow' });
  };

  navigateToAppSettingsPage = () => push('/applicationSettings');

  navigateToSubscriptionsPage = () => push('/subscriptions');

  /**
   * Navigates to RingCentralTokenRefreshPage
   * @param {Boolean} [useReplace] if true will use the replace method rewriting the current location instead of pushing it to the history stack
   */
  navigateToRingCentralTokenRefreshPage = useReplace => {
    const fn = useReplace ? replace : push;
    return fn('/RingCentralTokenRefreshPage');
  };

  navigateToCronofyAuthorizationPage = url => window.location.replace(url);

  updateLocation = url => (window.location.href = url);
}

export const leasingNavigator = new LeasingNavigator(syncedHistory);

export const isPagePersonDetails = () => !!leasingNavigator.location.pathname.match('/leads/');

export const isCommunicationManagementPage = () => !!leasingNavigator.location.pathname.match('/cohortComms');
