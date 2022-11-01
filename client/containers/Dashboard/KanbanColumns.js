/*
 * Copyright (c) 2022 Reva Technology Inc., all rights reserved.
 * Unauthorized copying of this file, via any medium is strictly prohibited
 * Licensed under the Elastic License 2.0; you may not use this file except
 * in compliance with the Elastic License 2.0.
 */

import React from 'react';
import { getScreenSize, sizes } from 'helpers/layout';

export const KanbanColumn = ({ id, title, children }) => (
  <div id={id} key={id} data-type="swimlane" className="swimlane">
    <div className="swimlane-title">{title}</div>
    <div className="swimlane-content">{children}</div>
  </div>
);

export const columnsPerScreen = () => {
  const screenSize = getScreenSize();

  switch (screenSize) {
    case sizes.xlarge:
    case sizes.large:
      return 4;
    case sizes.medium:
      return 3;
    case sizes.small1:
    case sizes.small2:
      return 2;
    case sizes.xsmall1:
    case sizes.xsmall2:
      return 1;
    default:
      return 1;
  }
};
