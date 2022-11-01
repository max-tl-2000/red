/*
 * Copyright (c) 2022 Reva Technology Inc., all rights reserved.
 * Unauthorized copying of this file, via any medium is strictly prohibited
 * Licensed under the Elastic License 2.0; you may not use this file except
 * in compliance with the Elastic License 2.0.
 */

import React, { Component } from 'react';
import Icon from 'components/Icon/Icon';

export default class KanbanNavigator extends Component {
  render() {
    if (this.props.show) {
      return (
        <div className="kanbanNavigator" ref="navigator">
          <div className="navigatorLeft no-select" onClick={this.props.onLeft}>
            <Icon id="chevronLeftIcon" name="chevron-left" />
          </div>
          <div className="navigatorRight no-select" onClick={this.props.onRight}>
            <Icon id="chevronRightIcon" name="chevron-right" />
          </div>
        </div>
      );
    }
    return null;
  }
}
