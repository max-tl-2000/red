/*
 * Copyright (c) 2022 Reva Technology Inc., all rights reserved.
 * Unauthorized copying of this file, via any medium is strictly prohibited
 * Licensed under the Elastic License 2.0; you may not use this file except
 * in compliance with the Elastic License 2.0.
 */

import PropTypes from 'prop-types';
import React, { Component } from 'react';
import { findDOMNode } from 'react-dom';
import generateId from 'helpers/generateId';
import nullish from 'helpers/nullish';
import 'helpers/element-resize';
import $ from 'jquery';
import clsc from 'helpers/coalescy';
import parse from 'parse-color';
import IconButton from '../IconButton/IconButton';

import { cf, g } from './Truncate.scss';

const parseColor = color => {
  if (!color || color === 'transparent') {
    return [0, 0, 0, 0];
  }
  const parsedColor = parse(color);
  return parsedColor.rgba;
};

const isNotTransparent = color => color[3] > 0;

const findBackgroundColor = ele => {
  let bgColor;
  do {
    bgColor = parseColor(getComputedStyle(ele).backgroundColor);
    ele = ele.parentElement;
  } while (!isNotTransparent(bgColor) && ele);

  return bgColor;
};

export default class Truncate extends Component {
  constructor(props, context) {
    super(props, context);
    this.id = generateId(this);
    this.state = { active: false, expanded: false };
  }

  static propTypes = {
    id: PropTypes.string,
    className: PropTypes.string,
    direction: PropTypes.oneOf(['vertical', 'horizontal']),
    maxHeight: PropTypes.number,
    moreAffordance: PropTypes.object,
    lessAffordance: PropTypes.object,
    hideExpandCollapse: PropTypes.bool,
    collapsible: PropTypes.bool,
    iconStyle: PropTypes.oneOf(['light', 'dark']),
    bgColor: PropTypes.array, // [ r, g, b, a]
  };

  get domEle() {
    if (!this._ele) {
      this._ele = findDOMNode(this);
    }
    return this._ele;
  }

  _checkIfShouldShowFade() {
    const { direction } = this.props;
    const horizontal = direction === 'horizontal';

    const { scrollHeight, clientHeight, scrollWidth, clientWidth } = this.$domEle.find(`#${this.innerWrapperId}`)[0];
    const hasScrollContent = horizontal ? scrollWidth > clientWidth : scrollHeight > clientHeight;

    this.$domEle.toggleClass(cf('has-scroll-content'), hasScrollContent);
    const THRESHOLD_TO_SHOW_GRADIENT = 50;
    setTimeout(() => this.setLinearGradient(), THRESHOLD_TO_SHOW_GRADIENT);
  }

  get $domEle() {
    if (!this._$ele) {
      this._$ele = $(this.domEle);
    }
    return this._$ele;
  }

  componentDidUpdate() {
    this._checkIfShouldShowFade();
  }

  get parentBGColor() {
    if (!this._parentBGColor) {
      const { bgColor } = this.props;

      // if the bgColor was provided used it otherwise attempt to detect it
      this._parentBGColor = bgColor || findBackgroundColor(this.domEle);
    }
    return this._parentBGColor;
  }

  setLinearGradient() {
    const colorBG = this.parentBGColor;
    const { direction } = this.props;
    const fade = this.$domEle.find(`#${this.fadeId}`);
    const gradientDirection = direction === 'vertical' ? 'to bottom' : 'to right';

    fade.css(
      'background',
      `
      linear-gradient(${gradientDirection},
      rgba(${colorBG[0]}, ${colorBG[1]}, ${colorBG[2]}, 0) 0%,
      rgba(${colorBG[0]}, ${colorBG[1]}, ${colorBG[2]}, .5) 50%,
      rgba(${colorBG[0]}, ${colorBG[1]}, ${colorBG[2]}, 1) 100%)
    `.trim(),
    );
  }

  get fadeId() {
    return `${this.id}_fade`;
  }

  componentDidMount() {
    this._checkIfShouldShowFade();

    const $ele = this.$domEle;

    $ele.on(`element:resize._ns_${this.id}`, () => this._checkIfShouldShowFade());
  }

  componentWillUnmount() {
    const $ele = this.$domEle;

    $ele.off(`element:resize._ns_${this.id}`);
  }

  expand = () => this.setState({ expanded: true });

  collapse = () => this.setState({ expanded: false });

  get maskId() {
    return `${this.id}_mask`;
  }

  get gradientId() {
    return `${this.id}_g`;
  }

  get innerWrapperId() {
    return `${this.id}_innerWrapper`;
  }

  render() {
    const { className, id, direction, children, maxHeight, moreAffordance, style, lessAffordance, collapsible, hideExpandCollapse, iconStyle } = this.props;

    // use the provided id if provided or the default otherwise
    const theId = clsc(id, this.id);

    const { expanded } = this.state;
    const theStyle = style || {};
    const fadeStyle = {};
    const vertical = direction === 'vertical';

    if (!nullish(maxHeight) && !expanded) {
      theStyle.maxHeight = maxHeight;
      const fadeStyleMaxHeight = maxHeight * 0.5;

      if (fadeStyleMaxHeight < 64) {
        fadeStyle.maxHeight = fadeStyleMaxHeight;
      }
    }

    const moreComponent = moreAffordance || <IconButton iconName="chevron-down" btnRole="secondary" iconStyle={iconStyle} />;
    const lessComponent = lessAffordance || <IconButton iconName="chevron-up" btnRole="secondary" iconStyle={iconStyle} />;

    const affordance = hideExpandCollapse ? null : expanded ? lessComponent : moreComponent; // eslint-disable-line no-nested-ternary

    return (
      <div
        id={theId}
        className={cf(
          'truncate',
          {
            [direction]: !!direction,
            expanded,
            'no-collapsible': !collapsible,
          },
          g(className),
        )}>
        <div id={this.innerWrapperId} style={theStyle} className={cf('inner-wrapper')}>
          {children}
          <div id={this.fadeId} className={cf('fade')} style={fadeStyle} />
        </div>
        {vertical && (
          <div className={cf('toggle-component')} onClick={expanded ? this.collapse : this.expand}>
            {affordance}
          </div>
        )}
      </div>
    );
  }
}
