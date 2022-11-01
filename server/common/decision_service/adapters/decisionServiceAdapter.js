/*
 * Copyright (c) 2022 Reva Technology Inc., all rights reserved.
 * Unauthorized copying of this file, via any medium is strictly prohibited
 * Licensed under the Elastic License 2.0; you may not use this file except
 * in compliance with the Elastic License 2.0.
 */

export default class DecisionServiceAdapter {
  constructor(adapter) {
    this.adapter = adapter;
  }

  getActions(event) {
    return this.adapter.getActions(event);
  }
}
