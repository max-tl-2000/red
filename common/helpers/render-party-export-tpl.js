/*
 * Copyright (c) 2022 Reva Technology Inc., all rights reserved.
 * Unauthorized copying of this file, via any medium is strictly prohibited
 * Licensed under the Elastic License 2.0; you may not use this file except
 * in compliance with the Elastic License 2.0.
 */

import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';

const renderStyles = styles => styles.join('');

export const convertReactComponentToHtml = (Component, props) =>
  `<!doctype html>
    <html lang="en">
      <head>
        <style>
          ${renderStyles(Component.styles)}
        </style>
      </head>
      <body style="margin: 10px; padding: 0; fontFamily: Roboto,sans-serif;">
        ${renderToStaticMarkup(<Component {...props} />)}
      </body>
    </html>`;
