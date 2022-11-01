/*
 * Copyright (c) 2022 Reva Technology Inc., all rights reserved.
 * Unauthorized copying of this file, via any medium is strictly prohibited
 * Licensed under the Elastic License 2.0; you may not use this file except
 * in compliance with the Elastic License 2.0.
 */

import React from 'react';

import linkStrategy from './linkStrategy';
import LinkComponent from './components/LinkComponent';

import { cf } from './theme.scss';
import onChangeLinkifyEvent from './events/onChange';

/*
This linkify plugin comes from https://github.com/draft-js-plugins/draft-js-plugins is the v4.0
and also this plugin has some modifications:
- Add new onChange event to add the LINK draft.js entity for the linkify links
- Fix some issue with typescript types
*/
const createLinkifyPlugin = (config = {}) => {
  // Styles are overwritten instead of merged as merging causes a lot of confusion.

  // Why? Because when merging a developer needs to know all of the underlying
  // styles which needs a deep dive into the code. Merging also makes it prone to
  // errors when upgrading as basically every styling change would become a major
  // breaking change. 1px of an increased padding can break a whole layout.

  const { component, theme = cf('link'), target = '_self', rel = 'noreferrer noopener' } = config;

  const DecoratedLink = props => <LinkComponent {...props} theme={theme} target={target} rel={rel} component={component} />;

  return {
    decorators: [
      {
        strategy: linkStrategy,
        component: DecoratedLink,
      },
    ],
    onChange: onChangeLinkifyEvent,
  };
};

export default createLinkifyPlugin;
