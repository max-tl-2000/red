/*
 * Copyright (c) 2022 Reva Technology Inc., all rights reserved.
 * Unauthorized copying of this file, via any medium is strictly prohibited
 * Licensed under the Elastic License 2.0; you may not use this file except
 * in compliance with the Elastic License 2.0.
 */

import React, { Component } from 'react';
import { cf, g } from './TwoPanelPage.scss';
import GeminiScrollbar from '../GeminiScrollbar/GeminiScrollbar';

export default class RightPanel extends Component { // eslint-disable-line

  render() {
    const { className, children, renderGeminiScrollbar, padContent, paddedScrollable, ...props } = this.props;
    if (renderGeminiScrollbar) {
      return (
        <GeminiScrollbar
          data-id="rightPanel"
          data-layout="right-panel"
          useExtraBottomPadding={paddedScrollable}
          className={cf('right-panel', g(className))}
          {...props}>
          <div className={cf('pagePanel', { padContent })}>{children}</div>
        </GeminiScrollbar>
      );
    }

    return (
      <div data-layout="right-panel" className={cf('right-panel', g(className))} {...props}>
        <div className={cf('pagePanel', g({ 'padded-scrollable': paddedScrollable }), { padContent })}>{children}</div>
      </div>
    );
  }
}
