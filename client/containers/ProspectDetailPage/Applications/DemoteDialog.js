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
import { Typography, MsgBox, PreloaderBlock } from 'components';
const { Text } = Typography;
import { demoteApplication } from 'redux/modules/quotes';
import { DALTypes } from '../../../../common/enums/DALTypes';

@connect(
  state => ({
    isDemoting: state.quotes.isDemoting,
  }),
  dispatch =>
    bindActionCreators(
      {
        demoteApplication,
      },
      dispatch,
    ),
)
export default class DemoteDialog extends Component {
  static propTypes = {
    quotePromotion: PropTypes.object,
    hasALease: PropTypes.bool,
    isDemoteApplicationDialogOpen: PropTypes.bool,
    onDialogClosed: PropTypes.func,
    dialogTitle: PropTypes.string,
    leaseStatus: PropTypes.string,
  };

  handleDemoteApplication = async () => {
    const { quotePromotion } = this.props;
    await this.props.demoteApplication(quotePromotion.partyId, quotePromotion.id);
  };

  handleDemoteDialogClosed = () => {
    const { onDialogClosed } = this.props;
    onDialogClosed && onDialogClosed();
  };

  renderDemoteDialog = () => {
    const { leaseStatus, hasALease, isDemoteApplicationDialogOpen, dialogTitle, isDemoting } = this.props;
    const draftButton = leaseStatus === DALTypes.LeaseStatus.DRAFT ? 'VOID_LEASE_BUTTON' : 'REVOKE_REQUEST';

    return (
      <MsgBox
        open={isDemoteApplicationDialogOpen}
        closeOnTapAway={false}
        lblOK={t(hasALease ? draftButton : 'ABORT_APPROVAL')}
        onOKClick={this.handleDemoteApplication}
        title={dialogTitle}
        onCloseRequest={this.handleDemoteDialogClosed}>
        {do {
          if (isDemoting) {
            <PreloaderBlock />;
          } else {
            <div id="abandonApprovalRequestContent">
              <Text>{t(hasALease ? 'REVOKE_APPROVED_APPLICATION_QUESTION' : 'ABANDON_APPROVAL_REQUEST_QUESTION')}</Text>
            </div>;
          }
        }}
      </MsgBox>
    );
  };

  render() {
    return this.renderDemoteDialog();
  }
}
