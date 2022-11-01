/*
 * Copyright (c) 2022 Reva Technology Inc., all rights reserved.
 * Unauthorized copying of this file, via any medium is strictly prohibited
 * Licensed under the Elastic License 2.0; you may not use this file except
 * in compliance with the Elastic License 2.0.
 */

import { action, computed, observable } from 'mobx';
import React, { Component } from 'react';
import { Typography } from 'components';
import { observer } from 'mobx-react';
import { t } from 'i18next';
import { getDurationBetweenMoments, now } from '../../../common/helpers/moment-utils';

const { Caption } = Typography;

@observer
export default class AgentCallDuration extends Component {
  @observable _currentTime = now();

  @action
  setCurrentTime() {
    this._currentTime = now();
  }

  componentDidMount() {
    this.currentTimeTimer = setInterval(() => this.setCurrentTime(), 1000);
  }

  componentWillUnmount() {
    clearInterval(this.currentTimeTimer);
  }

  @computed
  get callDuration() {
    const { statusUpdatedAt } = this.props;
    return statusUpdatedAt && getDurationBetweenMoments(statusUpdatedAt, this._currentTime);
  }

  render() {
    const title = this.callDuration && t('CALL_DURATION', { callDuration: this.callDuration });
    return (
      <Caption secondary ellipsis title={title}>
        {title}
      </Caption>
    );
  }
}
