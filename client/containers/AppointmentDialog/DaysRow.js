/*
 * Copyright (c) 2022 Reva Technology Inc., all rights reserved.
 * Unauthorized copying of this file, via any medium is strictly prohibited
 * Licensed under the Elastic License 2.0; you may not use this file except
 * in compliance with the Elastic License 2.0.
 */

import PropTypes from 'prop-types';
import React, { Component } from 'react';
import { IconButton, Typography } from 'components';
import WeekDay from './WeekDay';
import { locals as styles, cf } from './DaysRow.scss';
import { now, toMoment } from '../../../common/helpers/moment-utils';

const { Caption } = Typography;

export default class DaysRow extends Component {
  static propTypes = {
    onDayChanged: PropTypes.func,
    onChangePeriodNonSelectableDay: PropTypes.func,
    includeSaturdays: PropTypes.bool,
    includeSundays: PropTypes.bool,
    isDaySelectable: PropTypes.bool,
    preselectedDate: PropTypes.object,
    numberOfDays: PropTypes.number,
  };

  static defaultProps = {
    isDaySelectable: true,
    numberOfDays: 7,
    includeSaturdays: true,
    includeSundays: true,
  };

  constructor(props) {
    super(props);

    const { timezone, preselectedDate } = props;

    this.state = {
      selectedDate: (preselectedDate ? toMoment(preselectedDate, { timezone }) : now({ timezone })).startOf('day'),
    };
  }

  getPage = () => {
    const { selectedDate } = this.state;
    const { timezone, numberOfDays } = this.props;

    const selectedDay = toMoment(selectedDate, { timezone }).startOf('day');
    const today = now({ timezone }).startOf('day');
    const daysDiff = selectedDay.diff(today, 'days');

    return Math.floor(daysDiff / numberOfDays);
  };

  componentWillMount() {
    const page = this.getPage();
    this.goToPage(page);
  }

  selectDate = day => {
    const { timezone } = this.props;
    const { selectedDate } = this.state;

    if (toMoment(day, { timezone }).isSame(toMoment(selectedDate, { timezone }), 'day')) return;

    this.setState({ selectedDate: day });

    if (this.props.onDayChanged) {
      this.props.onDayChanged(day);
    }
  };

  goToPageOnSwitchBetweenNoOfDays() {
    const page = this.getPage();
    this.goToPage(page);
  }

  componentDidUpdate(prevProps) {
    if (prevProps.isDaySelectable !== this.props.isDaySelectable) this.goToPageOnSwitchBetweenNoOfDays();
  }

  goToPage(page) {
    const { isDaySelectable, numberOfDays } = this.props;
    const dateToSelect = this.getDateToSelectOnPage(page);
    if (isDaySelectable) {
      this.selectDate(dateToSelect);
    } else {
      const datesOnPage = this.getDatesOnPage(page);
      const periodStartDate = datesOnPage[0];
      this.setState({ periodStartDate, selectedDate: dateToSelect });
      this.props.onChangePeriodNonSelectableDay && this.props.onChangePeriodNonSelectableDay(periodStartDate, numberOfDays, dateToSelect);
    }

    this.setState({
      currentPage: page,
    });
  }

  getDateToSelectOnPage = page => {
    const datesOnPage = this.getDatesOnPage(page);
    return datesOnPage.find(date => date.day() === this.state.selectedDate.day()) || datesOnPage[0];
  };

  goToPreviousPage = () => {
    const previousPage = this.state.currentPage - 1;
    this.goToPage(previousPage);
  };

  goToNextPage = () => {
    const nextPage = this.state.currentPage + 1;
    this.goToPage(nextPage);
  };

  getDatesOnPage(page, numberOfDays = this.props.numberOfDays) {
    const { timezone } = this.props;
    const days = [];
    const today = now({ timezone });
    const firstDay = today.clone().add(page * numberOfDays, 'days');

    for (let i = 0; i < numberOfDays; ++i) {
      const day = firstDay.clone().add(i, 'days');

      if (!(day.day() === 0 && !this.props.includeSundays) && !(day.day() === 6 && !this.props.includeSaturdays)) {
        days.push(day);
      }
    }

    return days;
  }

  render() {
    const { timezone, isDaySelectable, numberOfDays } = this.props;
    const { selectedDate, periodStartDate } = this.state;

    const month = toMoment(isDaySelectable ? selectedDate : periodStartDate, { timezone }).format('MMMM YYYY');

    const daysOnPage = this.getDatesOnPage(this.state.currentPage);
    const isSelectedDate = this.isSameDay(this.state.selectedDate);

    const dayComponents = daysOnPage.map(day => (
      <WeekDay
        timezone={timezone}
        key={day.format()}
        date={day}
        isSelected={isSelectedDate(day)}
        onSelected={this.selectDate}
        isDaySelectable={isDaySelectable}
        useLongName={numberOfDays < 7}
      />
    ));

    return (
      <div className={styles.container}>
        <div className={styles.monthContainer}>
          <Caption secondary>{month}</Caption>
        </div>
        <div className={cf('daysContainer')}>
          {this.renderChevron('chevron-left', this.goToPreviousPage)}
          <div className={styles.daysRow}>{dayComponents}</div>
          {this.renderChevron('chevron-right', this.goToNextPage)}
        </div>
      </div>
    );
  }

  renderChevron(icon, handler) {
    return (
      <div>
        <IconButton onClick={handler} iconName={icon} className={cf('chevron')} dataId={icon} />
      </div>
    );
  }

  isSameDay(dayOne) {
    const { timezone } = this.props;
    const dayOneMoment = toMoment(dayOne, { timezone });

    return dayTwo => dayOneMoment.isSame(toMoment(dayTwo, { timezone }), 'day');
  }
}
