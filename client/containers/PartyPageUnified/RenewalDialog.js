/*
 * Copyright (c) 2022 Reva Technology Inc., all rights reserved.
 * Unauthorized copying of this file, via any medium is strictly prohibited
 * Licensed under the Elastic License 2.0; you may not use this file except
 * in compliance with the Elastic License 2.0.
 */

import React, { Component } from 'react';
import { connect } from 'react-redux';
import { observer } from 'mobx-react';
import { bindActionCreators } from 'redux';
import { Dialog, DialogOverlay, PreloaderBlock, MsgBox, FormattedMarkdown } from 'components';
import { t } from 'i18next';
import { clearManualRenewalError } from 'redux/modules/partyStore';
import { getAssignedProperty } from 'redux/selectors/partySelectors';

@connect(
  (state, props) => ({
    renewalInProgress: state.partyStore.renewalInProgress,
    renewalError: state.partyStore.renewalError,
    assignedProperty: getAssignedProperty(state, props),
  }),
  dispatch =>
    bindActionCreators(
      {
        clearManualRenewalError,
      },
      dispatch,
    ),
)
@observer
export default class RenewalDialog extends Component {
  handleOnCloseRequest = () => {
    const { model, renewalInProgress } = this.props;
    if (!renewalInProgress) {
      model.close();
    }
  };

  render() {
    const { props } = this;
    const { renewalInProgress, renewalError, startManualRenewal, model, assignedProperty } = props;
    const showRenewalErrorDialog = !renewalInProgress && renewalError?.token === 'PARTY_NOT_ELIGIBLE_FOR_RENEWAL';
    const renewalCycleStart = assignedProperty?.settings?.renewals?.renewalCycleStart;

    return (
      <div>
        {!renewalInProgress && !renewalError && (
          <MsgBox
            open={model.isOpen}
            ref="renewalDialogConfirmation"
            closeOnTapAway={false}
            lblOK={t('RENEW_MANUALLY')}
            onOKClick={startManualRenewal}
            onCloseRequest={this.handleOnCloseRequest}
            title={t('MANUAL_RENEWAL_DIALOG_TITLE')}>
            <FormattedMarkdown>{`${t('MANUAL_RENEWAL_DIALOG_MSG', { renewalCycleStart })}`}</FormattedMarkdown>
          </MsgBox>
        )}
        {showRenewalErrorDialog && (
          <MsgBox
            open={showRenewalErrorDialog}
            ref="renewalDialogError"
            closeOnTapAway={false}
            lblOK={t('OK_GOT_IT')}
            hideCancelButton
            onCloseRequest={() => props.clearManualRenewalError()}
            title={t('MANUAL_RENEWAL_ERROR_DIALOG_TITLE')}>
            <FormattedMarkdown>{`${t('MANUAL_RENEWAL_ERROR_DIALOG_MSG')}`}</FormattedMarkdown>
          </MsgBox>
        )}
        {renewalInProgress && (
          <Dialog open={renewalInProgress} closeOnEscape={false}>
            <DialogOverlay id="renewalDialogInProgress" container={false}>
              <PreloaderBlock message={t('CREATING_RENEWAL')} />
            </DialogOverlay>
          </Dialog>
        )}
      </div>
    );
  }
}
