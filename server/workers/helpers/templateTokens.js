/*
 * Copyright (c) 2022 Reva Technology Inc., all rights reserved.
 * Unauthorized copying of this file, via any medium is strictly prohibited
 * Licensed under the Elastic License 2.0; you may not use this file except
 * in compliance with the Elastic License 2.0.
 */

const TOKENS_MATCHER_REGEX = /\[\[(.*?)\]\]/g;

export const getTokensFromTemplate = ({ subject, body }) => {
  const templateTokensInSubject = subject.match(TOKENS_MATCHER_REGEX) || [];
  const templateTokensInBody = body.match(TOKENS_MATCHER_REGEX) || [];

  return Array.from(new Set([...templateTokensInSubject, ...templateTokensInBody]));
};
