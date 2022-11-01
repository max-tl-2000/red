/*
 * Copyright (c) 2022 Reva Technology Inc., all rights reserved.
 * Unauthorized copying of this file, via any medium is strictly prohibited
 * Licensed under the Elastic License 2.0; you may not use this file except
 * in compliance with the Elastic License 2.0.
 */

import ProfileModel from '../../models/profile';

export class Profile {
  constructor({ apiClient }) {
    this.apiClient = apiClient;
  }

  async saveProfile(userId, profile) {
    return await this.apiClient.patch(`/profiles/${userId}`, profile);
  }

  get ProfileModel() {
    if (!this._ProfileModel) {
      this._ProfileModel = new ProfileModel(this);
    }
    return this._ProfileModel;
  }

  async fetchProfile(userId) {
    return await this.apiClient.get(`/profiles/${userId}`);
  }
}
