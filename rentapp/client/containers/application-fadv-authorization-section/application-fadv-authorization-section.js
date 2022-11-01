/*
 * Copyright (c) 2022 Reva Technology Inc., all rights reserved.
 * Unauthorized copying of this file, via any medium is strictly prohibited
 * Licensed under the Elastic License 2.0; you may not use this file except
 * in compliance with the Elastic License 2.0.
 */

import PropTypes from 'prop-types';
import React, { Component } from 'react';
import { t } from 'i18next';
import { CheckBox } from 'components';
import { cf } from './application-fadv-authorization-section.scss';

export class ApplicationFadvAuthorization extends Component {
  static propTypes = {
    model: PropTypes.object,
  };

  handleReportRequestChange = value => {
    const { model } = this.props;
    model.updateReportCopyRequest(value);
  };

  render = () => {
    const { reportCopyRequested } = this.props.model;

    return (
      <div className={cf('fadv-authorization-options')}>
        <CheckBox
          labelStyle={{ paddingTop: '11px', paddingRight: '20px' }}
          leftAligned
          label={t('FREE_COPY_REPORT')}
          checked={reportCopyRequested}
          onChange={value => this.handleReportRequestChange(value)}
        />
      </div>
    );
  };
}
