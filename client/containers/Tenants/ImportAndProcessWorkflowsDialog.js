/*
 * Copyright (c) 2022 Reva Technology Inc., all rights reserved.
 * Unauthorized copying of this file, via any medium is strictly prohibited
 * Licensed under the Elastic License 2.0; you may not use this file except
 * in compliance with the Elastic License 2.0.
 */

import React, { Component } from 'react';
import { t } from 'i18next';
import { CheckBox, MsgBox, Typography, PreloaderBlock } from 'components';
import { cf } from './ImportAndProcessWorkflowDialog.scss';

const { Text, Caption } = Typography;

export default class ImportAndProcessWorkflowsDialog extends Component {
  constructor(props) {
    super(props);
    this.state = {
      doImport: this.props.enableImport,
      doProcess: true,
      alreadyClicked: false,
    };
  }

  handleCheckboxChange(name, value) {
    this.setState({ [`do${name}`]: value });
  }

  handleSubmit() {
    const { onOKClick } = this.props;
    const { doImport, doProcess } = this.state;

    onOKClick && onOKClick({ skipImport: !doImport, skipProcess: !doProcess });
    this.setState({ alreadyClicked: true });
  }

  handleOnCommand(args, finished, waitForResponse) {
    if (args.command === 'OK' && waitForResponse && !finished) args.autoClose = false;
  }

  render() {
    const {
      open,
      onClose,
      enableImport,
      hideNotes,
      propertyExternalId,
      isJobLoading = false,
      finished = false,
      processStatus = '',
      waitForResponse = false,
    } = this.props;
    const { doImport, doProcess, alreadyClicked } = this.state;

    return (
      <MsgBox
        id="importAndProcessWorkflowsDialog"
        overlayClassName={cf('importAndProcessDialog', { importAndProcessDialogLastStep: finished })}
        compact={false}
        open={open}
        onCloseRequest={onClose}
        onCommand={args => this.handleOnCommand(args, finished, waitForResponse)}
        title={t('IMPORT_RESIDENT_DATA_AND_PROCESS_WORKFLOWS_TITLE')}
        lblOK={finished ? t('OK') : t('RUN_JOB')}
        onOKClick={() => this.handleSubmit()}
        btnOKDisabled={(!doImport && !doProcess) || !waitForResponse ? alreadyClicked : isJobLoading}
        hideCancelButton={isJobLoading || finished}
        lblCancel={t('CANCEL')}>
        {(!waitForResponse || (waitForResponse && !isJobLoading && !finished)) && (
          <div>
            <div>
              <CheckBox
                label={t('IMPORT_RESIDENT_DATA')}
                checked={doImport}
                disabled={!enableImport}
                onChange={() => this.handleCheckboxChange('Import', !doImport)}
              />
              <Caption className={cf('textPadding')} secondary>
                {!propertyExternalId ? t('IMPORT_RESIDENT_DATA_MSG') : t('IMPORT_RESIDENT_DATA_MSG_FOR_PARTY')}
              </Caption>
            </div>
            <div>
              <CheckBox label={t('PROCESS_WORKFLOWS')} checked={doProcess} onChange={() => this.handleCheckboxChange('Process', !doProcess)} />
              <Caption className={cf('textPadding', { hideNotes })} secondary>
                {t('PROCESS_WORKFLOWS_MSG')}
              </Caption>
            </div>
            {!hideNotes && <Text>{t('IMPORT_RESIDENT_DATA_AND_PROCESS_WORKFLOWS_NOTE')}</Text>}
          </div>
        )}
        {waitForResponse && isJobLoading && <PreloaderBlock size="big" />}
        {waitForResponse && finished && <Caption> {t(processStatus)} </Caption>}
      </MsgBox>
    );
  }
}
