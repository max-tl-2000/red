/*
 * Copyright (c) 2022 Reva Technology Inc., all rights reserved.
 * Unauthorized copying of this file, via any medium is strictly prohibited
 * Licensed under the Elastic License 2.0; you may not use this file except
 * in compliance with the Elastic License 2.0.
 */

import { document } from '../../common/helpers/globals';

interface IMouseData {
  mousedownPageX: number;
  mousedownPageY: number;
  mouseupPageX: number;
  mouseupPageY: number;
}

const data: IMouseData = { mousedownPageX: -1, mousedownPageY: -1, mouseupPageX: -1, mouseupPageY: -1 };

const listeners = {
  mousedown: (e: MouseEvent) => {
    data.mousedownPageX = e.pageX;
    data.mousedownPageY = e.pageY;
  },
  mouseup: (e: MouseEvent) => {
    data.mouseupPageX = e.pageX;
    data.mouseupPageY = e.pageY;
  },
  click: (e: MouseEvent) => {
    const deltaXSquare = (data.mouseupPageX - data.mousedownPageX) ** 2;
    const deltaYSquare = (data.mouseupPageY - data.mousedownPageY) ** 2;

    const MAX_ALLOWED_DISTANCE_SQUARED = 100; // 10 * 10 (10px in any direction)

    const shouldStopClick = deltaXSquare + deltaYSquare >= MAX_ALLOWED_DISTANCE_SQUARED;

    if (shouldStopClick) {
      e.stopImmediatePropagation();
    }
  },
};

/**
 * Selection of text in our app is very unfriendly, almost everywhere
 * where a click listener was added we couldn't select any text
 *
 * So this module will prevent clicks from happening if any of the following conditions are met
 * - If the time between the mousedown and mouseup is greater than 500ms
 * - If the distance between the mousedown and mouseup is greater than 20px
 *
 */
export const overrideClick = () => {
  document.addEventListener('mousedown', listeners.mousedown, true);
  document.addEventListener('mouseup', listeners.mouseup, true);
  document.addEventListener('click', listeners.click, true);
};
