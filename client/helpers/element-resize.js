/*
 * Copyright (c) 2022 Reva Technology Inc., all rights reserved.
 * Unauthorized copying of this file, via any medium is strictly prohibited
 * Licensed under the Elastic License 2.0; you may not use this file except
 * in compliance with the Elastic License 2.0.
 */

import './window-resize';
import $ from 'jquery';
import ResizeObserver from 'resize-observer-polyfill';

const observerFacade = {
  get observer() {
    if (!this._observer) {
      this._observer = new ResizeObserver(entries => {
        // just move it out of this turn of the loop to prevent CPM-10310 - Client log error: ResizeObserver loop limit exceeded
        const notifyChange = entry => {
          const cr = entry.contentRect;
          setTimeout(
            () =>
              $(entry.target).triggerHandler('element:resize', {
                w: cr.width,
                h: cr.height,
              }),
            0,
          );
        };

        for (const entry of entries) {
          notifyChange(entry);
        }
      });
    }
    return this._observer;
  },
  observe(ele) {
    this.observer.observe(ele);
  },
  unobserve(ele) {
    this.observer.unobserve(ele);
  },
};

// jquery special event
// check https://learn.jquery.com/events/event-extensions/
$.event.special['element:resize'] = {
  // setup is executed only the first time a
  // listener is added to a given dom element
  setup() {
    observerFacade.observe(this);
  },
  // teardown is executed when the last `element:resize` event is
  // removed from the DOM element
  teardown() {
    observerFacade.unobserve(this);
  },
};
