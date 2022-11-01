/*
 * Copyright (c) 2022 Reva Technology Inc., all rights reserved.
 * Unauthorized copying of this file, via any medium is strictly prohibited
 * Licensed under the Elastic License 2.0; you may not use this file except
 * in compliance with the Elastic License 2.0.
 */

import $ from 'jquery';

function getScrollbarWidth() {
  const e = document.createElement('div');

  e.style.position = 'absolute';
  e.style.top = '-9999px';
  e.style.width = '100px';
  e.style.height = '100px';
  e.style.overflow = 'scroll';
  e.style.msOverflowStyle = 'scrollbar';

  document.body.appendChild(e);

  const sw = e.offsetWidth - e.clientWidth;

  document.body.removeChild(e);

  return sw;
}

function check(win) {
  const userAgent = win.navigator.userAgent.toLowerCase();
  const isChrome = userAgent.indexOf('chrome/') > -1;
  const isMac = userAgent.indexOf('macintosh') > -1;

  const isChromeAndMac = isChrome && isMac;
  const $html = $('html');

  if (isChromeAndMac) {
    const scrollbarWidth = getScrollbarWidth();
    if (scrollbarWidth === 0) {
      // probably user choose to show scrollbars as "automatic based on trackpad" or "show only on scroll"
      $html.addClass('scrollbar-no-width');
    }
  }

  $html.toggleClass('gemini-fix-required', isChromeAndMac);
}

check(window);
