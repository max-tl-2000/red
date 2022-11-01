/*
 * Copyright (c) 2022 Reva Technology Inc., all rights reserved.
 * Unauthorized copying of this file, via any medium is strictly prohibited
 * Licensed under the Elastic License 2.0; you may not use this file except
 * in compliance with the Elastic License 2.0.
 */

import React from 'react';
import marked from 'marked';
import reduceLeftPad from 'helpers/reduceLeftPad';
import clsc from 'helpers/coalescy';

const Markdown = ({ children, inline, gfm = true, simpleLineBreaks, noHeaders, breaks = true, ...rest }) => {
  const text = reduceLeftPad(children);
  let renderer;
  if (noHeaders) {
    renderer = new marked.Renderer();
    renderer.heading = heading => `<p>${heading}</p>`;
  }
  const html = marked(text, {
    gfm,
    breaks: clsc(simpleLineBreaks, breaks),
    renderer,
  });

  return inline ? (
    <span data-component="markdown" {...rest} dangerouslySetInnerHTML={{ __html: html }} />
  ) : (
    <div data-component="markdown" {...rest} dangerouslySetInnerHTML={{ __html: html }} />
  );
};

export default Markdown;
