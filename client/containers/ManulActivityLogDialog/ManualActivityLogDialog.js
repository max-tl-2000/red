/*
 * Copyright (c) 2022 Reva Technology Inc., all rights reserved.
 * Unauthorized copying of this file, via any medium is strictly prohibited
 * Licensed under the Elastic License 2.0; you may not use this file except
 * in compliance with the Elastic License 2.0.
 */

import PropTypes from 'prop-types';
import React, { Component } from 'react';
import { MsgBox, TextBox } from 'components';
import { t } from 'i18next';
import { bindActionCreators } from 'redux';
import { connect } from 'react-redux';
import { closeManualActivityLogDialog, addActivityLog } from 'redux/modules/activityLogStore';
import trim from '../../../common/helpers/trim';
import { cf } from './ManualActivityLogDialog.scss';
import { ACTIVITY_TYPES } from '../../../common/enums/activityLogTypes';

@connect(
  state => ({
    showManualActivityLogDialog: state.activityLog.showManualActivityLogDialog,
  }),
  dispatch =>
    bindActionCreators(
      {
        closeManualActivityLogDialog,
        addActivityLog,
      },
      dispatch,
    ),
)
export default class ManualActivityLogDialog extends Component {
  static propTypes = {
    closeManualActivityLogDialog: PropTypes.func.isRequired,
    addActivityLog: PropTypes.func.isRequired,
    showManualActivityLogDialog: PropTypes.bool,
  };

  constructor() {
    super();
    this.state = {
      notes: '',
    };
  }

  render() {
    const { showManualActivityLogDialog, partyId } = this.props;
    const { notes } = this.state;
    return (
      <MsgBox
        open={showManualActivityLogDialog}
        overlayClassName={cf('manual-activity-log-dialog')}
        title={t('ADD_ACTIVITY_LOG')}
        lblOK={t('SAVE_BUTTON')}
        btnOKDisabled={!notes}
        onCloseRequest={() => this.props.closeManualActivityLogDialog()}
        onOKClick={() => this.props.addActivityLog({ id: partyId, notes: trim(notes) }, ACTIVITY_TYPES.MANUAL)}
        onCancelClick={() => this.props.closeManualActivityLogDialog()}>
        <TextBox value={notes} onChange={({ value }) => this.setState({ notes: value })} multiline wide autoFocus autoTrim={false} />
      </MsgBox>
    );
  }
}
