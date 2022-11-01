/*
 * Copyright (c) 2022 Reva Technology Inc., all rights reserved.
 * Unauthorized copying of this file, via any medium is strictly prohibited
 * Licensed under the Elastic License 2.0; you may not use this file except
 * in compliance with the Elastic License 2.0.
 */

import linkifyIt from 'linkify-it';
import tlds from 'tlds';

export const linkify = linkifyIt();
linkify.tlds(tlds);

export const extractLinks = text => linkify.match(text);

export const getUrlFromString = text => {
  const matchLinksList = extractLinks(text);
  return matchLinksList?.[0]?.url;
};

export const isURL = text => !!extractLinks(text);
