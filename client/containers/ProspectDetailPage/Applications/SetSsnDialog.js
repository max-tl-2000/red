/*
 * Copyright (c) 2022 Reva Technology Inc., all rights reserved.
 * Unauthorized copying of this file, via any medium is strictly prohibited
 * Licensed under the Elastic License 2.0; you may not use this file except
 * in compliance with the Elastic License 2.0.
 */

import PropTypes from 'prop-types';
import React, { Component } from 'react';
import { bindActionCreators } from 'redux';
import { connect } from 'react-redux';
import { t } from 'i18next';
import { MsgBox, TextBox } from 'components';
import { ssn as ssnMask } from 'components/TextBox/masks';
import { updatePersonApplication } from 'redux/modules/partyStore';

@connect(
  () => ({}),
  dispatch =>
    bindActionCreators(
      {
        updatePersonApplication,
      },
      dispatch,
    ),
)
export default class SetSsnDialog extends Component {
  static propTypes = {
    application: PropTypes.object,
    isSetSsnDialogOpen: PropTypes.bool,
    onDialogClosed: PropTypes.func,
  };

  constructor(props) {
    super(props);
    const { application } = props;
    const {
      applicationData: { ssn, itin },
    } = application || {};
    this.state = {
      socSecNumber: ssn || itin,
    };
  }

  handleSetSsn = async () => {
    const { application = {} } = this.props;
    const { partyId, personId, applicationData } = application;
    const applicationDataUpdated = { ...applicationData, socSecNumber: this.state.socSecNumber };
    await this.props.updatePersonApplication({ partyId, personId, applicationData: applicationDataUpdated, setSsn: true }, true);
  };

  handleSetSsnDialogClosed = async () => {
    const { onDialogClosed } = this.props;
    onDialogClosed && onDialogClosed();
  };

  handleOnChange = ({ value }) => {
    this.setState({ socSecNumber: value });
  };

  renderSetSsnDialog = () => {
    const { isSetSsnDialogOpen } = this.props;
    const { socSecNumber } = this.state;
    return (
      <MsgBox open={isSetSsnDialogOpen} lblOK={t('DONE')} onOKClick={this.handleSetSsn} title={t('SET_SSN')} onCloseRequest={this.handleSetSsnDialogClosed}>
        {
          <TextBox
            value={socSecNumber}
            id="set-ssn"
            onChange={this.handleOnChange}
            label={t('APPLICANT_SOCIAL_SECURITY_OR_ITIN')}
            wide
            showClear
            mask={ssnMask}
          />
        }
      </MsgBox>
    );
  };

  render() {
    return this.renderSetSsnDialog();
  }
}
