/*
 * Copyright (c) 2022 Reva Technology Inc., all rights reserved.
 * Unauthorized copying of this file, via any medium is strictly prohibited
 * Licensed under the Elastic License 2.0; you may not use this file except
 * in compliance with the Elastic License 2.0.
 */

export const widthInColumns = (columns = 12, { gutterWidth = 24, totalColumns = 12, gutterType = 'after', last } = {}) => {
  if (gutterWidth === 0) {
    return { width: `calc(${(columns / totalColumns) * 100}%)` };
  }

  if (gutterType === 'split') {
    return {
      width: `calc(${(columns / totalColumns) * 100}% - ${gutterWidth}px)`,
      margin: `0 ${gutterWidth / 2}px`,
    };
  }

  if (gutterType === 'after') {
    const style = {
      width: `calc(${(columns / totalColumns) * 100}% + ${columns * (gutterWidth / totalColumns)}px - ${gutterWidth}px`,
      marginRight: `${gutterWidth}px`,
    };

    if (last) {
      style.marginRight = 0;
    }
    return style;
  }
  throw new Error('Unknown gutterType. Possible values are: `split` or `after`');
};
