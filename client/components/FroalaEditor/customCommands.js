/*
 * Copyright (c) 2022 Reva Technology Inc., all rights reserved.
 * Unauthorized copying of this file, via any medium is strictly prohibited
 * Licensed under the Elastic License 2.0; you may not use this file except
 * in compliance with the Elastic License 2.0.
 */

/* eslint-disable new-cap */

export const enableCustomCommands = ({ froalaEditor }) => {
  function isActive(cmd) {
    return this.format.is(cmd);
  }

  froalaEditor.DefineIcon('attachment', {
    PATH:
      'm6.36034,6.27397c0,-3 2.5,-5.5 5.5,-5.5c3,0 5.5,2.5 5.5,5.5l0,10.5c0,2.2 -1.8,4 -4,4c-2.2,0 -4,-1.8 -4,-4l0,-8.5c0,-1.4 1.1,-2.5 2.5,-2.5c1.4,0 2.5,1.1 2.5,2.5l0,7.5l-1.5,0l0,-7.5c0,-0.6 -0.4,-1 -1,-1c-0.6,0 -1,0.4 -1,1l0,8.5c0,1.4 1.1,2.5 2.5,2.5c1.4,0 2.5,-1.1 2.5,-2.5l0,-10.5c0,-2.2 -1.8,-4 -4,-4c-2.2,0 -4,1.8 -4,4l0,9.5l-1.5,0l0,-9.5z',
    template: 'svg',
  });
  froalaEditor.RegisterCommand('attachFile', {
    title: 'Attach File',
    icon: 'attachment',
    focus: true,
    undo: false,
    refreshAfterCallback: false,
    callback() {
      this.handleAttachmentClick();
    },
  });

  froalaEditor.DefineIcon('pre', {
    PATH: 'm10.4,7.50424l-4.6,4.6l4.6,4.6l-1.4,1.4l-6,-6l6,-6l1.4,1.4zm4.6,-1.4l6,6l-6,6l-1.4,-1.4l4.6,-4.6l-4.6,-4.6l1.4,-1.4z',
    template: 'svg',
  });
  froalaEditor.RegisterCommand('pre', {
    title: 'Code block',
    refreshAfterCallback: true,
    callback(cmd) {
      this.paragraphFormat.apply(isActive.apply(this, [cmd]) ? 'N' : cmd);
    },
    refresh($btn) {
      $btn.toggleClass('fr-active', isActive.apply(this, [$btn.data('cmd')]));
    },
  });

  froalaEditor.DefineIcon('blockquote', {
    PATH: 'm14,16.45272l3,0l2,-4l0,-6l-6,0l0,6l3,0l-2,4zm-8,0l3,0l2,-4l0,-6l-6,0l0,6l3,0l-2,4z',
    template: 'svg',
  });
  froalaEditor.RegisterCommand('blockquote', {
    title: 'Block Quote',
    refreshAfterCallback: true,
    callback(cmd) {
      this.quote.apply(isActive.apply(this, [cmd]) ? 'decrease' : 'increase');
    },
    refresh($btn) {
      $btn.toggleClass('fr-active', isActive.apply(this, [$btn.data('cmd')]));
    },
  });

  froalaEditor.DefineIcon('customFontSize', { NAME: 'star', SVG_KEY: 'fontSize' });
  froalaEditor.RegisterCommand('customFontSize', {
    title: 'Font Size',
    type: 'dropdown',
    undo: true,
    refreshAfterCallback: true,
    focus: true,
    options: {
      '13px': "<span title='13px' style='font-size: 13px;'>Normal</span>",
      '18px': "<span title='18px' style='font-size: 18px;'>Large</span>",
      '32px': "<span title='32px' style='font-size: 32px;'>Huge</span>",
    },
    callback(cmd, val) {
      const currentFontSize = this.selection.element().style?.fontSize;
      if (currentFontSize === val) {
        this.format.removeStyle('font-size');
      } else {
        this.fontSize.apply(val);
      }
    },
    refreshOnShow($btn, $dropdown) {
      const currentFontSize = this.selection.element().style?.fontSize;
      const options = $dropdown.find('li a').get();
      options.forEach(option => {
        const optionFontSize = option?.dataset?.param1;
        if (currentFontSize === optionFontSize) {
          option.classList.add('fr-active');
        } else {
          option.classList.remove('fr-active');
        }
      });
    },
  });
};
