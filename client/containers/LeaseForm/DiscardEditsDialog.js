/*
 * Copyright (c) 2022 Reva Technology Inc., all rights reserved.
 * Unauthorized copying of this file, via any medium is strictly prohibited
 * Licensed under the Elastic License 2.0; you may not use this file except
 * in compliance with the Elastic License 2.0.
 */

import PropTypes from 'prop-types';
import React, { Component } from 'react';
import { MsgBox, FormattedMarkdown } from 'components';
import { t } from 'i18next';
import { cf } from './DiscardEditsDialog.scss';

export default class DiscardEditsDialog extends Component {
  static propTypes = {
    open: PropTypes.bool,
    onDiscardEdits: PropTypes.func,
  };

  discardEdits = performDiscard => {
    const { onDiscardEdits } = this.props;
    onDiscardEdits && onDiscardEdits(performDiscard);
  };

  render = () => {
    const { open } = this.props;

    return (
      <MsgBox
        open={open}
        overlayClassName={cf('discard-edits-dialog')}
        title={t('DISCARD_CHANGES')}
        lblOK={t('DISCARD_CHANGES')}
        lblCancel={t('KEEP_EDITING')}
        onClose={() => this.discardEdits(false)}
        onOKClick={() => this.discardEdits(true)}
        onCancelClick={() => this.discardEdits(false)}>
        <FormattedMarkdown>{t('DISCARD_CHANGES_DETAILS')}</FormattedMarkdown>
      </MsgBox>
    );
  };
}
