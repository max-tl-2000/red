/*
 * Copyright (c) 2022 Reva Technology Inc., all rights reserved.
 * Unauthorized copying of this file, via any medium is strictly prohibited
 * Licensed under the Elastic License 2.0; you may not use this file except
 * in compliance with the Elastic License 2.0.
 */

import $ from 'jquery';

function check(doc) {
  let className = '';

  const flex = 'flex';
  const webkitFlex = `-webkit-${flex}`;
  const ele = doc.createElement('b');
  const noFlex = `no-${flex}`;

  try {
    const style = ele.style;
    // this is to detect which property is supported
    style.display = webkitFlex;
    style.display = flex;
    className += style.display === flex || style.display === webkitFlex ? flex : noFlex;
  } catch (err) {
    className += noFlex;
  }

  $('html').addClass(className);
}

check(document);
