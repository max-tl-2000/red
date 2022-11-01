/*
 * Copyright (c) 2022 Reva Technology Inc., all rights reserved.
 * Unauthorized copying of this file, via any medium is strictly prohibited
 * Licensed under the Elastic License 2.0; you may not use this file except
 * in compliance with the Elastic License 2.0.
 */

const setExpiration = cookieLife => {
  const today = new Date();
  const expr = new Date(today.getTime() + cookieLife * 24 * 60 * 60 * 1000);
  return expr.toUTCString();
};

export const setCookie = (name, value, { expires, path, domain, secure }) => {
  let cookieStr = `${name}=${escape(value)};`;
  if (expires) {
    expires = setExpiration(expires);
    cookieStr = `${cookieStr} expires=${expires};`;
  }
  if (path) {
    cookieStr = `${cookieStr} path=${path};`;
  }
  if (domain) {
    cookieStr = `${cookieStr} domain=${domain};`;
  }
  if (secure) {
    cookieStr = `${cookieStr} secure=${secure};`;
  }

  document.cookie = cookieStr;
};
