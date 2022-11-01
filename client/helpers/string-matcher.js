/*
 * Copyright (c) 2022 Reva Technology Inc., all rights reserved.
 * Unauthorized copying of this file, via any medium is strictly prohibited
 * Licensed under the Elastic License 2.0; you may not use this file except
 * in compliance with the Elastic License 2.0.
 */

import React from 'react';
import Caption from 'components/Typography/Caption';
import trim from 'helpers/trim';

export const renderStringWithMatch = ({ value, className, bold, inline, ellipsis, searchQueryValue, id, TagElement = Caption }) => {
  value = trim(value);
  searchQueryValue = trim(searchQueryValue);

  if (value.toLowerCase().includes(searchQueryValue.toLowerCase())) {
    const startHighlightIndex = value.toLowerCase().indexOf(searchQueryValue.toLowerCase());
    const endHighlightIndex = startHighlightIndex + searchQueryValue.length;

    return (
      <TagElement className={className} bold={bold} inline={inline} ellipsis={ellipsis} key={id}>
        {value.slice(0, startHighlightIndex)}
        <TagElement bold inline highlight>
          {value.slice(startHighlightIndex, endHighlightIndex)}
        </TagElement>
        {value.slice(endHighlightIndex, value.length)}
      </TagElement>
    );
  }
  return (
    <TagElement className={className} bold={bold} inline={inline} ellipsis={ellipsis} key={id}>
      {value}
    </TagElement>
  );
};
