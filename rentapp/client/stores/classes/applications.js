/*
 * Copyright (c) 2022 Reva Technology Inc., all rights reserved.
 * Unauthorized copying of this file, via any medium is strictly prohibited
 * Licensed under the Elastic License 2.0; you may not use this file except
 * in compliance with the Elastic License 2.0.
 */

import { observable, computed, action, ObservableMap } from 'mobx';
import { logger } from 'client/logger';
import { now, toMoment } from '../../../../common/helpers/moment-utils';
import { isApplicationPaid } from '../../../../common/helpers/applicants-utils';
import { redirectToUrl } from '../../helpers/utils';
import { getValidatedApplicationUrl, getValidatedLoginUrl } from '../../../common/helpers/resolve-url';

export class Applications {
  @observable
  error;

  @observable
  lastApplicationsMap;

  @observable
  olderApplicationsMap;

  @observable
  applicantName;

  @observable
  loaded;

  @observable
  redirectTo;

  constructor({ apiClient }) {
    this.apiClient = apiClient;
    this.lastApplicationsMap = new ObservableMap();
    this.olderApplicationsMap = new ObservableMap();
    this.applications = [];
    this.applicantName = {};
    this.loaded = false;
  }

  @action
  async fetchApplications() {
    if (this.lastApplicationsMap.size) return;
    try {
      this.error = '';
      logger.debug('Fetching applications');
      const response = await this.apiClient.get('/applications');
      logger.debug({ applications: response }, 'Got applications');
      this.loaded = true;
      this.fillItems(response);
    } catch (err) {
      this._handleError(err);
    }
  }

  @action
  _handleError(err) {
    this.error = err.token || err.message;
    console.error('error fetching applications', err);
  }

  @action
  async fillItems(applications) {
    if (applications && applications.length) {
      this.applications = applications;
      this.applicantName = applications[0].applicantName;
      applications.forEach(app =>
        now().diff(toMoment(app.lastUpdated), 'd') > 30 ? this.olderApplicationsMap.set(app.id, app) : this.lastApplicationsMap.set(app.id, app),
      );
    }
  }

  @action
  getApplicationUrl(application, isUserAuthenticated, isRedirection) {
    this.redirectTo = getValidatedApplicationUrl(isUserAuthenticated, application);
    return isApplicationPaid(application) && !isUserAuthenticated ? getValidatedLoginUrl(isRedirection) : this.redirectTo;
  }

  handleRedirection(isUserAuthenticated) {
    const isRedirection = true;
    const paidApp = this.applications.filter(application => isApplicationPaid(application));
    const url = this.getApplicationUrl(paidApp[0] || this.applications[0], isUserAuthenticated, isRedirection);
    return !isUserAuthenticated && redirectToUrl(url);
  }

  @computed
  get previousUrl() {
    return this.redirectTo;
  }

  @computed
  get lastApplications() {
    return this.lastApplicationsMap.values();
  }

  @computed
  get hasMultiplesApplications() {
    return this.applications.length > 1;
  }

  @computed
  get olderApplications() {
    return this.olderApplicationsMap.values();
  }
}
