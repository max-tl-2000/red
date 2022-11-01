/*
 * Copyright (c) 2022 Reva Technology Inc., all rights reserved.
 * Unauthorized copying of this file, via any medium is strictly prohibited
 * Licensed under the Elastic License 2.0; you may not use this file except
 * in compliance with the Elastic License 2.0.
 */

import chai from 'chai';
import sinon from 'sinon';
import sinonChai from 'sinon-chai';
import { unmountComponentAtNode } from 'react-dom';
import when from './when';
import and from './and';
import * as overrider from './overrider';
import * as sandboxer from './sandboxer';
import sleep from '../helpers/sleep';

sandboxer.setSinon(sinon);

const expect = chai.expect;
const assert = chai.assert;

chai.use(sinonChai);

let div;

if (global.document) {
  beforeEach(() => {
    div = document.createElement('div');
    div.setAttribute('id', 'sandbox');

    document.body.appendChild(div);
  });
}

afterEach(() => {
  if (global.document && div) {
    unmountComponentAtNode(div);
    document.body.removeChild(div);
    div = null;
  }

  overrider.restore();
  sandboxer.restore();
});

const getSandBoxDiv = () => div;

// helper method to trigger a real click event in the browser
// jquery.fn.click is not the same as this as the event need
// to also generate the capture phase
const triggerMouseEvent = (ele, evt) => {
  const mEvent = document.createEvent('MouseEvent');
  // interface
  // event.initMouseEvent(type, canBubble, cancelable, view,
  //                    detail, screenX, screenY, clientX, clientY,
  //                    ctrlKey, altKey, shiftKey, metaKey,
  //                    button, relatedTarget);
  mEvent.initMouseEvent(evt, true, true, window, 0, 0, 0, 0, 0, false, false, false, false, 0, null);

  ele.dispatchEvent(mEvent);
};

export { getSandBoxDiv, triggerMouseEvent, overrider, expect, assert, sinon, when, sandboxer, and, sleep };
