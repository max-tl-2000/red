/*
 * Copyright (c) 2022 Reva Technology Inc., all rights reserved.
 * Unauthorized copying of this file, via any medium is strictly prohibited
 * Licensed under the Elastic License 2.0; you may not use this file except
 * in compliance with the Elastic License 2.0.
 */

import React, { Component } from 'react';
import { observer, inject } from 'mobx-react';
import { cf } from './not-allowed-layer.scss';

@inject('home')
@observer
export class NotAllowedLayer extends Component { // eslint-disable-line

  onNotAllowedClick() {
    const { HomeModel } = this.props.home;
    HomeModel.setShowNotAllowedMessage(!HomeModel.showNotAllowedMessage);
  }

  render() {
    return <div className={cf('not-allowed-layer')} onClick={() => this.onNotAllowedClick()} />;
  }
}
