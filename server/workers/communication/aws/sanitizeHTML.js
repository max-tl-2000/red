/*
 * Copyright (c) 2022 Reva Technology Inc., all rights reserved.
 * Unauthorized copying of this file, via any medium is strictly prohibited
 * Licensed under the Elastic License 2.0; you may not use this file except
 * in compliance with the Elastic License 2.0.
 */

import sanitizeHtml from 'sanitize-html';

export const sanitize = (html, textFilter, allowedTags = ['img', 'font', 'span']) =>
  sanitizeHtml(html || '', {
    allowedTags: sanitizeHtml.defaults.allowedTags.concat(allowedTags),
    allowedAttributes: {
      ...sanitizeHtml.defaults.allowedAttributes,
      img: ['src'],
      '*': ['href', 'align', 'src', 'alt', 'center', 'bgcolor', 'style', 'size', 'color'],
    },
    allowedSchemesByTag: {
      img: ['data', 'http', 'https'],
    },
    textFilter,
  });
