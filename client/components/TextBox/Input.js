/*
 * Copyright (c) 2022 Reva Technology Inc., all rights reserved.
 * Unauthorized copying of this file, via any medium is strictly prohibited
 * Licensed under the Elastic License 2.0; you may not use this file except
 * in compliance with the Elastic License 2.0.
 */

import React, { Component } from 'react';
import $ from 'jquery';
import debounce from 'debouncy';
import generateId from 'helpers/generateId';
import Textarea from 'react-textarea-autosize';
import './jquery-mask';
import typeOf from 'helpers/type-of';

export default class Input extends Component {
  constructor(props, context) {
    super(props, context);
    this.id = generateId(this);

    this.checkAutoFill = debounce(this.checkAutoFill, 400, this);
  }

  get $txt() {
    if (!this._txt) {
      const { multiline, autoFill } = this.props;
      if (multiline && !autoFill) {
        this._txt = $(this.refs.txt._rootDOMNode);
      } else {
        this._txt = $(this.refs.txt);
      }
    }

    return this._txt;
  }

  get value() {
    const $txt = this.$txt;
    return $txt.val();
  }

  set value(val) {
    const { mask } = this.props;
    const $txt = this.$txt;

    if (mask) {
      const lastValue = $txt.val();

      if (lastValue !== val) {
        $txt.val(val);
        $txt.trigger('input');
      }
      return;
    }

    const lastValue = $txt.val();

    if (lastValue !== val) {
      $txt.val(val);
    }
  }

  checkAutoFill() {
    const { multiline } = this.props;
    if (!this._mounted) return;
    // inspired by
    // https://github.com/appsforartists/gravel/blob/24d915e6bdfbb35963a30e7a2579804e74aea323/src/components/Input.jsx#L219
    const node = multiline ? this.refs.txt._rootDOMNode : this.refs.txt;
    if (!node) {
      // probably unmounted already
      return;
    }
    const value = node.value;

    if (!value && node.matches) {
      // For security reasons, we can't get an autofilled value from Chrome;
      // however, we can check the `:-webkit-autofill` selector and infer
      // `active` accordingly.
      //
      // Firefox will let you read an autofilled value, so we don't need to sweat
      // `:-moz-autofill`.

      let autofilled = false;

      // Must wrap these tests in a `try` because the browser will throw if it
      // doesn't recognize a selector
      try {
        autofilled = node.matches(':autofill');
      } catch (error) {
        try {
          autofilled = node.matches(':-webkit-autofill');
        } catch (err) {
          // failed to match autofill selector
        }
      }
      const { onAutoFillDetection } = this.props;

      onAutoFillDetection && onAutoFillDetection(autofilled);
    }
  }

  componentDidMount() {
    this._mounted = true;

    this.checkAutoFill();

    const { mask } = this.props;
    if (mask) {
      let theMask = mask;
      let theMaskOptions = {};

      if (typeOf(mask) === 'object') {
        theMask = mask.mask;
        theMaskOptions = mask.options;
      }

      this.$txt.mask(theMask, theMaskOptions);
    }
  }

  componentWillUnmount() {
    this._mounted = false;
    this.$txt.unmask();
  }

  render() {
    const {
      // the following variables are just extracted
      // so we can use the rest of them in the `rest` variable
      defaultValue, // eslint-disable-line no-unused-vars
      value, // eslint-disable-line no-unused-vars
      onAutoFillDetection, // eslint-disable-line no-unused-vars
      multiline,
      autoFill,
      mask, // eslint-disable-line
      ...rest
    } = this.props;

    let { id } = this.props;

    id = id || this.id;

    if (multiline) {
      return autoFill ? <textarea id={id} ref="txt" {...rest} /> : <Textarea id={id} ref="txt" {...rest} />;
    }
    return <input id={id} ref="txt" {...rest} />;
  }

  select() {
    this.$txt[0].select();
  }

  focus() {
    this.$txt[0].focus();
  }

  blur() {
    this.$txt[0].blur();
  }

  resize() {
    const { _resizeComponent } = this.refs.txt;
    _resizeComponent && _resizeComponent();
  }

  setCaretPosition(start, end) {
    const input = this.$txt[0];
    if (!input || !input.setSelectionRange) {
      return;
    }

    input.focus();

    try {
      input.setSelectionRange(start, end);
    } catch (ex) {
      console.warn(`attempt to use setSelectionRange on an input that does not allow it: ${input.type}`, ex);
    }
  }

  resetCursor = () => {
    const textarea = this.$txt[0];

    this.setCaretPosition(0, 0);
    textarea.scrollTop = 0;
  };
}
