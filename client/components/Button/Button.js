/*
 * Copyright (c) 2022 Reva Technology Inc., all rights reserved.
 * Unauthorized copying of this file, via any medium is strictly prohibited
 * Licensed under the Elastic License 2.0; you may not use this file except
 * in compliance with the Elastic License 2.0.
 */

import PropTypes from 'prop-types';
import React, { Component } from 'react';
import { observer } from 'mobx-react';
import debounce from 'debouncy';

import trim from 'helpers/trim';
import { cf, g } from './button.scss';

import LoaderIndicator from '../LoaderIndicator/LoaderIndicator';

const { bool, string, oneOf, number } = PropTypes;

@observer
export default class Button extends Component {
  static propTypes = {
    useWaves: bool,
    type: string,
    wavesStyle: string,
    loading: bool,
    wide: bool,
    loaderStyle: string,
    btnRole: oneOf(['primary', 'secondary']), // if not passed assumed primary
    useDisable: bool,
    debounceClick: bool,
    debounceClickThreshold: number,
    primaryBg: bool,
  };

  static defaultProps = {
    useWaves: true,
    type: 'raised',
    wavesStyle: '',
    useDisable: false,
    debounceClick: true,
    debounceClickThreshold: 400,
  };

  constructor(props) {
    super(props);
    this.state = {};
  }

  handleClick = e => {
    const { props } = this;

    if (props.debounceClick) {
      this.debounceFireClick(e);
      return;
    }

    this.fireClick(e);
  };

  fireClick(e) {
    const { onClick, disabled, loading } = this.props;

    if (disabled || loading) {
      return;
    }

    onClick && onClick(e);
  }

  debounceFireClick = debounce(this.fireClick, this.props.debounceClickThreshold, this, true /* immediate */);

  focus() {
    this.btn && this.btn.focus();
  }

  render() {
    const props = this.props;
    const {
      type,
      className,
      disabled,
      useDisable,
      size,
      useWaves,
      label,
      wide,
      loading,
      loaderStyle,
      wavesStyle,
      id,
      btnRole: theBtnRole,
      debounceClick,
      debounceClickThreshold,
      isCohort,
      primaryBg,
      ...btnProps
    } = this.props;

    let wStyles = wavesStyle;

    if (!wStyles) {
      wStyles = type === 'flat' || (type === 'raised' && theBtnRole === 'secondary') ? 'light' : 'dark';
    }

    const cxObj = {
      'btn-flat': type === 'flat',
      btn: type === 'raised',
      'btn-floating': type === 'floating',
      disabled: disabled || useDisable,
      'btn-large': size === 'large',
      'waves-effect': useWaves && !disabled,
      'waves-light': wStyles === 'light',
    };

    let btnRole = trim(props.btnRole);

    if (!btnRole) {
      btnRole = 'primary';
    }

    const cNames =
      type === 'wrapper'
        ? className
        : cf(
            g(cxObj, className),
            {
              wide,
              'btn-flat': type === 'flat',
              primary: btnRole === 'primary',
              secondary: btnRole === 'secondary',
              loading,
              isCohort,
            },
            'custom-btn',
          );

    const children = this.props.children || <span>{label}</span>;

    let loadingC;
    if (loading) {
      let darkerMode;

      if (!loaderStyle) {
        darkerMode = type === 'flat' || btnRole === 'secondary';
      } else {
        darkerMode = loaderStyle === 'darker';
      }

      loadingC = <LoaderIndicator primaryBg darker={darkerMode} />;
    }

    const btnPropsCombined = { ...btnProps };

    if (loading) {
      btnPropsCombined['data-loading'] = true;
    }

    return (
      <button
        ref={ref => (this.btn = ref)}
        data-component="button"
        {...btnPropsCombined}
        id={id}
        data-button-type={type}
        type="button"
        onClick={this.handleClick}
        className={cNames}
        disabled={disabled}>
        {children}
        {loadingC}
      </button>
    );
  }
}
