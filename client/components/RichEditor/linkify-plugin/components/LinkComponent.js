/*
 * Copyright (c) 2022 Reva Technology Inc., all rights reserved.
 * Unauthorized copying of this file, via any medium is strictly prohibited
 * Licensed under the Elastic License 2.0; you may not use this file except
 * in compliance with the Elastic License 2.0.
 */

import React from 'react';
import clsx from 'clsx';
import { getUrlFromString } from '../utils';

// The component we render when we encounter a hyperlink in the text
const LinkComponent = props => {
  const {
    decoratedText = '',
    theme = {},
    target = '_self',
    rel = 'noreferrer noopener',
    className,
    component,
    dir, // eslint-disable-line @typescript-eslint/no-unused-vars
    entityKey, // eslint-disable-line @typescript-eslint/no-unused-vars
    getEditorState, // eslint-disable-line @typescript-eslint/no-unused-vars
    offsetKey, // eslint-disable-line @typescript-eslint/no-unused-vars
    setEditorState, // eslint-disable-line @typescript-eslint/no-unused-vars
    contentState, // eslint-disable-line @typescript-eslint/no-unused-vars
    blockKey, // eslint-disable-line @typescript-eslint/no-unused-vars
    start, // eslint-disable-line @typescript-eslint/no-unused-vars
    end, // eslint-disable-line @typescript-eslint/no-unused-vars
    ...otherProps
  } = props;

  const combinedClassName = clsx(theme?.link, className);
  const href = getUrlFromString(decoratedText) || '';

  const linkProps = {
    ...otherProps,
    href,
    target,
    rel,
    className: combinedClassName,
  };

  return component ? (
    React.createElement(component, linkProps)
  ) : (
    // eslint-disable-next-line jsx-a11y/anchor-has-content
    <a {...linkProps} />
  );
};
export default LinkComponent;
