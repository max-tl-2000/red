/*
 * Copyright (c) 2022 Reva Technology Inc., all rights reserved.
 * Unauthorized copying of this file, via any medium is strictly prohibited
 * Licensed under the Elastic License 2.0; you may not use this file except
 * in compliance with the Elastic License 2.0.
 */

import extend from 'extend';
import trim from './trim';
import typeOf from './type-of';

export default function ellipsis(text, options) {
  const opts = {
    char: '…',
    maxLength: 30,
  };

  if (typeOf(options) === 'number') {
    options = { // eslint-disable-line
      maxLength: options, // use the provied number as the maxLength
    };
  }

  text = trim(text); // eslint-disable-line

  if (!text) {
    return '';
  }

  extend(opts, options);

  if (text.length <= opts.maxLength) {
    return text;
  }

  const candidate = trim(text.substr(0, opts.maxLength - 1));

  return candidate + opts.char;
}
