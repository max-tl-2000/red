/*
 * Copyright (c) 2022 Reva Technology Inc., all rights reserved.
 * Unauthorized copying of this file, via any medium is strictly prohibited
 * Licensed under the Elastic License 2.0; you may not use this file except
 * in compliance with the Elastic License 2.0.
 */

import { observable, computed, action } from 'mobx';

class ApplicationStepperState {
  APPLICANT_DETAILS_STEP = 0;

  PAYMENT_STEP = 1;

  @observable
  selectedIndex = 0;

  @observable
  prevSelectedIndex = 0;

  @computed
  get isPaymentStep() {
    const { selectedIndex, PAYMENT_STEP } = this;
    return selectedIndex === PAYMENT_STEP;
  }

  @computed
  get isApplicantDetailsStep() {
    const { selectedIndex, APPLICANT_DETAILS_STEP } = this;
    return selectedIndex === APPLICANT_DETAILS_STEP;
  }

  @computed
  get movedToPaymentStep() {
    const { prevSelectedIndex, APPLICANT_DETAILS_STEP, selectedIndex, PAYMENT_STEP } = this;
    return prevSelectedIndex === APPLICANT_DETAILS_STEP && selectedIndex === PAYMENT_STEP;
  }

  @action
  updateSelectedIndex(newIndex) {
    if (this.selectedIndex === newIndex) return;
    this.prevSelectedIndex = this.selectedIndex;
    this.selectedIndex = newIndex;
  }

  @action
  reset() {
    this.prevSelectedIndex = 0;
    this.selectedIndex = 0;
  }
}

export const appStepperState = new ApplicationStepperState();
