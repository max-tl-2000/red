/*
 * Copyright (c) 2022 Reva Technology Inc., all rights reserved.
 * Unauthorized copying of this file, via any medium is strictly prohibited
 * Licensed under the Elastic License 2.0; you may not use this file except
 * in compliance with the Elastic License 2.0.
 */

import { extractLinks } from './utils';

// Gets all the links in the text, and returns them via the callback
const linkStrategy = (contentBlock, callback) => {
  const links = extractLinks(contentBlock.getText());
  if (links) {
    for (const link of links) {
      callback(link.index, link.lastIndex);
    }
  }
};

export default linkStrategy;
