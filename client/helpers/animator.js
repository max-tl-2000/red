/*
 * Copyright (c) 2022 Reva Technology Inc., all rights reserved.
 * Unauthorized copying of this file, via any medium is strictly prohibited
 * Licensed under the Elastic License 2.0; you may not use this file except
 * in compliance with the Elastic License 2.0.
 */

import $ from 'jquery';

let counter = 0;

const generateId = name => {
  counter++;
  return `${name}_${counter}`;
};

const playAnimation = (ele, anim, options) => {
  const id = generateId('animId');
  const $ele = $(ele);

  const opts = {
    timeout: 3000, // ensure the promise is resolved after 3000ms
    selector: null, // if selector is added we will use delegation
    ...options,
  };

  let timer;

  const p = new Promise(resolve => {
    const doResolve = () => {
      $ele.removeClass(anim);
      clearTimeout(timer);
      resolve();
    };

    if (opts.selector) {
      $ele.one(`animationend.${id}`, opts.selector, doResolve);
    } else {
      $ele.one(`animationend.${id}`, doResolve);
    }

    timer = setTimeout(doResolve, opts.timeout);

    $ele.addClass(anim);
  });

  return p;
};

export const create = ({ showClass = 'on', enterClass = 'enter', exitClass = 'exit' } = {}) => ({
  show(ele) {
    const $ele = $(ele);
    if ($ele.hasClass(showClass)) {
      return Promise.resolve();
    }

    $ele.addClass(showClass);
    return playAnimation($ele, enterClass);
  },
  hide(ele) {
    const $ele = $(ele);
    if (!$ele.hasClass(showClass)) {
      return Promise.resolve();
    }
    return playAnimation($ele, exitClass).then(() => $ele.removeClass(showClass));
  },
});
