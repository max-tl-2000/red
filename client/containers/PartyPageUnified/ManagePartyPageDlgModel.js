/*
 * Copyright (c) 2022 Reva Technology Inc., all rights reserved.
 * Unauthorized copying of this file, via any medium is strictly prohibited
 * Licensed under the Elastic License 2.0; you may not use this file except
 * in compliance with the Elastic License 2.0.
 */

import { observable, computed, action } from 'mobx';
import DialogModel from './DialogModel';

export default class ManagePartyPageDlgModel extends DialogModel {
  @observable.shallow
  _memberToOpen;

  @computed
  get memberToOpen() {
    return this._memberToOpen;
  }

  @action
  setMemberToOpen(memberToOpen) {
    this._memberToOpen = memberToOpen;
  }
}
