/*
 * Copyright (c) 2022 Reva Technology Inc., all rights reserved.
 * Unauthorized copying of this file, via any medium is strictly prohibited
 * Licensed under the Elastic License 2.0; you may not use this file except
 * in compliance with the Elastic License 2.0.
 */

import PropTypes from 'prop-types';
import React, { Component } from 'react';
import { t } from 'i18next';

import { locals as styles, cf } from './DaysRow.scss';
import { toMoment, now } from '../../../common/helpers/moment-utils';

export default class WeekDay extends Component {
  static propTypes = {
    isDaySelectable: PropTypes.bool,
    onSelected: PropTypes.func.isRequired,
    isSelected: PropTypes.bool.isRequired,
    date: PropTypes.object.isRequired,
    useLongName: PropTypes.bool,
  };

  constructor(props) {
    super(props);

    this.daysOfWeek = [
      t('DATETIME_DAYSOFWEEK_SUNDAY_SHORT'),
      t('DATETIME_DAYSOFWEEK_MONDAY_SHORT'),
      t('DATETIME_DAYSOFWEEK_TUESDAY_SHORT'),
      t('DATETIME_DAYSOFWEEK_WEDNESDAY_SHORT'),
      t('DATETIME_DAYSOFWEEK_THURSDAY_SHORT'),
      t('DATETIME_DAYSOFWEEK_FRIDAY_SHORT'),
      t('DATETIME_DAYSOFWEEK_SATURDAY_SHORT'),
    ];
  }

  getDayName = date => {
    const { useLongName, timezone } = this.props;
    if (useLongName) return toMoment(date, { timezone }).format('ddd');
    return this.daysOfWeek[date.day()];
  };

  handleClick = () => {
    this.props.onSelected(this.props.date);
  };

  render() {
    const { date: day, timezone, isSelected, isDaySelectable } = this.props;

    const dayStyles = {
      past: toMoment(day, { timezone }).isBefore(now({ timezone }), 'day'),
      today: toMoment(day, { timezone }).isSame(now({ timezone }), 'day'),
      future: toMoment(day, { timezone }).isAfter(now({ timezone }), 'day'),
    };

    return (
      <div
        data-component="weekDay"
        className={cf('dayContainer', { pointer: isDaySelectable })}
        onClick={isDaySelectable && this.handleClick}
        data-id={`weekDay-${day.date()}`}>
        <div className={cf('dayName', dayStyles)}>{this.getDayName(day)}</div>
        <div className={cf('dayDate', dayStyles)}>{day.date()}</div>
        {isSelected && isDaySelectable && <div className={styles.daySelectedMarker} />}
      </div>
    );
  }
}
