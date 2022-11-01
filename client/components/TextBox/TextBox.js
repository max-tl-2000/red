/*
 * Copyright (c) 2022 Reva Technology Inc., all rights reserved.
 * Unauthorized copying of this file, via any medium is strictly prohibited
 * Licensed under the Elastic License 2.0; you may not use this file except
 * in compliance with the Elastic License 2.0.
 */

import PropTypes from 'prop-types';
import React, { Component } from 'react';
import { findDOMNode } from 'react-dom';
import { observer } from 'mobx-react';
import trim from 'helpers/trim';
import removeNewLines from 'helpers/removeNewLines';
import generateId from 'helpers/generateId';
import $ from 'jquery';
import debounce from 'debouncy';
import sleep from 'helpers/sleep';
import contains from 'helpers/contains';
import nullish from 'helpers/nullish';
import { cf, g } from './textbox.scss';

import Icon from '../Icon/Icon';
import Input from './Input';
import Validator from '../Validator/Validator';

import Text from '../Typography/Text';
import FieldMark from '../FieldMark/FieldMark';
import { document as doc } from '../../../common/helpers/globals';

const enterKeyCode = 13;
const escapeKeyCode = 27;
const leftKeyCode = 37;
const rightKeyCode = 39;
const cmdKeyCode = 91;
const ctrlKeyCode = 17;
const cKeyCode = 67;
const readyOnlyAllowedKeyCode = [leftKeyCode, rightKeyCode, cmdKeyCode, ctrlKeyCode, cKeyCode];

@observer
export default class TextBox extends Component {
  constructor(props) {
    super(props);

    this.id = generateId(this);

    this.state = {
      touched: false,
      focused: false,
      empty: !props.value,
    };

    this.raiseChange = debounce(this._raiseChange, 50, this);
    this.checkEmpty = debounce(this._checkEmpty, 50, this);
  }

  blur() {
    this.theInput.blur();
  }

  resize() {
    this.theInput.resize();
  }

  markAsTouched = () => {
    if (this.state.touched) {
      return;
    }
    this.setState({ touched: true });
  };

  static defaultProps = {
    autoTrim: true,
    disabled: false,
    multiline: false,
    autoResize: true,
    autoFill: false,
    underline: true,
    underlineOnEditOnly: false,
    textRoleSecondary: false,
    required: false,
    optional: false,
    requiredMark: '*',
    optionalMark: '(optional)',
    autoRemoveNewLines: false,
    persistSameInput: false,
  };

  static propTypes = {
    autoTrim: PropTypes.bool,
    boldText: PropTypes.bool,
    onChange: PropTypes.func,
    type: PropTypes.string,
    id: PropTypes.string,
    disabled: PropTypes.bool,
    label: PropTypes.string,
    className: PropTypes.string,
    inputClassName: PropTypes.string,
    errorMessage: PropTypes.string,
    warningMessage: PropTypes.string,
    placeholder: PropTypes.string,
    value: PropTypes.any,
    autoFocus: PropTypes.bool,
    onEnterPress: PropTypes.func,
    onEscapePress: PropTypes.func,
    onKeyDown: PropTypes.func,
    onBlur: PropTypes.func,
    multiline: PropTypes.bool,
    numRows: PropTypes.number,
    autoResize: PropTypes.bool,
    autoFill: PropTypes.bool,
    underline: PropTypes.bool,
    useActiveLabel: PropTypes.bool,
    showClear: PropTypes.bool,
    wide: PropTypes.bool,
    underlineOnEditOnly: PropTypes.bool,
    textRoleSecondary: PropTypes.bool,
    mask: PropTypes.any,
    iconAffordance: PropTypes.string,
    textAffordance: PropTypes.string,
    wideIcon: PropTypes.bool,
    required: PropTypes.bool,
    requiredMark: PropTypes.string,
    optional: PropTypes.bool,
    optionalMark: PropTypes.string,
    forceSentenceCaseOnError: PropTypes.bool,
    readOnly: PropTypes.bool,
    autoRemoveNewLines: PropTypes.bool,
    persistSameInput: PropTypes.bool,
  };

  handleClick = e => {
    this.markAsTouched();
    const { onClick } = this.props;
    onClick && onClick(e);
  };

  handleLabelTouchTap = () => this.focus();

  processValue() {
    const { value: _value, props } = this;
    const { autoTrim, forceLowerCase } = props;

    let value = _value;

    if (autoTrim || forceLowerCase) {
      const processedValue = this.getProcessedValue(value);

      if (value !== processedValue) {
        value = processedValue;

        this.value = value;
        // prevent race condition caused because
        // the raiseChange method is debounced
        this.raiseChange.cancel();
        this._raiseChange({ value, noDebounce: true });
      }
    }
  }

  isAReadOnlyAllowedKey = ({ keyCode }) => readyOnlyAllowedKeyCode.includes(keyCode);

  preventDefaultBehavior = e => {
    e.preventDefault();
    e.stopPropagation();
  };

  handleKeyDown = e => {
    const args = { cancel: false };
    const { onEnterPress, onEscapePress, onKeyDown, readOnly } = this.props;

    if (readOnly && !this.isAReadOnlyAllowedKey(e)) {
      this.preventDefaultBehavior(e);
      return;
    }

    if (onEnterPress && e.keyCode === enterKeyCode && !e.shiftKey && !e.altKey) {
      this.processValue();

      onEnterPress(e, args);
      // prevent default and propagation because if onEnterPress clears the input
      // (like message sending does) then a new line will be added afterwards
      this.preventDefaultBehavior(e);
    }

    if (e.keyCode === escapeKeyCode) {
      onEscapePress && onEscapePress(e, args);
    }

    if (args.cancel) return;

    onKeyDown && onKeyDown(e);
  };

  handleOnCut = e => (this.props.readOnly ? this.preventDefaultBehavior(e) : undefined);

  getProcessedValue = value => {
    const { autoTrim, forceLowerCase, autoRemoveNewLines } = this.props;
    if (autoTrim) {
      value = trim(value);
    }
    if (autoRemoveNewLines) {
      value = removeNewLines(value);
    }

    if (forceLowerCase) {
      value = value.toLowerCase();
    }

    return value;
  };

  handleBlur = e => {
    const { value: _value, props } = this;
    const { onBlur, autoTrim, forceLowerCase, autoRemoveNewLines } = props;

    const raiseBlur = value => {
      if (onBlur) {
        onBlur(e, { value });
      }
    };

    let value = _value;
    this.setState({ focused: false });

    if (autoTrim || forceLowerCase || autoRemoveNewLines) {
      const processedValue = this.getProcessedValue(value);
      if (value !== processedValue) {
        value = processedValue;
        this.value = value;
        // prevent race condition caused because
        // the raiseChange method is debounced
        this.raiseChange.cancel();

        this._raiseChange({ value, noDebounce: true });

        raiseBlur(value);
        return;
      }
    }

    raiseBlur(value);
  };

  get theInput() {
    return this.refs.input;
  }

  handleFocus = e => {
    const { onFocus } = this.props;
    this.setState({ focused: true });

    if (!this.state.touched && doc.body.getAttribute('data-input-method') === 'keyboard') {
      this.theInput && this.theInput.resetCursor();
    }
    this.markAsTouched();
    onFocus && onFocus(e);
  };

  _checkEmpty(args) {
    const empty = nullish(args.value) || args.value === '';
    if (!this._mounted) {
      return;
    }

    this.setState({
      empty,
    });
  }

  _raiseChange(args) {
    const { onChange } = this.props;
    onChange && onChange(args);
  }

  handleChange = e => {
    const args = { value: e.target.value, id: this.props.id || this.id };
    this.checkEmpty(args);

    const shouldFireChange = args.value !== this.prevValue;

    this.prevValue = args.value;

    shouldFireChange && this.raiseChange(args);
  };

  focus() {
    this.markAsTouched();
    setTimeout(() => {
      if (!this._mounted) return;
      this.refs.input.focus();
    }, 50);
  }

  resetCursor() {
    this.markAsTouched();
    setTimeout(() => {
      if (!this._mounted) return;
      this.refs.input.resetCursor();
    }, 50);
  }

  select() {
    this.refs.input.select();
  }

  get value() {
    return this.getValue();
  }

  set value(val) {
    this.refs.input.value = val;
    this.checkEmpty({ value: val });
  }

  getValue() {
    return this.refs.input.value;
  }

  clearText = () => {
    const { clearTextRequest } = this.props;

    if (clearTextRequest) {
      clearTextRequest();
      return;
    }
    this.value = '';
    const args = { value: this.value, id: this.props.id };
    this.raiseChange(args);
  };

  setCaretPosition(start, end) {
    this.refs.input.setCaretPosition(start, end);
  }

  componentDidMount() {
    this._mounted = true;
    const { autoFocus, multiline, autoFill } = this.props;

    this.$txtDiv.on(`focusin.ns_${this.id}`, () => this.setState({ focusInTextBoxDiv: true }));
    this.$txtDiv.on(`focusout.ns_${this.id}`, async () => {
      const THRESHOLD_TO_CHECK_IF_FOCUSED = 200;

      await sleep(THRESHOLD_TO_CHECK_IF_FOCUSED);

      if (!this._mounted || contains(this.$txtDiv[0], doc.activeElement)) {
        return;
      }

      this.setState({ focusInTextBoxDiv: false });
    });

    if (autoFocus) {
      // just schedule it for the next tick
      setTimeout(() => this._mounted && this.setState({ focusInTextBoxDiv: true }), 16);
      this.focus();
    }

    this.checkTextValue(this.props);
    if (this.value === '') {
      this.setState({ empty: true }); // eslint-disable-line
    }

    if (multiline && !autoFill) {
      // needed to correctly show the underline at the end of the textarea
      // and not at the middle
      setTimeout(() => {
        if (!this._mounted) return;
        $(this.inputWrapper).addClass(cf('force-repaint'));
      }, 50); // give it time to render
    }
  }

  checkTextValue(props) {
    if ('value' in props) {
      this.value = props.value;
    }
  }

  componentWillReceiveProps(nextProps) {
    const { persistSameInput = false, value } = this.props;
    if (nextProps.value !== value || persistSameInput) {
      this.checkTextValue(nextProps);
    }
  }

  componentWillUnmount() {
    this._mounted = false;
    this.$txtDiv.off(`.ns_${this.id}`);
  }

  handleMouseDown = () =>
    this.setState({
      showingPassword: true,
    });

  get $label() {
    if (!this._label) {
      this._label = $(this.refs.label);
    }
    return this._label;
  }

  get $txtDiv() {
    if (!this._$txtDiv) {
      this._$txtDiv = $(findDOMNode(this));
    }

    return this._$txtDiv;
  }

  handleAutofillDetection = autofilled => {
    const { placeholder, useActiveLabel } = this.props;
    if (autofilled) {
      this.setState({ autofilled });
    } else if (!this.state.touched && !placeholder && !useActiveLabel) {
      this.setState({ autofilled: false });
    }
  };

  handleMouseUp = () => {
    setTimeout(() => {
      if (!this._mounted) {
        return;
      }

      this.setState({
        showingPassword: false,
      });
    }, 50);
  };

  shouldShowClearField = () => this.props.showClear && !this.props.readOnly;

  handleClearTextIfEnter = e => {
    if (e.key === 'Enter') {
      this.clearText();
    }
  };

  render() {
    const { showingPassword, focused, focusInTextBoxDiv, autofilled } = this.state;

    /* esfmt-ignore-start */
    let { id, errorMessage, warningMessage, type } = this.props;

    const {
      autoRemoveNewLines,
      placeholder,
      className,
      autoTrim,
      label,
      underline,
      numRows,
      multiline,
      inputStyle,
      autoResize,
      autoFill,
      helperIcon,
      inputClassName,
      style,
      useActiveLabel,
      showClear,
      wide,
      dataId,
      iconAffordance,
      textAffordance,
      wideIcon,
      required,
      requiredMark,
      optional,
      optionalMark,
      boldText,
      forceSentenceCaseOnError,
      underlineOnEditOnly,
      textRoleSecondary,
      forceLowerCase, // eslint-disable-line
      onEscapePress, // eslint-disable-line
      onEnterPress, // eslint-disable-line
      mask,
      readOnly,
      clearTextRequest,
      'data-component': _dataComponent,
      errorMessage: _errorMessage, // eslint-disable-line
      warningMessage: _warningMessage, // eslint-disable-line
      valid: _valid, // eslint-disable-line
      persistSameInput,
      ...textProps
    } = this.props;
    /* esfmt-ignore-end */

    errorMessage = trim(errorMessage);
    const valid = !errorMessage;

    warningMessage = trim(warningMessage);

    id = id || this.id; // use the provided one or the generated one

    const errorMessageId = `${id}-err-msg`;
    const warningMessageId = `${id}-warn-msg`;
    const { empty } = this.state;
    const isActive = useActiveLabel || focused || !empty || autofilled;

    const tbClassNames = cf(
      {
        'no-autosize': !autoResize,
        textRoleSecondary,
        noHidePlaceholder: !label,
        active: isActive,
        boldText,
      },
      g(inputClassName, {
        invalid: !valid,
        'materialize-textarea': multiline && autoResize,
      }),
    );

    type = type || 'text';

    const elementStyle = {
      ...inputStyle,
    };

    if (multiline) {
      elementStyle.minHeight = !autoFill ? 37 : 'auto';
      if (numRows > 1) {
        elementStyle.minHeight = numRows * 26;
      }
      if (!autoResize && numRows > 1) {
        elementStyle.maxHeight = numRows * 26;
      } else if (textProps.maxRows) {
        elementStyle.maxHeight = textProps.maxRows * 26;
      }
    }

    const theLabel = trim(label);

    const isPassword = type === 'password';

    const outerClasses = cf(
      'textbox',
      {
        'no-underline': !underline,
        disabled: this.props.disabled || readOnly,
        textarea: multiline,
        showIconAffordance: iconAffordance || textAffordance,
        'password-box': isPassword,
        'no-label': !theLabel,
        'auto-fill': autoFill,
        'no-valid': !valid,
        clearable: this.shouldShowClearField(),
        underlineOnEditOnly,
        wideIcon,
        wide,
      },
      g(className),
    );

    const eyeAffordanceClasses = cf('eye-affordance', {
      on: isPassword && !empty,
    });

    const fieldProps = { required, optional, requiredMark, optionalMark };

    const activeClass = isActive ? 'active' : '';

    const labelComponent = !theLabel ? null : (
      <label ref="label" htmlFor={id} className={activeClass} onClick={this.handleLabelTouchTap}>
        {theLabel} <FieldMark {...fieldProps} />
      </label>
    );

    let accessoryComponent;
    if (isPassword) {
      accessoryComponent = (
        <div className={eyeAffordanceClasses} onMouseDown={this.handleMouseDown} onMouseUp={this.handleMouseUp}>
          <Icon name={showingPassword ? 'eye' : 'eye-off'} />
        </div>
      );
    } else if (this.shouldShowClearField()) {
      accessoryComponent = (
        <div
          tabIndex={0}
          data-component="textbox-clear"
          className={cf('clear-box', { on: !empty && focusInTextBoxDiv })}
          onClick={this.clearText}
          onKeyUp={this.handleClearTextIfEnter}>
          <Icon name="close" />
        </div>
      );
    }

    let affordanceIconComponent;

    if (iconAffordance) {
      affordanceIconComponent = (
        <div className={cf('affordance-holder')}>
          <Icon secondary name={iconAffordance} />
        </div>
      );
    } else if (textAffordance) {
      affordanceIconComponent = (
        <div className={cf('affordance-holder')}>
          <Text>{textAffordance}</Text>
        </div>
      );
    }

    const inputComponent = (
      <Input
        {...textProps}
        multiline={multiline}
        ref="input"
        mask={mask}
        style={elementStyle}
        placeholder={placeholder}
        id={id}
        autoFill={autoFill}
        type={showingPassword ? 'text' : type}
        onKeyDown={this.handleKeyDown}
        onFocus={this.handleFocus}
        onBlur={this.handleBlur}
        onAutoFillDetection={this.handleAutofillDetection}
        onClick={this.handleClick}
        onCut={this.handleOnCut}
        data-id={dataId}
        onChange={this.handleChange}
        className={tbClassNames}
      />
    );

    return (
      <div className={outerClasses} style={style} data-component={_dataComponent || 'textbox'}>
        <div ref={ref => (this.inputWrapper = ref)} className={cf(g('input-field'), { focused })}>
          {inputComponent}
          {labelComponent}
          {accessoryComponent}
          {affordanceIconComponent}
          {helperIcon}
        </div>
        {errorMessage && (
          <Validator forceSentenceCase={forceSentenceCaseOnError} id={errorMessageId} visible={!valid}>
            {errorMessage}
          </Validator>
        )}
        {!errorMessage && warningMessage && (
          <Validator forceSentenceCase={forceSentenceCaseOnError} id={warningMessageId} className={'warning'}>
            {warningMessage}
          </Validator>
        )}
      </div>
    );
  }
}
