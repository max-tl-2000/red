/*
 * Copyright (c) 2022 Reva Technology Inc., all rights reserved.
 * Unauthorized copying of this file, via any medium is strictly prohibited
 * Licensed under the Elastic License 2.0; you may not use this file except
 * in compliance with the Elastic License 2.0.
 */

import $ from 'jquery';
import debounce from 'debouncy';
import { window } from '../../common/helpers/globals';

const spEvents = $.event.special;

const box = $selector => ({
  width: $selector.width(),
  height: $selector.height(),
});

const $win = $(window);

/**
 * This event fires when the window has being resized. This special event is throttled so it won't fire continuosly as the real resize event
 * only will fire when the resize event has stopped to fire at least for `THRESHOLD_TO_RAISE_WINDOW_RESIZE`
 *
 * By default `THRESHOLD_TO_RAISE_WINDOW_RESIZE` is 300ms
 *
 * It could be listened from any element not only the window object so
 *
 * `$('.some-selector').on('window:resize', function() { });`
 *
 * will fire when the window resizes but the this element will be the `.some-selector` element.
 *
 * @param e {Event} Event Object, first argument
 * @param args {Object} args object passed to the callback
 * @param args.width {Number} the width of the window
 * @param args.height {Number} the height of the window
 *
 * @event window:resize
 * @example
 * ```
 * $window.one('window:resize', function(e) {
 *    // listen to the window resize
 * });
 *
 * $('.some-selector').one('window:resize', function(e, args) {
 *   // this will be .some-selector, but this event will fire when the window resizes
 *   console.log(args);
 *   // args.width => the current width of the window
 *   // args.height => the current height of the window
 * });
 *
 */

const name = 'window:resize';
const eventType = 'resize.special';
let $elements = $([]);
let windowResizeCount = 0;
/**
 *
 * @class $.event.special['window:resize']
 * @static
 */
spEvents[name] = {
  setup() {
    const $me = $(this);
    windowResizeCount++;

    const THRESHOLD_TO_RAISE_WINDOW_RESIZE = 100;

    if (windowResizeCount === 1) {
      const onWindowResize = debounce(() => {
        const size = box($win);
        const data = {
          size,
        };

        $elements.each((i, ele) => {
          $(ele).trigger(name, data);
        });
      }, THRESHOLD_TO_RAISE_WINDOW_RESIZE);

      $win.on(eventType, onWindowResize);
    }

    $elements = $elements.add($me);

    return true; // not handle it normally
  },
  teardown() {
    windowResizeCount--;

    $elements = $elements.not($(this));

    if (windowResizeCount < 1) {
      $win.off(eventType);
    }
  },
};
