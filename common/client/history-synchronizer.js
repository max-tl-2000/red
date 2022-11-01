/*
 * Copyright (c) 2022 Reva Technology Inc., all rights reserved.
 * Unauthorized copying of this file, via any medium is strictly prohibited
 * Licensed under the Elastic License 2.0; you may not use this file except
 * in compliance with the Elastic License 2.0.
 */

import { observable, action } from 'mobx';
import { browserHistory } from 'react-router';

/**
 * @desc module to keep track of the current app url location
 */
export default class HistorySynchronizer {
  @observable.shallow
  location;

  /**
   * @desc synchronize the location object
   */
  @action
  updateLocation = loc => {
    this.location = loc;
  };

  /**
   * @desc stop listening to url changes
   */
  @action
  stop = () => {
    const { unlisten } = this;
    unlisten && unlisten();
  };

  /**
   * @desc start keeping the current location up to date
   * in this module when the URL changes. This later can be
   * consumed by other React components
   */
  @action
  start = () => {
    this.location = browserHistory.location;
    this.unlisten = browserHistory.listen(this.updateLocation);
  };
}
