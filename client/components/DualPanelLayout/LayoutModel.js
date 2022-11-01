/*
 * Copyright (c) 2022 Reva Technology Inc., all rights reserved.
 * Unauthorized copying of this file, via any medium is strictly prohibited
 * Licensed under the Elastic License 2.0; you may not use this file except
 * in compliance with the Elastic License 2.0.
 */

import { observable, computed, action } from 'mobx';

export default class LayoutModel {
  @observable
  _breakpoint = 'normal';

  @observable
  _rightColumnVisible = false;

  @action
  updateBreakpoint = ({ breakpoint }) => {
    this._breakpoint = breakpoint;
    if (this._breakpoint === 'normal') {
      this.closeRightPanel();
    }
  };

  @computed
  get rightColumnIsVisible() {
    return this._breakpoint === 'normal' || this._rightColumnVisible;
  }

  @computed
  get leftColumnProps() {
    return this.compact
      ? {
          columns: 12,
          totalColumns: 12,
          gutterWidth: 0,
          last: true,
        }
      : {
          columns: 8,
          totalColumns: 12,
          gutterWidth: 0,
        };
  }

  @computed
  get rightColumnProps() {
    return this.compact
      ? {
          width: '400px',
          floating: this.compact,
        }
      : {
          columns: 4,
          totalColumns: 12,
          gutterWidth: 0,
        };
  }

  @computed
  get compact() {
    return this._breakpoint === 'compact';
  }

  @action
  toggleRightPanel = () => {
    if (!this._rightColumnVisible) {
      this.openRightPanel();
    } else {
      this.closeRightPanel();
    }
  };

  @action
  openRightPanel = () => {
    this._rightColumnVisible = true;
  };

  @action
  closeRightPanel = () => {
    this._rightColumnVisible = false;
  };
}
