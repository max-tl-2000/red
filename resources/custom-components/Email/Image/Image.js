/*
 * Copyright (c) 2022 Reva Technology Inc., all rights reserved.
 * Unauthorized copying of this file, via any medium is strictly prohibited
 * Licensed under the Elastic License 2.0; you may not use this file except
 * in compliance with the Elastic License 2.0.
 */

import React from 'react';

const Image = ({ alt, src, width, height, style = {} }) => {
  const innerStyle = {};

  if (width !== undefined) {
    innerStyle.width = width;
  }

  if (height !== undefined) {
    innerStyle.height = height;
  }

  return (
    <img
      alt={alt}
      src={src}
      width={width}
      height={height}
      style={{
        display: 'block',
        outline: 'none',
        border: 'none',
        textDecoration: 'none',
        ...innerStyle,
        ...style,
      }}
    />
  );
};

export default Image;
