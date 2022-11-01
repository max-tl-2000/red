/*
 * Copyright (c) 2022 Reva Technology Inc., all rights reserved.
 * Unauthorized copying of this file, via any medium is strictly prohibited
 * Licensed under the Elastic License 2.0; you may not use this file except
 * in compliance with the Elastic License 2.0.
 */

import { observable, action } from 'mobx';
import { AdditionalInfoTypes } from 'enums/partyTypes';

export class InsuranceChoice {
  @observable
  defaultInsuranceSelected;

  @observable
  id;

  constructor({ apiClient, partyId }) {
    this.type = AdditionalInfoTypes.INSURANCE_CHOICE;
    this.apiClient = apiClient;
    this.partyId = partyId;
  }

  @action
  async loadInsuranceChoice() {
    const additionalInfoArray = await this.apiClient.get(`/parties/${this.partyId}/additionalInfo`, { params: { type: this.type } });
    if (additionalInfoArray.length === 1) {
      const [insuranceChoiceObject] = additionalInfoArray;
      this.defaultInsuranceSelected = insuranceChoiceObject.info.defaultInsuranceSelected;
      this.id = insuranceChoiceObject.id;
    }
  }

  @action
  async setInsuranceChoice(defaultInsuranceSelected) {
    this.defaultInsuranceSelected = defaultInsuranceSelected;
    await this.submitInsurance();
  }

  @action
  async submitInsurance() {
    try {
      this.additionalDataError = '';

      const partyAdditionalInfo = {
        id: this.id,
        partyId: this.partyId,
        type: this.type,
        info: { defaultInsuranceSelected: this.defaultInsuranceSelected },
      };

      if (this.id) {
        await this.apiClient.patch(`/parties/${this.partyId}/additionalInfo/${this.id}`, { data: partyAdditionalInfo });
      } else {
        const resp = await this.apiClient.post(`/parties/${this.partyId}/additionalInfo`, { data: partyAdditionalInfo });
        this.id = resp.id;
      }
    } catch (err) {
      this.handleError(err);
    }
  }

  @action
  handleError(err) {
    this.additionalDataError = err.token || err.message;
  }
}
