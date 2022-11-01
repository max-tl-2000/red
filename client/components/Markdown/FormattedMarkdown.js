/*
 * Copyright (c) 2022 Reva Technology Inc., all rights reserved.
 * Unauthorized copying of this file, via any medium is strictly prohibited
 * Licensed under the Elastic License 2.0; you may not use this file except
 * in compliance with the Elastic License 2.0.
 */

import React from 'react';
import Markdown from './Markdown';
import { cf, g } from './FormattedMarkdown.scss';

const FormattedMarkdown = ({ className, simpleLineBreaks = false, inline, noHeaders, leftAlign, ...receivedProps }) => {
  const props = {
    className: cf('markdown', { leftAlign }, g(className)),
    ...receivedProps,
  };

  return <Markdown simpleLineBreaks={simpleLineBreaks} noHeaders inline={inline} {...props} />;
};

export default FormattedMarkdown;
