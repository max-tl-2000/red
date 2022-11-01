/*
 * Copyright (c) 2022 Reva Technology Inc., all rights reserved.
 * Unauthorized copying of this file, via any medium is strictly prohibited
 * Licensed under the Elastic License 2.0; you may not use this file except
 * in compliance with the Elastic License 2.0.
 */

import React from 'react';
import { render } from 'react-dom';
import { expect, getSandBoxDiv } from 'test-helpers';
import $ from 'jquery';
import FullScreenDialog from '../FullScreenDialog';
// import Dialog from '../../Dialog/Dialog';
// import DialogOverlay from '../../Dialog/DialogOverlay';

describe('FullScreenDialog', () => {
  it('Should not render the content if the dialog is not open', () => {
    const sandBoxDiv = getSandBoxDiv();
    render(
      <FullScreenDialog id="some-id" title="A demo title" open={false}>
        <div id="myContent" />
      </FullScreenDialog>,
      sandBoxDiv,
    );
    expect($('#some-id').length > 0).to.equal(true);
    expect($('#some-id').find('#myContent').length).to.equal(0);
  });

  it('should render the title if one is provided and dialog is open', () => {
    const sandBoxDiv = getSandBoxDiv();
    render(
      <FullScreenDialog id="some-id" title="A demo title" open={true}>
        <div id="myContent" />
      </FullScreenDialog>,
      sandBoxDiv,
    );
    expect($('#some-id [data-component="title"]').text()).to.equal('A demo title');
  });

  // These tests were asserting on computed properties that depend on the browser
  // their values would be different from browser to browser, the best thing we can
  // do here is to find a different way to test this thing. Commenting it for now
  //
  // it('should render the title as white text', () => {
  //   const sandBoxDiv = getSandBoxDiv();
  //   render(<FullScreenDialog id="some-id" title="A demo title" open={ true }><div id="myContent" /></FullScreenDialog>, sandBoxDiv);
  //   const elem = $('#some-id [data-component="title"]')[0];
  //   const color = window.getComputedStyle(elem).color;
  //   expect(color).to.equal('rgb(255, 255, 255)');
  // });

  // describe('CPM-2337', () => {
  //   it('should render the title of an inner dialog as primary text', () => {
  //     const sandBoxDiv = getSandBoxDiv();
  //     render(<FullScreenDialog id="some-id" title="A demo title" open={ true }>
  //         <Dialog id="inner-dialog" open={ true }>
  //           <DialogOverlay title="Inner Dialog Overlay">
  //             Some text that goes inside inner dialog
  //           </DialogOverlay>
  //         </Dialog>
  //       </FullScreenDialog>, sandBoxDiv);
  //     const elem = $('#inner-dialog [data-component="title"]')[0];
  //     const color = window.getComputedStyle(elem).color;
  //     expect(color).to.equal('rgba(0, 0, 0, 0.870588)');
  //   });
  // });
});
