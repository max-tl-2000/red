/*
 * Copyright (c) 2022 Reva Technology Inc., all rights reserved.
 * Unauthorized copying of this file, via any medium is strictly prohibited
 * Licensed under the Elastic License 2.0; you may not use this file except
 * in compliance with the Elastic License 2.0.
 */

import { observable, computed } from 'mobx';

export default class IconModel {
  @observable
  selectedA = 'close';

  @observable
  selectedB = 'plus';

  @computed
  get selectedIcons() {
    return [this.selectedA, this.selectedB];
  }

  constructor(icons) {
    this.icons = icons.map(icon => ({
      id: icon,
      text: icon,
    }));
  }
}
