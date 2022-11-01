/*
 * Copyright (c) 2022 Reva Technology Inc., all rights reserved.
 * Unauthorized copying of this file, via any medium is strictly prohibited
 * Licensed under the Elastic License 2.0; you may not use this file except
 * in compliance with the Elastic License 2.0.
 */

import { observable, computed, action } from 'mobx';

export default class RightPanelModel {
  @observable
  commsListVisible = true; // first panel is open by default

  communicationsIcon = 'communication-panel';

  inventoryIcon = 'inventory-panel';

  @computed
  get iconForToggleState() {
    return this.commsListVisible ? this.inventoryIcon : this.communicationsIcon;
  }

  @action
  togglePanel = () => {
    this.commsListVisible = !this.commsListVisible;
  };

  @action
  showInventory = () => {
    this.commsListVisible = false;
  };

  @action
  showCommunications = () => {
    this.commsListVisible = true;
  };

  @computed
  get isCommListVisible() {
    return this.commsListVisible;
  }
}
