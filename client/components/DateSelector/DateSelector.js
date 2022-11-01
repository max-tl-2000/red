/*
 * Copyright (c) 2022 Reva Technology Inc., all rights reserved.
 * Unauthorized copying of this file, via any medium is strictly prohibited
 * Licensed under the Elastic License 2.0; you may not use this file except
 * in compliance with the Elastic License 2.0.
 */

/* eslint-disable react/no-multi-comp */
import React, { Component } from 'react';
import { observable, action } from 'mobx';
import { observer } from 'mobx-react';
import { t } from 'i18next';
import { DateSelectorModel } from './DateSelectorModel';
import FlyOut from '../FlyOut/FlyOut';
import FlyOutOverlay from '../FlyOut/FlyOutOverlay';
import * as T from '../Typography/Typography';
import Button from '../Button/Button';
import { cf, g } from './DateSelector.scss';
import IconButton from '../IconButton/IconButton';
import shallowCompare from '../../helpers/shallowCompare';
import Revealer from '../Revealer/Revealer';
import FilterableList from '../Filterable/FilterableList';
import nullish from '../../../common/helpers/nullish';
import TextBox from '../TextBox/TextBox';
import { isMoment, now, isSameDay } from '../../../common/helpers/moment-utils';

const ARROW_UP = 38;
const ARROW_DOWN = 40;
const ARROW_LEFT = 37;
const ARROW_RIGHT = 39;
const ENTER = 13;

@observer
class Day extends Component {
  shouldComponentUpdate(nextProps) {
    const toCompare = ['selected', 'disabled', 'selectable', 'header', 'today', 'dayToRender', 'monthToRender'];

    return !shallowCompare(nextProps, this.props, toCompare);
  }

  render() {
    const { dataId, selected, selectable, onClick, header, today, dayToRender, disabled } = this.props;

    return (
      <div
        data-id={dataId}
        className={cf('day', { selected, selectable, disabled })}
        onClick={selectable && (() => onClick && onClick())}
        {...(disabled ? { 'data-day-disabled': disabled } : {})}>
        <div className={cf('day-wrapper')}>
          <div className={cf('circle')}>
            <svg viewBox="0 0 40 40" xmlns="http://www.w3.org/2000/svg">
              <circle cx="20" cy="20" r="20" />
            </svg>
          </div>
          <T.Caption
            secondary={header || disabled}
            style={{ color: today && !selected ? '#2196F3' : undefined, lineHeight: '1em' }}
            lighter={selected && !disabled}>
            {dayToRender}
          </T.Caption>
        </div>
      </div>
    );
  }
}

const getDayToRender = dayToRender => {
  if (isMoment(dayToRender)) {
    return dayToRender.date();
  }
  return dayToRender;
};

const getMonthToRender = monthToRender => {
  if (isMoment(monthToRender)) {
    return monthToRender.month();
  }
  return monthToRender;
};

@observer
export default class DateSelector extends Component {
  @observable
  model;

  @observable
  fOpen;

  @observable
  viewingMonth = true;

  constructor(props) {
    super(props);
    this.model = new DateSelectorModel(props);
  }

  @action
  closeFlyOut = () => {
    this.fOpen = false;
  };

  @action
  openFlyOut = () => {
    this.fOpen = true;
  };

  animateFlyOut = ({ open, animProps }) => {
    animProps.animation = {
      scaleY: open ? 1 : 0,
      opacity: open ? 1 : 0,
      translateY: open ? 0 : '-10%',
      transformOriginX: ['50%', '50%'],
      transformOriginY: ['0', '0'],
    };
  };

  @action
  componentWillReceiveProps(nextProps) {
    const { model } = this;

    if (nextProps.tz !== model.tz) {
      model.setTz(nextProps.tz);
    }

    if (model.selectedDate !== nextProps.selectedDate && !isSameDay(model.selectedDate, nextProps.selectedDate, { timezone: nextProps.tz })) {
      model.setSelectedDate(nextProps.selectedDate);
    }

    if (model.min !== nextProps.min && !isSameDay(model.min, nextProps.min, { timezone: nextProps.tz })) {
      model.setMin(nextProps.min);
    }

    if (model.max !== nextProps.max && !isSameDay(model.max, nextProps.max, { timezone: nextProps.tz })) {
      model.setMax(nextProps.max);
    }

    if (model.isDateDisabled !== nextProps.isDateDisabled) {
      model.setIsDateDisabledFn(nextProps.isDateDisabled);
    }
  }

  @action
  focusDay(value) {
    this.model.focusDate(value);
  }

  renderDay = ({ value, isToday: today, header, dayToRender, selected, selectable, disabled, key, monthToRender }) => (
    <Day
      key={key}
      onClick={() => this.focusDay(value)}
      today={today}
      header={header}
      dayToRender={dayToRender}
      monthToRender={monthToRender}
      selected={selected}
      selectable={selectable}
      disabled={disabled}
      dataId={`${dayToRender}_day`}
    />
  );

  renderMonth = ({ viewWindowEntries: daysOfMonth, theSelectedDate: selectedDate, tz } = {}) => {
    let index = 0;

    const elements = [];
    const maxIndex = daysOfMonth.length;
    const today = now({ timezone: tz });

    while (index < maxIndex) {
      const daysArr = [];
      for (let i = 0; i < 7; i++) {
        if (index < maxIndex) {
          const { value, selectable, offset, disabled, header } = daysOfMonth[index];
          const dayToRender = getDayToRender(value);
          const monthToRender = getMonthToRender(value);
          const isToday = !header && !offset && isSameDay(value, today, { timezone: tz });
          const selected = selectedDate && selectable && isSameDay(value, selectedDate, { timezone: tz });
          daysArr.push(
            this.renderDay({
              value,
              header,
              isToday,
              dayToRender,
              selectable: selectable && !disabled,
              selected,
              key: `${index}_${i}`,
              disabled,
              monthToRender,
            }),
          );
          index++;
        }
      }
      elements.push(daysArr);
    }
    // eslint-disable-next-line
    return elements.map((days, index) => <div className={cf('row')} key={index}>{days.map(day => day)}</div>);
  };

  @action
  commitValueAndClose = () => {
    const { model, props } = this;
    const prevSelected = model.selectedDate ? model.selectedDate.clone() : null;

    if (model.shouldDateBeDisabled(model.temporarySelectedDate)) return;

    model.commitSelection();
    this.closeFlyOut();

    const { onChange, tz } = props;
    if (!isSameDay(prevSelected, model.selectedDate, { timezone: tz })) {
      onChange && onChange(model.selectedDate);
    }
  };

  @action
  handleKeyNavigation = e => {
    let offset;

    if (e.keyCode === ARROW_LEFT) {
      offset = -1;
    }
    if (e.keyCode === ARROW_RIGHT) {
      offset = +1;
    }
    if (e.keyCode === ARROW_UP) {
      offset = -7;
    }
    if (e.keyCode === ARROW_DOWN) {
      offset = +7;
    }

    const { model } = this;

    if (offset) {
      model.moveDateByOffset(offset);
    }

    e.preventDefault && e.preventDefault();
  };

  checkEnter = e => {
    if (e.keyCode === ENTER) {
      this.commitValueAndClose();
    }
  };

  handleOpen = () => {
    const { overlayRef } = this;
    if (overlayRef) {
      overlayRef.focus();
    }
  };

  @action
  handleClosing = () => {
    const { model, triggerRef } = this;
    model.clearTemporarySelection();
    if (triggerRef) {
      triggerRef.focus();
    }
  };

  storeOverlayRef = ref => {
    this.overlayRef = ref;
  };

  storeTrigger = ref => {
    this.triggerRef = ref;
  };

  @action
  navigateNextMonth = () => {
    this.model.nextMonth();
  };

  @action
  navigatePrevMonth = () => {
    this.model.prevMonth();
  };

  storePrevMonthTriggerRef = ref => {
    this.prevMonthTriggerRef = ref;
  };

  storeNextMonthTriggerRef = ref => {
    this.nextMonthTriggerRef = ref;
  };

  @action
  toggleShowYear = () => {
    this.viewingMonth = !this.viewingMonth;
  };

  @action
  handleClose = () => {
    this.viewingMonth = true;
  };

  @action
  toggleShowYearIfEnter = e => {
    if (e.key !== 'Enter') return;
    this.toggleShowYear();
  };

  @action
  changeNavigationYear = (selection = {}) => {
    const { items = [] } = selection;
    const { id: year } = items[0] || {};

    if (!nullish(year)) {
      this.model.setYear(year);
      this.viewingMonth = true;
    }
  };

  focusOnFilter = () => {
    this.refFilterableList.focus();
  };

  storeFilterableListRef = ref => (this.refFilterableList = ref);

  handleKeydown = e => {
    const ignoredKeys = ['Tab', 'Shift', 'Esc', 'CapsLock', 'Meta', 'Ctrl'];
    if (!ignoredKeys.find(key => key === e.key)) {
      this.openFlyOut();
      e.preventDefault();
      e.stopPropagation();
    }
  };

  clearDate = () => {
    const { model, props, triggerRef } = this;

    const prevSelected = model.selectedDate ? model.selectedDate.clone() : null;

    model.clearDate();

    const { onChange, tz } = props;

    if (!isSameDay(prevSelected, model.selectedDate, { timezone: tz })) {
      onChange && onChange(model.selectedDate);
    }

    if (triggerRef) {
      triggerRef.focus();
    }
  };

  render() {
    const { fOpen, props, model } = this;
    const {
      format = 'MMMM DD, YYYY',
      placeholder,
      label,
      className,
      textBoxClassName,
      appendToBody = true,
      disabled,
      wide,
      zIndex,
      errorMessage,
      warningMessage,
      id,
    } = props;

    return (
      <div data-component="date-selector" data-id={id} className={cf('date-selector', { wide }, g(className))}>
        <TextBox
          placeholder={placeholder}
          id={id}
          ref={this.storeTrigger}
          onKeyDown={this.handleKeydown}
          onClick={this.openFlyOut}
          className={textBoxClassName}
          showClear
          disabled={disabled}
          clearTextRequest={this.clearDate}
          label={label}
          wide={wide}
          value={model.selectedDate ? model.selectedDate.format(format) : ''}
          errorMessage={errorMessage}
          warningMessage={warningMessage}
        />
        <FlyOut
          onOpen={this.handleOpen}
          onClosing={this.handleClosing}
          onClose={this.handleClose}
          appendToBody={appendToBody}
          expandTo="right-bottom"
          zIndex={zIndex}
          open={fOpen}
          onCloseRequest={this.closeFlyOut}
          usePrevSiblingAsTrigger
          matchTriggerSize={false}
          overTrigger>
          <FlyOutOverlay container={false} animationFn={this.animateFlyOut}>
            <div id={`${id}_calendar`}>
              <div className={cf('header')}>
                <T.Text className={cf('yearSelector')} tabIndex={0} lighter secondary onClick={this.toggleShowYear} onKeyUp={this.toggleShowYearIfEnter}>
                  {model.selectedYear}
                </T.Text>
                <T.Title style={{ fontSize: 34 }} lighter>
                  {model.selectedDayOfWeekMonthAndDate}
                </T.Title>
              </div>
              <div className={cf('container')}>
                <Revealer className={cf('panel')} enterDoneClass={cf('done')} show={this.viewingMonth}>
                  <div className={cf('month-nav')}>
                    <IconButton data-id="dateSelectorLeftBtn" ref={this.storePrevMonthTriggerRef} iconName="chevron-left" onClick={this.navigatePrevMonth} />
                    <T.Text data-id="monthYearNavigation">{model.navigationMonthNameAndYear}</T.Text>
                    <IconButton data-id="dateSelectorRightBtn" ref={this.storeNextMonthTriggerRef} iconName="chevron-right" onClick={this.navigateNextMonth} />
                  </div>
                  <div className={cf('body')} ref={this.storeOverlayRef} tabIndex={0} onKeyUp={this.checkEnter} onKeyDown={this.handleKeyNavigation}>
                    {this.renderMonth(model)}
                  </div>
                </Revealer>
                <Revealer className={cf('panel')} onEnter={this.focusOnFilter} enterDoneClass={cf('done')} show={!this.viewingMonth}>
                  <FilterableList
                    ref={this.storeFilterableListRef}
                    wide
                    listHeight={240}
                    items={model.availableYears}
                    selectedIds={[model.selectedYear]}
                    onChange={this.changeNavigationYear}
                  />
                </Revealer>
              </div>
              <div className={cf('actions')}>
                <Button tabIndex={0} type="flat" label={t('CANCEL')} onClick={this.closeFlyOut} />
                <Button data-id="dateSelectorOkBtn" tabIndex={0} type="flat" label={t('OK')} onClick={this.commitValueAndClose} />
              </div>
            </div>
          </FlyOutOverlay>
        </FlyOut>
      </div>
    );
  }
}
