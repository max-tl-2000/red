/*
 * Copyright (c) 2022 Reva Technology Inc., all rights reserved.
 * Unauthorized copying of this file, via any medium is strictly prohibited
 * Licensed under the Elastic License 2.0; you may not use this file except
 * in compliance with the Elastic License 2.0.
 */

import { observable, action, computed, extendObservable, toJS, reaction } from 'mobx';
import Request from '../../../../common/client/request';
import { ApplicationSections, ApplicationSettingsValues, SharedSections, ApplicationSettingsTypes } from '../../../../common/enums/applicationTypes';

export class ApplicationSettings {
  @observable
  _settings = {};

  @observable
  _additionalData = {};

  @observable
  _applicationData = {};

  @computed
  get settings() {
    return this._settings.response || {};
  }

  @computed
  get skipSections() {
    return this._additionalData.skipSection || {};
  }

  @computed
  get skipPartySections() {
    return this._applicationData.skipSection || {};
  }

  @computed
  get finishButtonWasClicked() {
    return !!this._additionalData.finishButtonWasClicked;
  }

  getSetting = field => (this.settings && this.settings[field]) || ApplicationSettingsValues.OPTIONAL;

  constructor({ apiClient }) {
    this._settings = Request.create({
      call: (propertyId, partyType, memberType) => apiClient.get(`/applicationSettings/${propertyId}/partyType/${partyType}/memberType/${memberType}`),
    });

    this._getAdditionalData = Request.create({
      call: () => apiClient.get('/personApplications/current/additionalData'),
      onResponse: args => {
        if (args.response?.additionalData) {
          args.response = args.response.additionalData;
        }
      },
    });

    this._storeAdditionalData = Request.create({
      call: data => apiClient.patch('/personApplications/current/additionalData', { data }),
      onResponse: args => {
        if (args.response?.additionalData) {
          args.response = args.response.additionalData;
        }
      },
    });

    this._getApplicationData = Request.create({
      call: () => apiClient.get('/partyApplication/current/applicationData'),
      onResponse: args => {
        if (args.response?.applicationData) {
          args.response = args.response.applicationData;
        }
      },
    });

    this._storeApplicationData = Request.create({
      call: data => apiClient.patch('/partyApplication/current/applicationData', { data }),
      onResponse: args => {
        if (args.response?.applicationData) {
          args.response = args.response.applicationData;
        }
      },
    });

    // dynamically create getters for each one of the settings in `ApplicationSettings`
    // this is done this way to avoid having to manually create @computed getters per each setting
    const getters = Object.values({ ...ApplicationSections, ...ApplicationSettingsTypes }).reduce((acc, field) => {
      Object.defineProperty(acc, field, { get: () => this.getSetting(field), enumerable: true });
      return acc;
    }, {});

    extendObservable(this, getters);

    const skipFields = Object.values(ApplicationSections).reduce((acc, field) => {
      const key = `skip${field[0].toUpperCase()}${field.substring(1)}`;
      Object.defineProperty(acc, key, {
        get: () => {
          if (SharedSections.indexOf(field) > -1) return this.skipPartySections[key] || false;
          return this.skipSections[key] || false;
        },
        set: value => {
          if (SharedSections.indexOf(field) > -1) this._applicationData[`${key}`] = value;
          else this._additionalData[`${key}`] = value;
        },
        enumerable: true,
      });
      return acc;
    }, {});

    extendObservable(this, skipFields);

    const assignAdditionalData = response => {
      this._additionalData = toJS(response);
    };
    reaction(() => this._getAdditionalData.response, assignAdditionalData);
    reaction(() => this._storeAdditionalData.response, assignAdditionalData);

    const assignApplicationData = response => {
      this._applicationData = toJS(response);
    };
    reaction(() => this._getApplicationData.response, assignApplicationData);
    reaction(() => this._storeApplicationData.response, assignApplicationData);
  }

  @action
  async fetchApplicationSettings(propertyId, partyType, memberType) {
    this._settings.execCall(propertyId, partyType, memberType);
  }

  @action
  async fetchAdditionalData() {
    this._getAdditionalData.execCall();
  }

  @action
  async fetchApplicationlData() {
    this._getApplicationData.execCall();
  }

  @action
  async storeSkipSection(section, value) {
    const keyName = `skip${section[0].toUpperCase()}${section.substring(1)}`;
    this[`${keyName}`] = value;
    const newSkipSection = {
      ...toJS(SharedSections.indexOf(section) > -1 ? this.skipPartySections : this.skipSections),
      [keyName]: value,
    };
    if (SharedSections.indexOf(section) > -1) this._storeApplicationData.execCall({ applicationData: { skipSection: newSkipSection } });
    else this._storeAdditionalData.execCall({ additionalData: { skipSection: newSkipSection } });
  }

  @action
  async storeFinishButtonAction() {
    this._storeAdditionalData.execCall({ additionalData: { finishButtonWasClicked: true } });
  }
}
