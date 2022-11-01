/*
 * Copyright (c) 2022 Reva Technology Inc., all rights reserved.
 * Unauthorized copying of this file, via any medium is strictly prohibited
 * Licensed under the Elastic License 2.0; you may not use this file except
 * in compliance with the Elastic License 2.0.
 */

import { observable, computed, action } from 'mobx';
import { isNumber } from 'helpers/type-of';
import { createLRU } from 'lru2';
import { findLocalTimezone, isMoment, now, toMoment, parseAsInTimezone, isSameDay } from '../../../common/helpers/moment-utils';

export const getRange = (min, max, mapItem) => {
  const range = [];
  let initial = min;

  while (initial <= max) {
    const itemToPush = mapItem ? mapItem(initial) : initial;
    range.push(itemToPush);
    initial++;
  }
  return range;
};

export class DateSelectorModel {
  @observable
  navigationDate;

  @observable
  selectedDate;

  @observable
  temporarySelectedDate;

  @observable
  minSelectableYear = 1900;

  @observable
  maxSelectableYear = 2040;

  @observable
  isDateDisabled;

  @observable
  min;

  @observable
  max;

  @observable
  enableSetDateOverlappingLimits;

  @observable
  originalSelectedDate;

  monthAndYearPattern = 'MMMM YYYY';

  @observable
  _tz;

  @computed
  get tz() {
    return this._tz || findLocalTimezone();
  }

  constructor({ selectedDate, tz, isDateDisabled, min, max, enableSetDateOverlappingLimits } = {}) {
    this._tz = tz;

    this.yearsCache = createLRU({ limit: 1 });
    if (isMoment(selectedDate) && selectedDate.isValid()) {
      selectedDate = selectedDate.clone().tz(this.tz);
    }

    this.originalSelectedDate = selectedDate;
    this.selectedDate = selectedDate;

    if (!selectedDate) {
      selectedDate = now({ timezone: this.tz }).startOf('day');
    }

    if (!isMoment(selectedDate)) {
      throw new Error('selectedDate should be a moment instance');
    }

    if (!selectedDate.isValid()) {
      throw new Error('invalid moment provided');
    }

    this.temporarySelectedDate = selectedDate;
    this.navigationDate = selectedDate.clone();
    this.isDateDisabled = isDateDisabled;
    this.min = min;
    this.max = max;
    this.enableSetDateOverlappingLimits = enableSetDateOverlappingLimits;
  }

  @action
  setMin(min) {
    this.min = min;
  }

  @action
  setMax(max) {
    this.max = max;
  }

  @action
  setIsDateDisabledFn(isDateDisabled) {
    this.isDateDisabled = isDateDisabled;
  }

  @action
  setTz(tz) {
    this._tz = tz;
  }

  @action
  clearDate() {
    const { tz } = this;

    this.selectedDate = null;
    this.temporarySelectedDate = now({ timezone: tz });
  }

  @action
  setSelectedDate(selectedDate) {
    const { tz } = this;

    if (isMoment(selectedDate) && selectedDate.isValid()) {
      selectedDate = selectedDate.clone().tz(tz);
    }

    this.selectedDate = selectedDate;

    if (!selectedDate) {
      selectedDate = now({ timezone: tz });
    }

    if (!isMoment(selectedDate)) {
      throw new Error('selectedDate should be a moment instance');
    }

    if (!selectedDate.isValid()) {
      throw new Error('invalid moment provided');
    }

    if (tz) {
      selectedDate = selectedDate.clone().tz(tz);
    }

    this.temporarySelectedDate = selectedDate;
    this.navigationDate = selectedDate.clone();
  }

  @computed
  get theSelectedDate() {
    const { tz, temporarySelectedDate, selectedDate } = this;
    return temporarySelectedDate || selectedDate || now({ timezone: tz });
  }

  @action
  commitSelection() {
    const { temporarySelectedDate } = this;
    if (!temporarySelectedDate) return;

    const selectedDate = temporarySelectedDate.clone();

    if (this.shouldDateBeDisabled(selectedDate)) return;

    this.selectedDate = selectedDate;

    this.temporarySelectedDate = null;
  }

  @action
  clearTemporarySelection() {
    this.temporarySelectedDate = null;
  }

  @computed
  get availableYears() {
    const { minSelectableYear, maxSelectableYear, yearsCache } = this;
    const id = `${minSelectableYear}_${maxSelectableYear}`;
    let cachedRange = yearsCache.get(id);

    if (!cachedRange) {
      cachedRange = getRange(minSelectableYear, maxSelectableYear, year => ({ id: year, text: year }));
      yearsCache.set(id, cachedRange);
    }

    return cachedRange;
  }

  @computed
  get selectedDayOfWeekMonthAndDate() {
    return this.theSelectedDate.format('ddd, MMM D');
  }

  @computed
  get selectedYear() {
    return this.theSelectedDate.year();
  }

  get navigationYear() {
    return this.navigationDate.year();
  }

  @computed
  get navigationDay() {
    return this.navigationDate.date();
  }

  @computed
  get navigationMonthNameAndYear() {
    return this.navigationDate.format(this.monthAndYearPattern);
  }

  @computed
  get navigationMonth() {
    return this.navigationDate.month();
  }

  @action
  nextMonth() {
    this.navigationDate = this.navigationDate.clone().startOf('month').add(1, 'month');
  }

  @action
  prevMonth() {
    this.navigationDate = this.navigationDate.clone().startOf('month').subtract(1, 'month');
  }

  @action
  nextYear() {
    this.navigationDate = this.navigationDate.clone().startOf('year').add(1, 'year');
  }

  @action
  prevYear() {
    this.navigationDate = this.navigationDate.clone().startOf('year').subtract(1, 'year');
  }

  @action
  setYear(year) {
    if (!isNumber(year)) return;

    const navigationDate = this.theSelectedDate.clone().year(year);

    this.focusDate(navigationDate);
  }

  @action
  moveDateByOffset(offset) {
    const { theSelectedDate, navigationDate } = this;
    if (!navigationDate.isSame(theSelectedDate, 'month')) {
      this.focusDate(navigationDate.clone().startOf('month'));
      return;
    }
    this.focusDate(theSelectedDate.clone().add(offset, 'days'));
  }

  @action
  focusDate(date) {
    this.temporarySelectedDate = date;
    this.navigationDate = date;
  }

  shouldDateBeDisabled = date => {
    const { isDateDisabled, min, max, tz, enableSetDateOverlappingLimits } = this;
    let shouldBeDisabled = false;

    if (isDateDisabled) {
      shouldBeDisabled = isDateDisabled(date);
      if (shouldBeDisabled) return true;
    }

    const isDateAllowed = enableSetDateOverlappingLimits ? isSameDay(this.originalSelectedDate, date, { timezone: tz }) : false;

    if (min) {
      shouldBeDisabled = !isDateAllowed && toMoment(date, { timezone: tz }).isBefore(toMoment(min, { timezone: tz }), 'day');
      if (shouldBeDisabled) return true;
    }

    if (max) {
      shouldBeDisabled = !isDateAllowed && toMoment(date, { timezone: tz }).isAfter(toMoment(max, { timezone: tz }), 'day');
      if (shouldBeDisabled) return true;
    }

    return shouldBeDisabled;
  };

  @computed
  get datesOfTheViewWindow() {
    const { tz, navigationYear, navigationMonth } = this;
    const dateArgs = { year: navigationYear, month: navigationMonth, date: 1 };
    const firstDate = parseAsInTimezone(dateArgs, { timezone: tz });
    const lastDate = firstDate.clone().endOf('month');

    return {
      offset: firstDate.day() - 1,
      dates: getRange(firstDate.date(), lastDate.date()).map(d => {
        const args = { ...dateArgs, date: d };
        const value = parseAsInTimezone(args, { timezone: tz });
        return {
          value,
          selectable: true,
          disabled: this.shouldDateBeDisabled(value),
        };
      }),
    };
  }

  @computed
  get viewWindowEntries() {
    const { offset, dates } = this.datesOfTheViewWindow;
    const arr = getRange(0, offset).map(() => ({ value: '', selectable: false, offset: true }));
    const daysToRender = ['S', 'M', 'T', 'W', 'T', 'F', 'S']
      .map(entry => ({
        value: entry,
        header: true,
        selectable: false,
      }))
      .concat(arr)
      .concat(dates);

    return daysToRender;
  }
}
