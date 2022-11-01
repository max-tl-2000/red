/*
 * Copyright (c) 2022 Reva Technology Inc., all rights reserved.
 * Unauthorized copying of this file, via any medium is strictly prohibited
 * Licensed under the Elastic License 2.0; you may not use this file except
 * in compliance with the Elastic License 2.0.
 */

import React, { Component } from 'react';
import { observable, computed, action } from 'mobx';
import { observer } from 'mobx-react';
import { isNum } from 'helpers/type-of';
import throttle from 'lodash/throttle';
import Icon from 'components/Icon/Icon';
import $ from 'jquery';
import { cf, g } from './Scrollable.scss';
import 'helpers/element-resize';
@observer
export default class Scrollable extends Component {
  constructor(props) {
    super(props);
    this.updateScrollProps = throttle(() => this._updateScrollProps(), 300, {
      leading: true,
      trailing: true,
    });
  }

  @observable
  scrollTop;

  @observable
  scrollLeft;

  @observable
  scrollHeight;

  @observable
  scrollWidth;

  @observable
  clientHeight;

  @observable
  clientWidth;

  @computed
  get topAffordanceVisible() {
    return this.scrollTop > 0;
  }

  @computed
  get bottomAffordanceVisible() {
    return this.scrollTop < this.scrollHeight - this.clientHeight;
  }

  @computed
  get leftAffordanceVisible() {
    return this.scrollLeft > 0;
  }

  @computed
  get rightAffordanceVisible() {
    return this.scrollLeft < this.scrollWidth - this.clientWidth;
  }

  @action
  _updateScrollProps = () => {
    const { scrollableRef } = this;

    if (!scrollableRef) return;

    this.scrollTop = scrollableRef.scrollTop;
    this.scrollLeft = scrollableRef.scrollLeft;

    this.scrollHeight = scrollableRef.scrollHeight;
    this.scrollWidth = scrollableRef.scrollWidth;

    this.clientHeight = scrollableRef.clientHeight;
    this.clientWidth = scrollableRef.clientWidth;
  };

  get $scrollable() {
    return $(this.scrollableRef);
  }

  componentWillUnmount() {
    if (!this.scrollableRef) return;
    this.$scrollable.off('scroll element:resize', this.updateScrollProps);
  }

  componentDidMount() {
    if (!this.scrollableRef) return;
    this.$scrollable.on('scroll element:resize', this.updateScrollProps);
    setTimeout(this.updateScrollProps, 16);
  }

  storeRef = ref => {
    this.scrollableRef = ref;
  };

  render() {
    const { children, height, fixedDimensions, width, xAxis = false, yAxis = true, className, ...rest } = this.props;
    const style = {};
    const scrollableStyle = {};

    if (isNum(height)) {
      style.height = height;
      if (fixedDimensions) {
        scrollableStyle.height = height;
      }
    }
    if (isNum(width)) {
      style.width = width;
      if (fixedDimensions) {
        scrollableStyle.width = width;
      }
    }

    scrollableStyle.overflowX = xAxis ? 'auto' : 'none';
    scrollableStyle.overflowY = yAxis ? 'auto' : 'none';

    const { topAffordanceVisible, leftAffordanceVisible, bottomAffordanceVisible, rightAffordanceVisible } = this;

    return (
      <div data-c="scrollable" style={style} className={cf('viewport', g(className))} {...rest}>
        <div className={cf('scrollable')} ref={this.storeRef} style={scrollableStyle}>
          {children}
        </div>
        <div className={cf('affordance top', { visible: topAffordanceVisible })}>
          <Icon name="chevron-up" />
        </div>
        <div className={cf('affordance left', { visible: leftAffordanceVisible })}>
          <Icon name="chevron-right" />
        </div>
        <div
          className={cf('affordance bottom', {
            visible: bottomAffordanceVisible,
          })}>
          <Icon name="chevron-down" />
        </div>
        <div
          className={cf('affordance right', {
            visible: rightAffordanceVisible,
          })}>
          <Icon name="chevron-left" />
        </div>
      </div>
    );
  }
}
