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

export default class Counter extends Component {
  constructor(props, context) {
    super(props, context);
    this.id = generateId(this);
    this.state = {
      counter: 0,
    };
  }

  static propTypes = {
    id: PropTypes.string,
  };

  componentDidMount() {
    this.timer = setInterval(
      () =>
        this.setState({
          counter: this.state.counter + 1,
        }),
      1000,
    );
  }

  componentWillUnmount() {
    clearInterval(this.timer);
  }

  render() {
    const { className, id, ...rest } = this.props;

    // use the provided id if provided or the default otherwise
    const theId = clsc(id, this.id);

    return (
      <div id={theId} className={className} {...rest}>
        counter: {this.state.counter}
      </div>
    );
  }
}
