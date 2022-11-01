/*
 * Copyright (c) 2022 Reva Technology Inc., all rights reserved.
 * Unauthorized copying of this file, via any medium is strictly prohibited
 * Licensed under the Elastic License 2.0; you may not use this file except
 * in compliance with the Elastic License 2.0.
 */

import React, { Component } from 'react';

export default class Ticker extends Component {
  state = {
    counter: 0,
  };

  constructor(...args) {
    super(...args);
    console.log('Ticker constructor');
  }

  componentWillUnmount() {
    clearInterval(this.timer);
    console.log('unmounting Ticker');
  }

  componentDidMount() {
    console.log('mounting Ticker');
    this.timer = setInterval(() => this.updateCounter(), 1000);
  }

  updateCounter = () => {
    console.log('ticking', this.state.counter);
    const newCount = this.state.counter + 1;
    this.setState({ counter: newCount });
  };

  render() {
    return <div>Seconds since displayed {this.state.counter}</div>;
  }
}
