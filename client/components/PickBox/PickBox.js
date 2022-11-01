/*
 * Copyright (c) 2022 Reva Technology Inc., all rights reserved.
 * Unauthorized copying of this file, via any medium is strictly prohibited
 * Licensed under the Elastic License 2.0; you may not use this file except
 * in compliance with the Elastic License 2.0.
 */

import PropTypes from 'prop-types';
import React, { Component } from 'react';
import generateId from 'helpers/generateId';

import clsc from 'helpers/coalescy';
import nullish from 'helpers/nullish';
import shallowCompare from 'helpers/shallowCompare';
import { VelocityComponent } from 'helpers/velocity';
import Icon from '../Icon/Icon';
import Button from '../Button/Button';
import { cf, g } from './PickBox.scss';

const iconsByTpe = {
  checkAll: {
    blank: 'checkbox-multiple-blank-outline',
    filled: 'checkbox-multiple-marked',
  },
  checkbox: {
    blank: 'checkbox-blank-outline',
    filled: 'checkbox-marked',
  },
  radio: {
    blank: 'radiobox-blank',
    filled: 'radiobox-marked',
  },
};

export default class PickBox extends Component {
  constructor(props) {
    super(props);
    this.id = generateId(this);
    this.state = { checked: !!props.checked };
  }

  static propTypes = {
    id: PropTypes.string,
    label: PropTypes.string,
    disabled: PropTypes.bool,
    checked: PropTypes.bool,
    readOnly: PropTypes.bool,
    onChange: PropTypes.func,
    leftAligned: PropTypes.bool,
    className: PropTypes.string,
    compact: PropTypes.bool,
    controlled: PropTypes.bool,
    type: PropTypes.oneOf(['checkbox', 'radio', 'checkAll', 'switch']),
    foregroundMode: PropTypes.oneOf(['dark', 'light']),
    reverse: PropTypes.bool,
  };

  static defaultProps = {
    label: '',
    disabled: false,
    controlled: false,
    readOnly: false,
    foregroundMode: 'dark',
    reverse: false,
  };

  get value() {
    return this.state.checked;
  }

  set value(value) {
    this._check(value);
  }

  _check(checked) {
    if (nullish(checked)) {
      return;
    }
    checked = !!checked; // eslint-disable-line no-param-reassign
    if (this.state.checked !== checked) {
      this.setState({
        checked,
      });
    }
  }

  componentWillReceiveProps(nextProps) {
    if (!this.props.controlled) {
      this._check(nextProps.checked);
    }
  }

  shouldComponentUpdate(nextProps, nextState) {
    const propsToCheck = ['type', 'id', 'className', 'disabled', 'label', 'compact', 'leftAligned', 'checked', 'readOnly', 'foregroundMode', 'reverse'];

    return !shallowCompare(nextProps, this.props, propsToCheck) || (!this.props.controlled && !shallowCompare(nextState, this.state, ['checked']));
  }

  handleTouchTap = () => {
    const { onChange, readOnly, onClick, disabled, type, controlled } = this.props;

    if (disabled || readOnly) {
      return;
    }

    if (type === 'radio') {
      if (!this.state.checked) {
        !controlled && this.setState({ checked: true });
        onChange && onChange(true);
      }
    } else {
      const checked = !this.state.checked;
      !controlled && this.setState({ checked });
      onChange && onChange(checked);
    }

    onClick && onClick();
  };

  render() {
    const {
      id,
      className,
      disabled,
      label,
      type,
      compact,
      leftAligned,
      controlled,
      readOnly,
      foregroundMode,
      reverse,
      checked: _checked,
      labelStyle,
      ...rest
    } = this.props;

    const checked = controlled ? _checked : this.state.checked;

    const isSwitch = type === 'switch';
    const isRadio = type === 'radio';

    const cName = cf(
      {
        'checkbox-outer': !isSwitch,
        'switch-outer': isSwitch,
        compact,
        disabled,
        checked,
        leftAligned,
        reverse,
        noReadOnly: !readOnly,
        light: foregroundMode === 'light',
      },
      g(className),
    );

    const theId = clsc(id, this.id);
    const labelC = !!label && (
      <label style={labelStyle} htmlFor={theId}>
        {label}
      </label>
    );

    let affordanceElement;

    if (!isSwitch) {
      const theIcons = iconsByTpe[type];
      const iconName = checked ? theIcons.filled : theIcons.blank;

      affordanceElement = (
        <span className={cf('affordance', { radio: isRadio })}>
          <span className={cf('affordance-helper', { rounded: isRadio })} />
          <Icon name={iconName} />
        </span>
      );
    } else {
      const animProps = {
        animation: {
          translateX: checked ? 20 : 0,
        },
        easing: [250, 20],
        duration: 900,
      };

      affordanceElement = (
        <div className={cf('switch-affordance', { checked })}>
          <div className={cf('track')} />
          <VelocityComponent {...animProps}>
            <div className={cf('knob')} />
          </VelocityComponent>
        </div>
      );
    }

    return (
      <Button
        id={theId}
        type="wrapper"
        className={cName}
        data-component="pickbox"
        onClick={this.handleTouchTap}
        disabled={disabled}
        {...(!disabled ? { 'data-fee-enabled': disabled } : {})}
        {...rest}>
        <span className={cf('wrapper')}>
          {affordanceElement}
          {labelC}
        </span>
      </Button>
    );
  }
}
