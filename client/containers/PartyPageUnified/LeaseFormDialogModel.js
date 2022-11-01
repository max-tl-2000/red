/*
 * Copyright (c) 2022 Reva Technology Inc., all rights reserved.
 * Unauthorized copying of this file, via any medium is strictly prohibited
 * Licensed under the Elastic License 2.0; you may not use this file except
 * in compliance with the Elastic License 2.0.
 */

import { observable, action } from 'mobx';
import DialogModel from './DialogModel';

export default class LeaseFormDialogModel extends DialogModel {
  @observable
  selectedLeaseId;

  @action
  setSelectedLeaseIdAndOpen = selectedLeaseId => {
    if (!selectedLeaseId) {
      throw new Error('selectedLeaseId parameter is required');
    }
    this.selectedLeaseId = selectedLeaseId;
    this.open();
  };

  @action
  clearSelectedLeaseAndClose = () => {
    this.selectedLeaseId = null;
    this.close();
  };
}
