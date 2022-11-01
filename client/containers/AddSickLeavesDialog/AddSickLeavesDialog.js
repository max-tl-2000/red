/*
 * Copyright (c) 2022 Reva Technology Inc., all rights reserved.
 * Unauthorized copying of this file, via any medium is strictly prohibited
 * Licensed under the Elastic License 2.0; you may not use this file except
 * in compliance with the Elastic License 2.0.
 */

import PropTypes from 'prop-types';
import React, { Component } from 'react';
import { t } from 'i18next';
import { Dialog, DialogOverlay, Button, DialogActions, DialogHeader, TextBox, Dropdown } from 'components';
import { connect } from 'react-redux';
import { cf } from './AddSickLeavesDialog.scss';
import DateSelector from '../../components/DateSelector/DateSelector';

import { toMoment, now, findLocalTimezone } from '../../../common/helpers/moment-utils';
import CheckBox from '../../components/CheckBox/CheckBox';
import { TIME_MERIDIEM_FORMAT, MONTH_DATE_YEAR_LONG_FORMAT } from '../../../common/date-constants';

const fieldConstants = {
  ALL_DAY: 'allDay',
  END_DATE: 'endDate',
  END_TIME: 'endTime',
  NOTES: 'notes',
  START_DATE: 'startDate',
  START_TIME: 'startTime',
};

@connect(() => ({
  timezone: findLocalTimezone(),
}))
export class AddSickLeavesDialog extends Component {
  constructor(props) {
    super(props);
    const { timezone } = this.props;
    const startDate = now({ timezone }).startOf('day');
    const endDate = startDate.clone().endOf('day');

    const startTimeValues = this.getTimeDropdownValues();
    this.state = { startDate, endDate, details: '', notes: '', allDay: false, startTimeValues, endTimeValues: startTimeValues };
  }

  static propTypes = {
    id: PropTypes.string,
    open: PropTypes.bool,
    onClose: PropTypes.func,
    selectedAgent: PropTypes.object,
  };

  static defaultProps = {
    open: false,
  };

  setTimeToDateObject = (dateObject, timeObject) =>
    dateObject.set({
      hour: timeObject.get('hour'),
      minute: timeObject.get('minute'),
      second: timeObject.get('second'),
      millisecond: timeObject.get('millisecond'),
    });

  getNewState = (newState, shouldResetEndDateAndTime) => {
    if (shouldResetEndDateAndTime) {
      return { ...newState, endDate: null, selectedEndTime: null };
    }

    return newState;
  };

  shouldResetEndDateAndTime = startDate => toMoment(this.state.endDate).isSameOrBefore(startDate);

  handleFieldChange = (field, value) => {
    switch (field) {
      case fieldConstants.START_DATE: {
        const shouldResetEndDateAndTime = this.shouldResetEndDateAndTime(value);
        const newState = this.getNewState(
          {
            startDate: value,
            selectedStartTime: null,
          },
          shouldResetEndDateAndTime,
        );
        this.setState(newState);
        break;
      }
      case fieldConstants.START_TIME: {
        const { startDate, endDate } = this.state;
        const newStartDate = this.setTimeToDateObject(startDate, value);
        const endTimeValues = this.getTimeDropdownValues(startDate, endDate);
        const shouldResetEndDateAndTime = this.shouldResetEndDateAndTime(startDate);
        const newState = this.getNewState(
          {
            startDate: newStartDate,
            selectedStartTime: value.format(TIME_MERIDIEM_FORMAT),
            endTimeValues,
          },
          shouldResetEndDateAndTime,
        );
        this.setState(newState);

        break;
      }
      case fieldConstants.END_DATE: {
        const { startDate } = this.state;
        const endTimeValues = this.getTimeDropdownValues(startDate, value);
        const endDate = value && value.clone().endOf('day');
        const newState = {
          endDate,
          selectedEndTime: null,
          endTimeValues,
        };
        this.setState(newState);
        break;
      }
      case fieldConstants.END_TIME: {
        const { endDate } = this.state;
        const newEndDate = this.setTimeToDateObject(endDate, value);
        const newState = {
          endDate: newEndDate,
          selectedEndTime: value.format(TIME_MERIDIEM_FORMAT),
        };
        this.setState(newState);

        break;
      }
      case fieldConstants.ALL_DAY: {
        const { allDay } = this.state;
        const newState = { allDay: !allDay };

        if (!value) {
          newState.selectedStartTime = null;
          newState.selectedEndTime = null;
        }
        this.setState(newState);
        break;
      }
      default:
        this.setState({
          [field]: value,
        });
    }
  };

  getTimeDropdownValues = (startDate, endDate) => {
    const nowDate = now({ timezone: this.props.timezone });
    // End time should be greater than the start time
    const endDateSameDayAsStartDate = startDate && endDate && toMoment(endDate).isSame(startDate, 'day');

    let time = endDateSameDayAsStartDate ? startDate.clone().add(30, 'minute') : nowDate.startOf('day');
    const endTime = time.clone().endOf('day');
    const values = [];

    while (time <= endTime) {
      const timeFormatted = time.format(TIME_MERIDIEM_FORMAT);
      values.push({ id: timeFormatted, text: timeFormatted, time: time.clone() });

      time = time.add(30, 'm');
    }

    return values;
  };

  onHandleSave = () => {
    const { startDate, endDate: end, notes, allDay } = this.state;
    const { timezone, selectedAgent, onSave } = this.props;

    /*
      In case of an all day sick leave on the backend side the end date
      must be on the following day of the last sick day at 12 AM
    */
    const endDate = allDay ? end.clone().add(1, 'day').startOf('day') : end;

    const sickLeave = { startDate, endDate, timezone, userId: selectedAgent.id, notes };
    onSave(sickLeave);
  };

  isSaveDisabled = () => {
    const { allDay, selectedStartTime, selectedEndTime, startDate, endDate } = this.state;

    const isTimeSelected = selectedStartTime && selectedEndTime;
    const isDateSelected = startDate && endDate;

    return (!allDay && !isTimeSelected) || !isDateSelected;
  };

  render() {
    const { id, open, onClose, timezone } = this.props;
    const { startDate, endDate, details, allDay, startTimeValues, endTimeValues } = this.state;
    const datePickerMin = now({ timezone }).startOf('day');

    return (
      <Dialog open={open} id={id} forceFocusOnDialog closeOnEscape onClose={onClose}>
        <DialogOverlay className={cf('add-sick-leave-dialog')} container={false}>
          <DialogHeader title={t('ADD_SICK_LEAVE')} />
          <div className={cf('start-wrapper')}>
            <DateSelector
              id="sickLeaveStartDateTxt"
              className={cf('date-selector')}
              wide
              zIndex={150}
              appendToBody
              selectedDate={startDate}
              min={datePickerMin}
              tz={timezone}
              format={MONTH_DATE_YEAR_LONG_FORMAT}
              onChange={value => this.handleFieldChange(fieldConstants.START_DATE, value)}
              label={t('START_DATE')}
            />
            <Dropdown
              placeholder={t('TIME')}
              className={cf('time-selector')}
              items={startTimeValues}
              selectedValue={this.state.selectedStartTime}
              disabled={this.state.allDay || !startDate}
              onChange={value => {
                this.handleFieldChange(fieldConstants.START_TIME, value.item.time);
              }}
            />
          </div>
          <div className={cf('end-wrapper')}>
            <DateSelector
              id="sickLeaveEndDateTxt"
              className={cf('date-selector')}
              wide
              zIndex={150}
              appendToBody
              selectedDate={endDate}
              min={startDate}
              tz={timezone}
              format={MONTH_DATE_YEAR_LONG_FORMAT}
              onChange={value => this.handleFieldChange(fieldConstants.END_DATE, value)}
              label={t('END_DATE')}
            />
            <Dropdown
              placeholder={t('TIME')}
              className={cf('time-selector')}
              items={endTimeValues}
              selectedValue={this.state.selectedEndTime}
              disabled={this.state.allDay || !endDate}
              onChange={value => {
                this.handleFieldChange(fieldConstants.END_TIME, value.item.time);
              }}
            />
          </div>
          <CheckBox
            className={cf('checkbox')}
            label={t('ALL_DAY_EVENT')}
            checked={allDay}
            onChange={value => this.handleFieldChange(fieldConstants.ALL_DAY, value)}
          />
          <TextBox
            label={t('DETAILS')}
            value={details}
            onBlur={(e, { value }) => this.handleFieldChange(fieldConstants.NOTES, value)}
            multiline
            numRows={3}
            autoResize={false}
            className={cf('form-element')}
          />
          <DialogActions>
            <Button type="flat" btnRole="secondary" id="closeButton" onClick={onClose} label={t('CLOSE')} />
            <Button type="flat" id="saveButton" onClick={this.onHandleSave} label={t('SAVE_BUTTON')} disabled={this.isSaveDisabled()} />
          </DialogActions>
        </DialogOverlay>
      </Dialog>
    );
  }
}
