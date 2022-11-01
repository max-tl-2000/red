/*
 * Copyright (c) 2022 Reva Technology Inc., all rights reserved.
 * Unauthorized copying of this file, via any medium is strictly prohibited
 * Licensed under the Elastic License 2.0; you may not use this file except
 * in compliance with the Elastic License 2.0.
 */

import React from 'react';
import { Email, Item, Box, Image, injectReactEmailAttributes, configStyleValidator } from 'react-html-email';

injectReactEmailAttributes();
configStyleValidator({
  // When strict, incompatible style properties will result in an error.
  strict: true,
  // Whether to warn when compatibility notes for a style property exist.
  warn: true,
  // Platforms to consider for compatibility checks.
  platforms: ['gmail', 'gmail-android', 'apple-mail', 'apple-ios', 'yahoo-mail', 'outlook', 'outlook-legacy', 'outlook-web'],
});

const CustomBox = ({ style, ...props }) => {
  // for some weird reason tables have `float: left`
  // in some email clients by default.
  const baseStyle = { float: 'none' };
  const theStyle = { ...style, ...baseStyle };
  return <Box {...props} style={theStyle} />;
};

export { Email, Item, CustomBox as Box, Image };
