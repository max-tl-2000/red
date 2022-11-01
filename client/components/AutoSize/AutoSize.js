/*
 * Copyright (c) 2022 Reva Technology Inc., all rights reserved.
 * Unauthorized copying of this file, via any medium is strictly prohibited
 * Licensed under the Elastic License 2.0; you may not use this file except
 * in compliance with the Elastic License 2.0.
 */

import PropTypes from 'prop-types';
import React, { Component } from 'react';
import { findDOMNode } from 'react-dom';
import $ from 'jquery';
import generateId from 'helpers/generateId';
import clsc from 'helpers/coalescy';
import 'helpers/element-resize';
import debounce from 'debouncy';
import { observer } from 'mobx-react';

const DELAY_BEFORE_CALCULATING_BREAKPOINTS = 50;

@observer
export default class AutoSize extends Component {
  constructor(props, context) {
    super(props, context);
    this.id = generateId(this);
    this.state = {};
    this.checkSize = debounce(this.checkSize, DELAY_BEFORE_CALCULATING_BREAKPOINTS, this);
  }

  get $ele() {
    if (!this._$ele) {
      this._$ele = $(findDOMNode(this));
    }
    return this._$ele;
  }

  calculateBreakpoint(breakpoints, w) {
    const keys = Object.keys(breakpoints);

    for (let i = 0, len = keys.length; i < len; i++) {
      const bpKey = keys[i];
      const bp = breakpoints[bpKey];
      const min = bp[0];
      const max = bp[1] || Infinity;

      if (min >= max) {
        throw new Error(`Invalid breakpoint. Min (${min}) cannot be greater or equal than Max (${max})`);
      }
      if (min <= w && w <= max) {
        return bpKey;
      }
    }
    return undefined;
  }

  _calculateBreakpoints(width, height) {
    const { breakpoints } = this.props;
    if (!breakpoints) {
      this.setState({ width, height });
      return;
    }

    const lastBreakpoint = this.state.breakpoint;
    const currentBreakpoint = this.calculateBreakpoint(breakpoints, width);
    if (currentBreakpoint !== lastBreakpoint) {
      this.setState({
        width,
        height,
        breakpoint: currentBreakpoint,
      });
    }
  }

  checkSize() {
    if (!this._mounted) return;
    const { width, height } = this.$ele[0].getBoundingClientRect();
    this._calculateBreakpoints(width, height);
  }

  componentDidMount() {
    this._mounted = true;

    this.$ele.on(`element:resize.ns_${this.id}`, (e, { w, h }) => {
      this._calculateBreakpoints(w, h);
    });

    this.checkSize();
  }

  componentWillUnmount() {
    this._mounted = false;
    this.$ele.off(`element:resize.ns_${this.id}`);
  }

  static propTypes = {
    children: PropTypes.func.isRequired,
    id: PropTypes.string,
    breakpoints: PropTypes.oneOfType([PropTypes.object, PropTypes.bool]),
    className: PropTypes.string,
  };

  static defaultProps = {
    breakpoints: {
      small: [0, 480],
      medium: [481, 960],
      large: [961, Infinity],
    },
  };

  render() {
    const {
      className,
      children,
      id,
      breakpoints, // eslint-disable-line
      ...rest
    } = this.props;
    const { width, height, breakpoint } = this.state;
    const theId = clsc(id, this.id);

    return (
      <div id={theId} className={className} {...rest}>
        {children({ width, height, breakpoint })}
      </div>
    );
  }
}
