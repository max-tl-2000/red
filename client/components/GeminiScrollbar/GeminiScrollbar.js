/*
 * Copyright (c) 2022 Reva Technology Inc., all rights reserved.
 * Unauthorized copying of this file, via any medium is strictly prohibited
 * Licensed under the Elastic License 2.0; you may not use this file except
 * in compliance with the Elastic License 2.0.
 */

import { isNumber } from 'helpers/type-of';
import PropTypes from 'prop-types';

import React, { Component } from 'react';
import { cf, g } from './GeminiScrollbar.scss';

export default class GeminiScrollbar extends Component {
  static propTypes = {
    paddedScrollable: PropTypes.bool, // this one should be deprecated becasuse it relies on global styles
    noOverflow: PropTypes.bool,
    extraBottomPadding: PropTypes.oneOfType([PropTypes.string, PropTypes.number]),
    useExtraBottomPadding: PropTypes.bool,
  };

  static defaultProps = {
    paddedScrollable: false,
    noOverflow: false,
    extraBottomPadding: 100,
    useExtraBottomPadding: false,
  };

  getViewElement() {
    return this.scrollArea;
  }

  render() {
    const { className, children, paddedScrollable, noOverflow, extraBottomPadding, useExtraBottomPadding, ...other } = this.props;
    if (paddedScrollable) {
      console.warn('paddedScrollable is deprecated please use `useExtraBottomPadding` instead');
    }

    const style = {};
    if (paddedScrollable || useExtraBottomPadding) {
      style.paddingBottom = isNumber(extraBottomPadding) ? `${extraBottomPadding}px` : extraBottomPadding;
    }

    return (
      <div ref={ref => (this.scrollArea = ref)} className={cf('scrollable-area', { noOverflow }, g(className))} {...other}>
        <div style={style}>{children}</div>
      </div>
    );
  }
}
