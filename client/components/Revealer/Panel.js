/*
 * Copyright (c) 2022 Reva Technology Inc., all rights reserved.
 * Unauthorized copying of this file, via any medium is strictly prohibited
 * Licensed under the Elastic License 2.0; you may not use this file except
 * in compliance with the Elastic License 2.0.
 */

import React, { Component } from 'react';
import { observer } from 'mobx-react';
import PropTypes from 'prop-types';

@observer
export default class Panel extends Component {
  static propTypes = {
    enterClass: PropTypes.string,
    exitClass: PropTypes.string,
    onEnterDone: PropTypes.func,
    onExitDone: PropTypes.func,
  };

  storeRef = ref => {
    this.ref = ref;
  };

  exit() {
    const { enterClass, exitClass, onExitStart, enterDoneClass } = this.props;

    if (!exitClass) {
      throw new Error('No exitClass prop defined');
    }

    const { ref } = this;
    this.clearHandlers();

    ref.addEventListener('animationend', this._handleExitAnimationEnd);
    ref.addEventListener('transitionend', this._handleExitAnimationEnd);

    enterDoneClass && ref.classList.remove(enterDoneClass);
    enterClass && ref.classList.remove(enterClass);

    this.timer = setTimeout(() => this._handleExitAnimationEnd({ target: ref }), 1000);

    ref.classList.add(exitClass);

    onExitStart && setTimeout(onExitStart, 0);
  }

  _handleExitAnimationEnd = ({ target }) => {
    const { ref } = this;
    if (target !== ref) return;

    const { onExitDone, exitClass } = this.props;

    target.removeEventListener('animationend', this._handleExitAnimationEnd);
    target.removeEventListener('transitionend', this._handleExitAnimationEnd);
    target.classList.remove(exitClass);

    onExitDone && onExitDone();
  };

  clearHandlers() {
    const { ref } = this;
    if (!ref) return;

    const { enterClass, exitClass } = this.props;
    exitClass && ref.classList.remove(exitClass);
    enterClass && ref.classList.remove(enterClass);

    ref.removeEventListener('animationend', this._handleExitAnimationEnd);
    ref.removeEventListener('transitionend', this._handleExitAnimationEnd);

    ref.removeEventListener('animationend', this._handleEnterAnimationEnd);
    ref.removeEventListener('transitionend', this._handleEnterAnimationEnd);
  }

  componentWillUnmount() {
    this.clearHandlers();
  }

  componentWillReceiveProps(nextProps) {
    const currentProps = this.props;

    if (!currentProps.show && nextProps.show) {
      this.clearHandlers();
      this.playEnterAnimation();
    }
  }

  componentDidMount() {
    this.playEnterAnimation();
  }

  playEnterAnimation() {
    const { enterClass, onEnterStart, exitClass, skipFirst } = this.props;
    const { ref } = this;

    if (skipFirst) {
      exitClass && ref.classList.remove(exitClass);
      return;
    }

    if (!enterClass) {
      throw new Error('No enterClass prop defined');
    }

    ref.addEventListener('animationend', this._handleEnterAnimationEnd);
    ref.addEventListener('transitionend', this._handleEnterAnimationEnd);

    exitClass && ref.classList.remove(exitClass);
    ref.classList.add(enterClass);

    onEnterStart && setTimeout(onEnterStart, 0);
  }

  _handleEnterAnimationEnd = ({ target }) => {
    const { ref, props } = this;

    if (target !== ref) return;
    const { enterClass, onEnterDone, enterDoneClass } = props;

    ref.removeEventListener('animationend', this._handleEnterAnimationEnd);
    ref.classList.remove(enterClass);

    enterDoneClass && ref.classList.add(enterDoneClass);
    onEnterDone && onEnterDone();
  };

  render() {
    const {
      children,
      show,
      exitClass,
      enterClass,
      enterDoneClass,
      onEnterDone,
      onExitStart,
      onEnterStart,
      onEnter,
      onExit,
      onExitDone,
      skipFirst,
      ...rest
    } = this.props;
    return (
      <div ref={this.storeRef} {...rest}>
        {children}
      </div>
    );
  }
}
