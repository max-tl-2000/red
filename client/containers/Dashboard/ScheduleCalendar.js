/*
 * Copyright (c) 2022 Reva Technology Inc., all rights reserved.
 * Unauthorized copying of this file, via any medium is strictly prohibited
 * Licensed under the Elastic License 2.0; you may not use this file except
 * in compliance with the Elastic License 2.0.
 */

import PropTypes from 'prop-types';
import React, { Component } from 'react';
import { bindActionCreators } from 'redux';
import { connect } from 'react-redux';
import { t } from 'i18next';
import { loadTasks } from 'redux/modules/schedule';

import { GeminiScrollbar, PreloaderBlock } from 'components';
import { Text, Caption } from 'components/Typography/Typography';
import debounce from 'debouncy';
import { observer, inject } from 'mobx-react';
import { TWELVE_HOUR_TIME_FORMAT, DATE_ONLY_FORMAT } from '../../../common/date-constants';
import { locals as styles, cf } from './ScheduleCalendar.scss';
import { toMoment, now, findLocalTimezone } from '../../../common/helpers/moment-utils';

const sortTasksByTime = (a, b) => (toMoment(a.metadata.startDate).diff(toMoment(b.metadata.startDate)) > 0 ? 1 : -1);

@connect(
  state => state.schedule,
  dispatch =>
    bindActionCreators(
      {
        loadTasks,
      },
      dispatch,
    ),
)
@inject('leasingNavigator')
@observer
export default class ScheduleCalendar extends Component {
  static propTypes = {
    loadTasks: PropTypes.func.isRequired,
    loadingOverview: PropTypes.bool.isRequired,
    loadingTasks: PropTypes.bool.isRequired,
    tasksByDay: PropTypes.object.isRequired,
    daysWithTasks: PropTypes.arrayOf(PropTypes.string).isRequired,
    users: PropTypes.arrayOf(PropTypes.object),
    isTeam: PropTypes.bool,
  };

  constructor(props) {
    super(props);

    this.state = {
      visibleMomentInDaysRow: null,
    };

    const THRESHOLD_TO_SCROLL = 32;
    this.onTasksScroll = debounce(this.onTasksScroll, THRESHOLD_TO_SCROLL, this);
  }

  componentDidMount() {
    this.refs.tasksGeminiScrollbar && this.refs.tasksGeminiScrollbar.getViewElement().addEventListener('scroll', this.onTasksScroll);
  }

  componentWillUnmount() {
    this.refs.tasksGeminiScrollbar && this.refs.tasksGeminiScrollbar.getViewElement().removeEventListener('scroll', this.onTasksScroll);
  }

  componentDidUpdate(prevProps) {
    if (this.refs.tasksGeminiScrollbar) {
      const tasksScrollView = this.refs.tasksGeminiScrollbar.getViewElement();

      tasksScrollView.removeEventListener('scroll', this.onTasksScroll);
      tasksScrollView.addEventListener('scroll', this.onTasksScroll);
    }

    if (!prevProps.daysWithTasks.length && this.props.daysWithTasks.length) {
      const nowDate = now();

      const possibleDates = this.props.daysWithTasks
        .filter(day => {
          const dayAsMoment = toMoment(day);
          return nowDate.diff(dayAsMoment, 'days') <= 0;
        })
        .sort((a, b) => (toMoment(a).diff(toMoment(b)) > 0 ? 1 : -1));

      const dayToSelect = possibleDates[0] || this.props.daysWithTasks[0];

      if (dayToSelect) {
        const headerToSelect = this.refs.tasksGeminiScrollbar.getViewElement().querySelector(`.${styles.header}[data-day='${dayToSelect}']`);
        headerToSelect.scrollIntoView({ behavior: 'smooth' });
      }
    }
  }

  onTasksScroll() {
    const tasksScrollview = this.refs.tasksGeminiScrollbar.getViewElement();
    const daysScrollView = this.refs.daysGeminiScrollbar.getViewElement();

    const headers = tasksScrollview.querySelectorAll(`.${styles.header}`);
    const headersArray = Array.prototype.slice.call(headers, 0);

    let pinnedDay = null;
    headersArray.forEach(header => {
      if (header.offsetTop <= tasksScrollview.scrollTop) {
        pinnedDay = header.getAttribute('data-day');
        header.classList.add(styles.fixed);
      } else {
        header.classList.remove(styles.fixed);
      }
    });
    const headerElement = daysScrollView.querySelector(`div[data-day='${pinnedDay}'`);
    if (headerElement) {
      daysScrollView.scrollLeft = headerElement.offsetLeft;
      const prevSelected = daysScrollView.querySelector('[data-selected="true"]');
      prevSelected && prevSelected.removeAttribute('data-selected');
      headerElement.setAttribute('data-selected', 'true');
    }

    if (tasksScrollview.lastChild.offsetTop <= tasksScrollview.scrollTop + tasksScrollview.clientHeight) {
      // waypoint became visible;
      if (!this.props.loadingTasks) {
        const daysToLoad = this.props.daysWithTasks.filter(day => !this.props.tasksByDay[day]).slice(0, 10);

        if (daysToLoad.length) {
          this.props.loadTasks(daysToLoad, findLocalTimezone());
        }
      }
    }
  }

  onTaskClick = e => {
    const partyId = e.currentTarget.getAttribute('data-party-id');
    const appointmentId = e.currentTarget.getAttribute('data-appointment-id');
    const { props } = this;
    const { leasingNavigator } = props;

    leasingNavigator.navigateToParty(partyId, { appointmentId });
  };

  render() {
    if (this.props.loadingOverview) {
      return (
        <div className={styles.container}>
          <PreloaderBlock />
        </div>
      );
    }

    const loadedAllTasks = this.props.daysWithTasks.length === Object.keys(this.props.tasksByDay).length;

    return (
      <div className={styles.container}>
        {this.renderDaysRow()}
        <div className={styles.tasks}>
          <GeminiScrollbar ref="tasksGeminiScrollbar">
            {this.renderTasks()}
            <div className={styles.waypoint}>
              {this.props.loadingTasks && <span>{t('SCHEDULE_CALENDAR_LOADING_TASKS')}</span>}
              {loadedAllTasks && <span>{t('SCHEDULE_CALENDAR_NO_MORE_TASKS')}</span>}
            </div>
          </GeminiScrollbar>
        </div>
      </div>
    );
  }

  scrollToDay = dayFormatted => {
    const tasksScrollview = this.refs.tasksGeminiScrollbar.getViewElement();
    const dayToScrollTo = tasksScrollview.querySelector(`[data-day="${dayFormatted}"]`);

    if (dayToScrollTo) {
      dayToScrollTo.scrollIntoView({ behavior: 'smooth' });
    }
  };

  renderDaysRow({ daysWithTasks } = this.props) {
    const dayNames = [
      t('DATETIME_DAYSOFWEEK_MONDAY_SHORT'),
      t('DATETIME_DAYSOFWEEK_TUESDAY_SHORT'),
      t('DATETIME_DAYSOFWEEK_WEDNESDAY_SHORT'),
      t('DATETIME_DAYSOFWEEK_THURSDAY_SHORT'),
      t('DATETIME_DAYSOFWEEK_FRIDAY_SHORT'),
      t('DATETIME_DAYSOFWEEK_SATURDAY_SHORT'),
      t('DATETIME_DAYSOFWEEK_SUNDAY_SHORT'),
    ];

    const days = [];
    let day = now();

    if (day.isAfter(toMoment(daysWithTasks[0]), 'day')) {
      day = toMoment(daysWithTasks[0]);
    }

    while (days) {
      const classes = cf('day', {
        today: day.isSame(now(), 'day'),
        withTasks: daysWithTasks.indexOf(day.format(DATE_ONLY_FORMAT)) >= 0,
      });

      const dayFormatted = day.format(DATE_ONLY_FORMAT);
      days.push(
        <div className={styles.dayWrapper} key={dayFormatted} data-day={dayFormatted} onClick={() => this.scrollToDay(dayFormatted)}>
          <div className={classes}>
            <div className={styles.name}>{dayNames[day.isoWeekday() - 1]}</div>
            <div className={styles.date}>{day.date()}</div>
            <div className={styles.bullet} />
          </div>
        </div>,
      );

      if (daysWithTasks.length === 0) {
        break;
      }

      if (daysWithTasks[daysWithTasks.length - 1] === day.format(DATE_ONLY_FORMAT)) {
        break;
      }

      day = day.add(1, 'days');
    }

    const selectedMoment = this.state.visibleMomentInDaysRow || now();
    const selectedMonth = selectedMoment.format('MMMM YYYY');

    return (
      <div>
        <div className={styles.month}>{selectedMonth}</div>
        <div className={styles.days}>
          <GeminiScrollbar ref="daysGeminiScrollbar">{days}</GeminiScrollbar>
        </div>
        <div className={styles.separator} />
      </div>
    );
  }

  renderTasks({ daysWithTasks } = this.props) {
    const tasks = [];

    daysWithTasks.forEach(day => {
      if (!this.props.tasksByDay[day]) {
        return;
      }

      const isSameAsToday = toMoment(day).isSame(now(), 'day');

      const headerClassNames = cf('header');
      const datesStyles = isSameAsToday ? { color: '#2196f3' } : {};

      tasks.push(
        <div key={`header-${day}`} data-day={day} className={headerClassNames}>
          <Text inline secondary={!isSameAsToday} noDefaultColor={isSameAsToday} style={datesStyles}>
            {this.getHeaderTitle(day)}
            <Caption secondary>
              {t('APPOINMENT_COUNT', {
                count: this.props.tasksByDay[day].length,
              })}
            </Caption>
          </Text>
        </div>,
      );

      const tasksSortedByTime = this.props.tasksByDay[day].sort(sortTasksByTime);

      tasksSortedByTime.forEach(task => {
        const endMoment = toMoment(task.metadata.endDate);

        const start = toMoment(task.metadata.startDate).format(TWELVE_HOUR_TIME_FORMAT);
        const startAmPm = toMoment(task.metadata.startDate).format('A');

        const end = endMoment.format(TWELVE_HOUR_TIME_FORMAT);
        const endAmPm = endMoment.format('A');

        const isInThePast = now().diff(endMoment) > 0;

        const timeslot = startAmPm === endAmPm ? `${start} - ${end} ${endAmPm}` : `${start} ${startAmPm} - ${end} ${endAmPm}`;

        if (!task.userIds || !task.userIds.length) {
          throw new Error('userIds must be a non empty array');
        }

        const theUser = this.props.users.find(user => user.id === task.userIds[0]);
        if (!theUser) {
          throw new Error(`Cannot find user with id: ${task.userIds[0]}`);
        }

        const taskOwner = this.props.isTeam ? ` | ${theUser.fullName}` : '';

        tasks.push(
          <div
            key={`task-${task.id}`}
            className={cf('task', { complete: task.isComplete, isInThePast })}
            onClick={this.onTaskClick}
            data-party-id={task.partyId}
            data-appointment-id={task.id}>
            <div className={styles.left}>
              <div className={styles.guests}>{task.guests.join(', ')}</div>
              <div className={styles.units}>{`${task.units.map(u => u.unitFullQualifiedName).join(', ') || t('SCHEDULE_CALENDAR_NO_UNITS')}${taskOwner}`}</div>
            </div>
            <div className={styles.right}>{timeslot}</div>
          </div>,
        );
      });
    });

    return tasks;
  }

  getHeaderTitle(day) {
    let displayFormat = 'SCHEDULE_CALENDAR_TASKS_DAY_HEADER_TITLE_DEFAULT';
    const appointmentMoment = toMoment(day);

    const today = now();
    if (today.isSame(appointmentMoment, 'days')) {
      displayFormat = 'SCHEDULE_CALENDAR_TASKS_DAY_HEADER_TITLE_FOR_TODAY';
    }

    const tomorrow = now().add(1, 'days');
    if (tomorrow.isSame(appointmentMoment, 'days')) {
      displayFormat = 'SCHEDULE_CALENDAR_TASKS_DAY_HEADER_TITLE_FOR_TOMORROW';
    }

    return appointmentMoment.format(t(displayFormat));
  }
}
