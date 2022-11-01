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
import { clearNoVacateDateInMRI } from 'redux/modules/partyStore';
import { Observable } from 'rxjs/Observable';
import 'rxjs/add/observable/of';
import 'rxjs/add/operator/delay';
import { cf } from './MarkAsMovingOutImportDialog.scss';

@connect(
  state => ({
    importMoveoutInProgress: state.partyStore.importMoveoutInProgress,
    noVacateDateInMRI: state.partyStore.noVacateDateInMRI,
  }),
  dispatch =>
    bindActionCreators(
      {
        clearNoVacateDateInMRI,
      },
      dispatch,
    ),
)
@observer
export default class MarkAsMovingOutImportDialog extends Component {
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
    if (nextProps.importMoveoutInProgress && !dialogOpen) this.openDialog();
    if (!nextProps.importMoveoutInProgress && dialogOpen && debounceOver && !nextProps.noVacateDateInMRI) this.closeDialog();
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
    const { noVacateDateInMRI } = this.props;

    if (noVacateDateInMRI) this.props.clearNoVacateDateInMRI();
    this.setState({ dialogOpen: false, debounceOver: false });
  };

  render() {
    const { importMoveoutInProgress, noVacateDateInMRI } = this.props;
    const { dialogOpen, debounceOver } = this.state;
    const showMoveoutNotAvailable = noVacateDateInMRI && !importMoveoutInProgress && debounceOver;

    return (
      <MsgBox
        id="markAsMovingOutImportDialog"
        open={dialogOpen}
        overlayClassName={cf('import-moveout-dialog')}
        closeOnTapAway={false}
        hideCancelButton
        hideOkButton={!showMoveoutNotAvailable}
        onCloseRequest={() => this.closeDialog()}
        title={showMoveoutNotAvailable ? t('MOVEOUT_NOT_AVAILABLE_DIALOG_TITLE') : ''}>
        {(importMoveoutInProgress || !debounceOver) && <PreloaderBlock message={t('MARK_AS_MOVING_OUT_DIALOG_MSG')} />}
        {showMoveoutNotAvailable && <FormattedMarkdown leftAlign>{`${t('MOVEOUT_NOT_AVAILABLE_DIALOG_MSG')}`}</FormattedMarkdown>}
      </MsgBox>
    );
  }
}
