/*
 * Copyright (c) 2022 Reva Technology Inc., all rights reserved.
 * Unauthorized copying of this file, via any medium is strictly prohibited
 * Licensed under the Elastic License 2.0; you may not use this file except
 * in compliance with the Elastic License 2.0.
 */

import React, { Component } from 'react';
import { observable, action } from 'mobx';
import { observer } from 'mobx-react';

import Panel from './Panel';
import { cf } from './Revealer.scss';

@observer
export default class Revealer extends Component {
  @observable
  showing = false;

  @observable
  count = 0;

  storeRef = ref => {
    this.ref = ref;
  };

  @action
  setShowingValue(showing) {
    this.showing = showing;
    if (this.count > 1) return;
    this.count++;
  }

  handleExit = () => {
    this.setShowingValue(false);

    const { onExit } = this.props;
    onExit && onExit();
  };

  handleEnter = () => {
    const { onEnter } = this.props;
    onEnter && onEnter();
  };

  componentDidUpdate(prevProps) {
    if (!this.props.show && prevProps.show) {
      this.ref && this.ref.exit && this.ref.exit();
      return;
    }
    if (this.props.show && !prevProps.show) {
      this.setShowingValue(true);
    }
  }

  componentDidMount() {
    const { show } = this.props;
    if (show) {
      this.setShowingValue(true);
    }
  }

  render() {
    const { showing, count, storeRef, handleEnter, handleExit } = this;
    const { children, show, exitClass, enterClass, enterDoneClass, onEnterDone, onExitStart, onEnterStart, onExitDone, skipFirst, ...rest } = this.props;

    return showing ? (
      <Panel
        {...rest}
        show={show}
        ref={storeRef}
        exitClass={exitClass || cf('exit')}
        enterClass={enterClass || cf('enter')}
        enterDoneClass={enterDoneClass}
        skipFirst={skipFirst && count === 1}
        onEnterStart={onEnterStart}
        onExitStart={onExitStart}
        onEnterDone={handleEnter}
        onExitDone={handleExit}>
        {children}
      </Panel>
    ) : null;
  }
}
