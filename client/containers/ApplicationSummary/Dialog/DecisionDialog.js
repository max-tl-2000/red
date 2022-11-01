/*
 * Copyright (c) 2022 Reva Technology Inc., all rights reserved.
 * Unauthorized copying of this file, via any medium is strictly prohibited
 * Licensed under the Elastic License 2.0; you may not use this file except
 * in compliance with the Elastic License 2.0.
 */

import PropTypes from 'prop-types';
import React, { Component } from 'react';
import generateId from 'helpers/generateId';
import clsc from 'helpers/coalescy';
import { t } from 'i18next';
import { Dialog, DialogOverlay, Button, Typography as T, DialogActions, DialogHeader, Form } from 'components';
import { cf, g } from './DecisionDialog.scss';

export default class DecisionDialog extends Component {
  constructor(props, context) {
    super(props, context);
    this.id = generateId(this);
  }

  static propTypes = {
    open: PropTypes.bool,
    lblOK: PropTypes.string,
    onOkClick: PropTypes.func,
    lblCancel: PropTypes.string,
    onCancelClick: PropTypes.func,
    headerColor: PropTypes.string,
    title: PropTypes.string,
  };

  static defaultProps = {
    lblOK: 'OK',
  };

  renderHeaderTitle = title => (
    <T.Title lighter bold>
      {title}
    </T.Title>
  );

  handleCloseRequest = element => {
    const { onCloseRequest } = this.props;
    if (onCloseRequest) {
      onCloseRequest({ source: 'dataAction', target: element.target });
      return;
    }
  };

  render() {
    const { lblOK, actionName, onOkClick, title, subTitle, children, headerColor, id, open, okButtonDisabled = false, ...rest } = this.props;

    const theId = clsc(id, this.id);

    return (
      <Dialog open={open} id={theId} {...rest}>
        <DialogOverlay>
          <DialogHeader title={this.renderHeaderTitle(title)} className={cf(g(headerColor))} />
          <T.Text className={cf('dialog-subtitle')} secondary>
            {subTitle}
          </T.Text>
          <Form className={cf('action-dialog')}>{children}</Form>
          <DialogActions className={cf('dialog-actions')}>
            <Button type="flat" btnRole="secondary" label={t('CANCEL')} onClick={this.handleCloseRequest} />
            <Button type="flat" onClick={onOkClick} label={lblOK} data-action="OK" disabled={okButtonDisabled} />
          </DialogActions>
        </DialogOverlay>
      </Dialog>
    );
  }
}
