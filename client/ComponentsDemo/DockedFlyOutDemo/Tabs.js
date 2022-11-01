/*
 * Copyright (c) 2022 Reva Technology Inc., all rights reserved.
 * Unauthorized copying of this file, via any medium is strictly prohibited
 * Licensed under the Elastic License 2.0; you may not use this file except
 * in compliance with the Elastic License 2.0.
 */

import PropTypes from 'prop-types';
import React, { Component, Children } from 'react';
import generateId from 'helpers/generateId';
import clsc from 'helpers/coalescy';
import { Icon } from 'components';

import $ from 'jquery';
import nullish from 'helpers/nullish';
import { cf, g } from './Tabs.scss';

export default class Tabs extends Component {
  constructor(props, context) {
    super(props, context);
    this.id = generateId(this);
    this.state = {
      section: props.section,
    };
  }

  static propTypes = {
    id: PropTypes.string,
  };

  _check(section) {
    if (nullish(section)) {
      return;
    }

    if (this.state.section !== section) {
      this.setState({
        section,
      });
    }
  }

  componentWillReceiveProps(nextProps) {
    this._check(nextProps.section);
  }

  handleTouch = e => {
    const { onChange } = this.props;

    const $target = $(e.target).closest('[data-section]');
    if ($target.length > 0) {
      const newSection = $target.attr('data-section');
      if (this.state.section === newSection) {
        return;
      }

      this.setState({
        section: newSection,
      });

      onChange && onChange({ section: newSection });
    }
  };

  render() {
    const {
      id,
      className,
      children,
      section: _section, // eslint-disable-line
      ...rest
    } = this.props;
    const { section } = this.state;

    const triggers = [];
    let visibleSection;

    Children.forEach(children, child => {
      const { props } = child;
      const { section: childSection, iconName } = props;

      const selected = childSection === section;

      if (selected) {
        visibleSection = child;
      }

      triggers.push(
        <div key={childSection} data-section={childSection} data-selected={selected}>
          <Icon name={iconName} />
        </div>,
      );
    });

    // use the provided id if provided or the default otherwise
    const theId = clsc(id, this.id);

    return (
      <div id={theId} data-component="tabs" className={cf('tabs', g(className))} {...rest}>
        <div className={cf('content')}>{visibleSection}</div>
        <div className={cf('triggers-section')} onClick={this.handleTouch}>
          {triggers}
        </div>
      </div>
    );
  }
}
