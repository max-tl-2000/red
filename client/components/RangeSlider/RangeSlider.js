/*
 * Copyright (c) 2022 Reva Technology Inc., all rights reserved.
 * Unauthorized copying of this file, via any medium is strictly prohibited
 * Licensed under the Elastic License 2.0; you may not use this file except
 * in compliance with the Elastic License 2.0.
 */

import PropTypes from 'prop-types';
import React, { Component } from 'react';
import noUiSlider from 'noUiSlider';
import injectProps from 'helpers/injectProps';

import trim from 'helpers/trim';
import clsc from 'helpers/coalescy';
import warning from 'warning';
import nullish from 'helpers/nullish';
import { toSentenceCase } from 'helpers/capitalize';
import TextBox from '../TextBox/TextBox';
import Validator from '../Validator/Validator';
import { cf, g } from './RangeSlider.scss';

const SLIDER_RANGE_STEP = 1;
const DEFAULT_CONNECT = 'lower';
export default class RangeSlider extends Component {
  static propTypes = {
    title: PropTypes.string,
    connect: PropTypes.oneOfType([PropTypes.string, PropTypes.bool]),
    input: PropTypes.oneOfType([PropTypes.func, PropTypes.bool]),
    range: PropTypes.shape({
      min: PropTypes.number,
      max: PropTypes.number,
    }),
    step: PropTypes.number,
    onChange: PropTypes.func,
    val: PropTypes.shape({
      min: PropTypes.number,
      max: PropTypes.number,
    }),
    normalizeRange: PropTypes.bool,
  };

  static defaultProps = {
    step: SLIDER_RANGE_STEP,
    connect: DEFAULT_CONNECT,
  };

  constructor(props) {
    super(props);
    const { val, range } = this.props;
    const { theValue } = this.getValuesAndRange(val, range);

    if (nullish(theValue)) {
      this.state = {};
      return;
    }

    const valueIsArray = Array.isArray(theValue);

    this.state = {
      min: valueIsArray ? theValue[0] : theValue,
      max: valueIsArray ? theValue[1] : undefined,
    };
  }

  onChange = values => {
    const [min, max] = values;
    this.setState({
      min,
      max,
    });
    this.props.onChange && this.props.onChange({ min, max });
  };

  _calcMaxRange(max, step) {
    return max % step === 0 ? max : max + (step - (max % step));
  }

  _getRangeMinAndMax(range) {
    const { normalizeRange, step } = this.props;
    const theRange = range || {};
    const minRange = normalizeRange ? theRange.min - (theRange.min % step) : theRange.min;
    const maxRange = normalizeRange ? this._calcMaxRange(theRange.max, step) : theRange.max;

    return { maxRange, minRange };
  }

  getValuesAndRange(val, range) {
    const theValue = val || {};

    const { maxRange: theRangeMax, minRange: theRangeMin } = this._getRangeMinAndMax(range);

    let valMin = clsc(theValue.min, theRangeMin, 0);
    let valMax = clsc(theValue.max, theRangeMax);

    valMin = valMin < theRangeMin ? theRangeMin : valMin;
    valMax = valMax > theRangeMax ? theRangeMax : valMax;

    return {
      // TODO: properly handle and differentiate the case of single vs dual
      theValue: !nullish(theValue.min) && !nullish(theValue.max) ? [valMin, valMax] : theValue.min,
      theRange: {
        min: clsc(theRangeMin, 0),
        max: clsc(theRangeMax, 0),
      },
    };
  }

  componentDidMount() {
    const { val, range, step, connect } = this.props;
    const { theValue, theRange } = this.getValuesAndRange(val, range);

    noUiSlider.create(this.refs.range, {
      connect,
      start: nullish(theValue) ? ((connect === 'lower') ? 0 : [theRange.min, theRange.max]) : theValue, // eslint-disable-line
      range: theRange,
      step,
      format: {
        to: x => Math.round(x),
        from: x => Math.round(x),
      },
    });

    this.refs.range.noUiSlider.on('change', this.onChange);
  }

  componentWillReceiveProps(nextProps) {
    const nextPropsValue = nextProps.val || {};
    const { val = {}, range = {} } = this.props;

    if (val.min !== nextPropsValue.min || val.max !== nextPropsValue.max) {
      const { theValue } = this.getValuesAndRange(nextProps.val, range);
      this.refs.range.noUiSlider.set(theValue);
    }
  }

  // Listens to change on INPUT
  onInputChangeEvent = (val, type) => {
    let eventValue = Number(val);
    let value = 0;
    const targetValue = this.refs.range;

    if (isNaN(eventValue)) {
      eventValue = 0;
    }
    if (eventValue < this.props.range.min) {
      eventValue = this.props.range.min;
    }
    if (eventValue > this.props.range.max) {
      eventValue = this.props.range.max;
    }
    value = eventValue;

    if (this.refs.range && this.refs.range.noUiSlider) {
      this.refs.range.noUiSlider.set([type === 'min' ? value : this.state.min, type === 'max' ? value : this.state.max]);
    }
    if (targetValue === 'maxInput') {
      this.setState({ max: value });
    } else {
      this.setState({ min: value });
    }
  };

  @injectProps
  render({ title, range, val }) {
    // as invariant but just show a warning in case the predicate is false
    warning(title === undefined, '`title` prop is deprecated. Use `label` instead');
    val = val || {};
    range = range || {};

    const min = val.min;
    const max = val.max;
    const {
      className,
      label,
      input,
      id,
      errorMessage,
      formatValues,
      normalizeRange, // eslint-disable-line
      connect, // eslint-disable-line
      range: _range, // eslint-disable-line
      val: _val, // eslint-disable-line
      ...rest
    } = this.props;

    const valid = trim(errorMessage) === '';

    let formatValuesFn = formatValues;
    if (!formatValuesFn) {
      formatValuesFn = ({ min: _min, max: _max }) => `${_min} ${_max ? ' - ' : ''}  ${_max || ''}`;
    }

    const theId = clsc(id, this.id);
    const errorMessageId = `${theId}-err-msg`;
    const theLabel = toSentenceCase(trim(label) || trim(title));

    const { minRange, maxRange } = this._getRangeMinAndMax(range);

    const theMin = clsc(this.state.min, min, minRange, 0);
    const theMax = clsc(this.state.max, max, maxRange, 0);

    const labelC = theLabel ? (
      <label htmlFor={theId}>
        {theLabel}
        <span className={cf('current-value')}>{formatValuesFn({ min: theMin, max: theMax })}</span>
      </label>
    ) : null;

    const minInputField =
      input && val.min ? (
        <div className={cf('input-textbox')}>
          <TextBox
            placeholder="Min Value"
            value={this.state.min}
            min="{theMin}"
            max="{theMax}"
            onChange={({ value }) => this.onInputChangeEvent(value, 'min')}
          />
        </div>
      ) : null;
    const maxInputField =
      input && val.max ? (
        <div className={cf('input-textbox')}>
          <TextBox
            placeholder="Max Value"
            value={this.state.max}
            min="{theMin}"
            max="{theMax}"
            onChange={({ value }) => this.onInputChangeEvent(value, 'max')}
          />
        </div>
      ) : null;
    const hasSlider = className ? 'hasSlider' : null;

    const hasInput = input ? 'hasInput' : '';

    return (
      <div data-component="range-slider" id={theId} className={cf('range-slider', hasSlider, g(className))} {...rest}>
        {labelC}
        <div className={cf('range-field', hasInput)}>
          <div ref="range" />
        </div>
        {do {
          if (minInputField || maxInputField) {
            <div>
              {minInputField}
              {maxInputField}
            </div>;
          }
        }}
        {errorMessage && (
          <Validator id={errorMessageId} visible={!valid}>
            {errorMessage}
          </Validator>
        )}
      </div>
    );
  }
}
