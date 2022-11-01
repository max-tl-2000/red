/*
 * Copyright (c) 2022 Reva Technology Inc., all rights reserved.
 * Unauthorized copying of this file, via any medium is strictly prohibited
 * Licensed under the Elastic License 2.0; you may not use this file except
 * in compliance with the Elastic License 2.0.
 */

/* eslint-disable react/no-multi-comp */
import React, { Component } from 'react';
import { storiesOf } from '@storybook/react';
import Field from 'components/Form/Field';
import * as T from 'components/Typography/Typography';
import DateSelector from 'components/DateSelector/DateSelector';
import DateRange from 'components/DateSelector/DateRange';
import Block from '../helpers/Block';
import { now } from '../../common/helpers/moment-utils';

const getDateSelectorClass = ({ disabled, disabledDates, min, max } = {}) => {
  const isDateInThePast = day => {
    const today = now({ timezone: 'America/Los_Angeles' });
    return day.isBefore(today, 'day');
  };

  const isDateDisabled = disabledDates ? isDateInThePast : undefined;
  class Wrapper extends Component {
    state = {
      value: undefined,
    };

    handleChange = value => {
      this.setState({ value });
    };

    render() {
      const { value } = this.state;
      return (
        <Block>
          <T.FormattedBlock>
            <T.Title>DateSelector with label and placeholder</T.Title>
          </T.FormattedBlock>
          <Field inline columns={12} last>
            <DateSelector
              label="Start date"
              placeholder="Select a date"
              tz={'America/Los_Angeles'}
              selectedDate={value}
              min={min}
              max={max}
              isDateDisabled={isDateDisabled}
              onChange={this.handleChange}
              disabled={disabled}
            />
          </Field>
          <T.FormattedBlock>
            <T.Text>The selected value will be shown here</T.Text>
          </T.FormattedBlock>
          <Field>
            <pre>
              <code>{value ? value.format() : '--'}</code>
            </pre>
          </Field>
        </Block>
      );
    }
  }

  return Wrapper;
};

const SimpleDateSelector = getDateSelectorClass();
const DisabledDateSelector = getDateSelectorClass({ disabled: true });
const DateSelectorDisabledDates = getDateSelectorClass({ disabledDates: true });

const DateSelectorMinDate = getDateSelectorClass({
  min: now({ timezone: 'America/Los_Angeles' }).subtract(2, 'days').startOf('day'),
});

const DateSelectorMaxDate = getDateSelectorClass({
  max: now({ timezone: 'America/Los_Angeles' }).add(3, 'days').startOf('day'),
});

const DateSelectorMinMaxDate = getDateSelectorClass({
  min: now({ timezone: 'America/Los_Angeles' }).subtract(2, 'days').startOf('day'),
  max: now({ timezone: 'America/Los_Angeles' }).add(3, 'days').startOf('day'),
});

class DateRangeWrapper extends Component {
  state = {};

  handleChange = ({ value }) => {
    this.setState({ value });
  };

  render() {
    return (
      <div style={{ width: 450, padding: 20 }}>
        <DateRange wide label="Select a range" value={this.state.value} onChange={this.handleChange} />
        <div>{JSON.stringify(this.state.value)}</div>
      </div>
    );
  }
}

storiesOf('DateSelector', module)
  .addWithInfo('DateSelector', 'Simple', () => <SimpleDateSelector />, {
    propTables: [DateSelector],
  })
  .addWithInfo('DateSelector disabled', 'Disabled', () => <DisabledDateSelector />, {
    propTables: [DateSelector],
  })
  .addWithInfo('DateSelector dates disabled', 'DateSelector with dates disabled', () => <DateSelectorDisabledDates />, {
    propTables: [DateSelector],
  })
  .addWithInfo('DateSelector min', 'min prop', () => <DateSelectorMinDate />, {
    propTables: [DateSelector],
  })
  .addWithInfo('DateSelector max', 'max prop', () => <DateSelectorMaxDate />, {
    propTables: [DateSelector],
  })
  .addWithInfo('DateSelector min/max', 'min/max props', () => <DateSelectorMinMaxDate />, {
    propTables: [DateSelector],
  })
  .addWithInfo('DateRange Selector', 'DateRange Selector', () => <DateRangeWrapper />);
