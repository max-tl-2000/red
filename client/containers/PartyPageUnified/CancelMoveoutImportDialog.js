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
import { PreloaderBlock, MsgBox, FormattedMarkdown } from 'components';
import { t } from 'i18next';
import { clearNoCancelMoveoutInMRI } from 'redux/modules/partyStore';
import { Observable } from 'rxjs/Observable';
import 'rxjs/add/observable/of';
import 'rxjs/add/operator/delay';
import { cf } from './MarkAsMovingOutImportDialog.scss';

@connect(
  state => ({
    importCancelMoveoutInProgress: state.partyStore.importCancelMoveoutInProgress,
    noCancelMoveoutInMRI: state.partyStore.noCancelMoveoutInMRI,
  }),
  dispatch =>
    bindActionCreators(
      {
        clearNoCancelMoveoutInMRI,
      },
      dispatch,
    ),
)
@observer
export default class CancelMoveoutImportDialog extends Component {
  constructor() {
    super();

    this.state = {
      dialogOpen: false,
      debounceOver: false,
    };

    this.subscriber = null;
  }

  componentWillUpdate(nextProps) {
    const { dialogOpen, debounceOver } = this.state;
    if (nextProps.importCancelMoveoutInProgress && !dialogOpen) this.openDialog();
    if (!nextProps.importCancelMoveoutInProgress && dialogOpen && debounceOver && !nextProps.noCancelMoveoutInMRI) this.closeDialog();
  }

  componentWillUnmount() {
    if (this.subscriber) this.subscriber.unsubscribe();
  }

  openDialog = () => {
    this.subscriber = Observable.of(true)
      .delay(2000)
      .subscribe(() => this.setState({ debounceOver: true }));
    this.setState({ dialogOpen: true });
  };

  closeDialog = () => {
    const { noCancelMoveoutInMRI } = this.props;

    if (noCancelMoveoutInMRI) this.props.clearNoCancelMoveoutInMRI();
    this.setState({ dialogOpen: false, debounceOver: false });
  };

  render() {
    const { importCancelMoveoutInProgress, noCancelMoveoutInMRI } = this.props;
    const { dialogOpen, debounceOver } = this.state;
    const showCancelMoveoutNotAvailable = noCancelMoveoutInMRI && !importCancelMoveoutInProgress && debounceOver;

    return (
      <MsgBox
        id="cancelMoveoutImportDialog"
        open={dialogOpen}
        overlayClassName={cf('import-moveout-dialog')}
        closeOnTapAway={false}
        hideCancelButton
        hideOkButton={!showCancelMoveoutNotAvailable}
        onCloseRequest={() => this.closeDialog()}
        title={showCancelMoveoutNotAvailable ? t('MOVEOUT_CANCELATION_NOT_AVAILABLE_DIALOG_TITLE') : ''}>
        {(importCancelMoveoutInProgress || !debounceOver) && <PreloaderBlock message={t('CANCEL_MOVEOUT_DIALOG_MSG')} />}
        {showCancelMoveoutNotAvailable && <FormattedMarkdown leftAlign>{`${t('MOVEOUT_CANCELATION_NOT_AVAILABLE_DIALOG_MSG')}`}</FormattedMarkdown>}
      </MsgBox>
    );
  }
}
