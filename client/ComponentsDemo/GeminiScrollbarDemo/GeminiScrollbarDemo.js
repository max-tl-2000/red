/*
 * Copyright (c) 2022 Reva Technology Inc., all rights reserved.
 * Unauthorized copying of this file, via any medium is strictly prohibited
 * Licensed under the Elastic License 2.0; you may not use this file except
 * in compliance with the Elastic License 2.0.
 */

import React, { Component } from 'react';
import generateId from 'helpers/generateId';
import clsc from 'helpers/coalescy';
import { observer } from 'mobx-react';
import { observable, action } from 'mobx';

import { GeminiScrollbar } from 'components';
import { DemoSection, DemoPage, SubHeader, PrettyPrint, MDBlock } from '../DemoElements';

@observer
class Timer extends Component {
  @observable
  time = 0;

  multiplier = 1;

  @action
  updateTime() {
    this.time += this.multiplier;
    if (this.time >= 20) {
      this.multiplier = -1;
    } else if (this.time <= 0) {
      this.multiplier = 1;
    }
  }

  _start() {
    this._timeout = setInterval(() => this.updateTime(), 3000);
  }

  _stop() {
    clearTimeout(this._timeout);
  }

  componentWillUnmount() {
    this._stop();
  }

  componentDidMount() {
    this._start();
  }

  render() {
    const arr = new Array(Number(this.time));
    const res = [];
    for (let index = 0; index < arr.length; index++) {
      res.push(
        <div
          key={index}
          style={{
            width: '100%',
            height: 20,
            background: `rgba(255, ${255 - index * 20}, ${index * 20}, 0.2)`,
          }}
        />,
      );
    }
    return (
      <div>
        {this.time}
        {res}
      </div>
    );
  }
}

// eslint-disable-next-line react/no-multi-comp
export default class GeminiScrollbarDemo extends Component {
  constructor(props, context) {
    super(props, context);
    this.id = generateId(this);
  }

  render() {
    const { id } = this.props;
    const theId = clsc(id, this.id);

    return (
      <DemoPage id={theId} title="Gemini Scrollbar">
        <DemoSection title="Usage">
          <MDBlock>
            {`
                 Show a scrollable area. It used to use gemini under the hood, not longer does because of performance issues.
                `}
          </MDBlock>
          <PrettyPrint>
            {`
                  <GeminiScrollbar style={ { maxHeight: 300, width: 250 } }>
                    <div style={ { width: '100%', height: 300, background: 'rgba(255, 0, 0, 0.2)' } } />
                    <div style={ { width: '100%', height: 300, background: 'rgba(0, 0, 255, 0.23)' } } />
                    <div style={ { width: '100%', height: 300, background: 'rgba(255, 0, 0, 0.2)' } } />
                    <div style={ { width: '100%', height: 300, background: 'rgba(255, 0, 0, 0.2)' } } />
                    <div style={ { width: '100%', height: 300, background: 'rgba(255, 0, 0, 0.2)' } } />
                  </GeminiScrollbar>
                 `}
          </PrettyPrint>
          <SubHeader>Result</SubHeader>
          <GeminiScrollbar style={{ maxHeight: 300, width: 250, border: '1px solid blue' }}>
            <Timer />
          </GeminiScrollbar>
        </DemoSection>
      </DemoPage>
    );
  }
}
