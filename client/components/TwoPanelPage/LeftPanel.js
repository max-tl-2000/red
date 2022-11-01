/*
 * Copyright (c) 2022 Reva Technology Inc., all rights reserved.
 * Unauthorized copying of this file, via any medium is strictly prohibited
 * Licensed under the Elastic License 2.0; you may not use this file except
 * in compliance with the Elastic License 2.0.
 */

import React from 'react';
import elevationShadow from 'helpers/elevationShadow';
import { cf, g } from './TwoPanelPage.scss';
import GeminiScrollbar from '../GeminiScrollbar/GeminiScrollbar';

export default function LeftPanel({ className, contentClassName, children, noOverflow, renderGeminiScrollbar, padContent, paddedScrollable, ...props }) {
  if (renderGeminiScrollbar) {
    const overlayStyle = {
      boxShadow: elevationShadow(4),
    };
    return (
      <GeminiScrollbar
        data-id="leftPanel"
        data-layout="left-panel"
        noOverflow={noOverflow}
        useExtraBottomPadding={paddedScrollable}
        style={overlayStyle}
        className={cf('left-panel', g(className))}
        {...props}>
        <div className={cf('pagePanel', g(contentClassName), { padContent })}>{children}</div>
      </GeminiScrollbar>
    );
  }

  return (
    <div data-layout="left-panel" className={cf('left-panel', g(className))} {...props}>
      <div className={cf('pagePanel', g(contentClassName, { 'padded-scrollable': paddedScrollable }), { padContent })}>{children}</div>
    </div>
  );
}
