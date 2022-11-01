/*
 * Copyright (c) 2022 Reva Technology Inc., all rights reserved.
 * Unauthorized copying of this file, via any medium is strictly prohibited
 * Licensed under the Elastic License 2.0; you may not use this file except
 * in compliance with the Elastic License 2.0.
 */

import PropTypes from 'prop-types';
import React, { Component } from 'react';
import trim from 'helpers/trim';
import { observable, action, computed } from 'mobx';
import { observer } from 'mobx-react';
import { cf, g } from './DateRange.scss';
import DateSelector from './DateSelector';
import Validator from '../Validator/Validator';
import Field from '../Form/Field';
import Caption from '../Typography/Caption';
import { isSameDay } from '../../../common/helpers/moment-utils';

class DateRangeModel {
  @observable
  from;

  @observable
  to;

  @action
  updateDateFrom(from) {
    this.from = from;
  }

  @action
  updateDateTo(to) {
    this.to = to;
  }

  @computed
  get value() {
    return {
      from: this.from,
      to: this.to,
    };
  }

  @action
  update(args) {
    if ('from' in args) {
      this.updateDateFrom(args.from);
    }
    if ('to' in args) {
      this.updateDateTo(args.to);
    }
  }

  constructor({ from, to } = {}) {
    this.update({ from, to });
  }
}

@observer
export default class DateRange extends Component {
  constructor(props, context) {
    super(props, context);
    const value = props.value || {};

    this.model = new DateRangeModel(value);
  }

  static propTypes = {
    id: PropTypes.string,
    label: PropTypes.string,
    lblFrom: PropTypes.string,
    lblTo: PropTypes.string,
    errorMessage: PropTypes.string,
    className: PropTypes.string,
    value: PropTypes.shape({
      from: PropTypes.object,
      to: PropTypes.object,
    }),
    onChange: PropTypes.func,
    disabled: PropTypes.bool,
    format: PropTypes.string,
  };

  static defaultProps = {
    format: 'MMMM DD, YYYY',
  };

  raiseChange() {
    const {
      model: { value },
      props,
    } = this;
    const { onChange } = props;

    onChange && onChange({ value });
  }

  @action
  handleFromChange = value => {
    this.model.updateDateFrom(value);
    this.raiseChange();
  };

  @action
  handleToChange = value => {
    this.model.updateDateTo(value);

    this.raiseChange();
  };

  componentWillReceiveProps(nextProps) {
    if ('value' in nextProps) {
      let { value: nextValue } = nextProps;

      if (!nextValue) {
        nextValue = { from: undefined, to: undefined };
      }

      const { value } = this.model;
      let state;

      if (value.from !== nextValue.from && !isSameDay(value.from, nextValue.from, { timezone: nextProps.tz })) {
        state = { from: nextValue.from };
      }

      if (value.to !== nextValue.to && !isSameDay(value.to, nextValue.to, { timezone: nextProps.tz })) {
        state = state || {};
        state.to = nextValue.to;
      }

      state && this.model.update(state);
    }
  }

  render() {
    const { className, lblFrom, lblTo, label, id, disabled, format, errorMessage, wide, tz, ...rest } = this.props;

    const valid = trim(errorMessage) === '';

    const errorMessageId = `${id}-err-msg`;
    const theLabel = trim(label);

    const labelC = theLabel ? (
      <label htmlFor={id}>
        <Caption secondary>{theLabel}</Caption>
      </label>
    ) : null;

    const pickerProps = {
      disabled,
      format,
      tz,
    };

    return (
      <div id={id} data-component="date-range-picker" className={cf('dateRange', { wide }, g(className))} {...rest}>
        {labelC}
        <Field columns={6} inline>
          <DateSelector wide {...pickerProps} placeholder={lblFrom} selectedDate={this.model.from} max={this.model.to} onChange={this.handleFromChange} />
        </Field>
        <Field columns={6} inline last>
          <DateSelector wide {...pickerProps} placeholder={lblTo} selectedDate={this.model.to} min={this.model.from} onChange={this.handleToChange} />
        </Field>
        {errorMessage && (
          <Validator id={errorMessageId} visible={!valid}>
            {errorMessage}
          </Validator>
        )}
      </div>
    );
  }
}
