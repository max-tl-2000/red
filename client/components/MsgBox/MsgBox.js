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
import trim from 'helpers/trim';
import Text from '../Typography/Text';

import Button from '../Button/Button';
import Dialog from '../Dialog/Dialog';
import DialogOverlay from '../Dialog/DialogOverlay';
import DialogActions from '../Dialog/DialogActions';
import { cf, g } from './MsgBox.scss';

export default class MsgBox extends Component {
  constructor(props, context) {
    super(props, context);
    this.id = generateId(this);
  }

  static propTypes = {
    id: PropTypes.string,
    open: PropTypes.bool,
    title: PropTypes.string,

    hideOkButton: PropTypes.bool,
    lblOK: PropTypes.string,
    btnOKDisabled: PropTypes.bool,
    onOKClick: PropTypes.func,

    hideCancelButton: PropTypes.bool,
    lblCancel: PropTypes.string,
    btnCancelDisabled: PropTypes.bool,
    onCancelClick: PropTypes.func,

    lblExtraButton: PropTypes.string,
    btnExtraButtonDisabled: PropTypes.bool,
    onExtraButtonClick: PropTypes.func,

    extraButton: PropTypes.object,
    overlayClassName: PropTypes.string,
    onCommand: PropTypes.func,
    content: PropTypes.any,

    btnExtraRole: PropTypes.string,
    btnOKRole: PropTypes.string,
    btnCancelRole: PropTypes.string,
  };

  getButtons() {
    const {
      lblOK,
      lblCancel,
      btnOKDisabled,
      btnCancelDisabled,
      extraButton,
      lblExtraButton,
      btnExtraButtonDisabled,
      btnExtraRole,
      btnOKRole,
      btnCancelRole,
      hideOkButton,
      hideCancelButton,
      isCohort,
    } = this.props;

    const theLblOK = clsc(lblOK, t('MSG_BOX_BTN_OK'));
    const theLblCancel = clsc(lblCancel, t('MSG_BOX_BTN_CANCEL'));
    const btnsMetadata = [];

    if (theLblOK && !hideOkButton) {
      btnsMetadata.unshift({
        label: theLblOK,
        disabled: btnOKDisabled,
        command: 'OK',
        btnRole: btnOKRole,
      });
    }

    if (theLblCancel && !hideCancelButton) {
      btnsMetadata.unshift({
        label: theLblCancel,
        disabled: btnCancelDisabled,
        command: 'CANCEL',
        btnRole: btnCancelRole,
      });
    }

    if (extraButton) {
      btnsMetadata.unshift(extraButton);
    } else if (lblExtraButton) {
      btnsMetadata.unshift({
        label: lblExtraButton,
        btnRole: btnExtraRole,
        command: 'EXTRA',
        disabled: btnExtraButtonDisabled,
      });
    }

    return btnsMetadata.reduce((seq, { command, label, disabled, btnRole }, i) => {
      if (!label || !command) return seq; // buttons without label or command should be discarded

      if (!btnRole) {
        btnRole = i === btnsMetadata.length - 1 ? 'primary' : 'secondary';
      }

      const key = `${command}_${i}`;
      // TODO: remove this and add it in a theme level
      const type = () => {
        if (isCohort) {
          return btnRole === 'secondary' ? 'flat' : 'raised';
        }

        return 'flat';
      };

      seq.push(
        <Button
          key={key}
          type={type()}
          disabled={disabled}
          label={label}
          btnRole={btnRole}
          onClick={e => this.handleActionTap(command, e)}
          data-command={command}
          isCohort={isCohort}
        />,
      );
      return seq;
    }, []);
  }

  handleActionTap = (command, e) => {
    const { onCommand, onOKClick, onCancelClick, onExtraButtonClick, onCloseRequest } = this.props;

    if (command) {
      const args = { command, autoClose: true };
      if (command === 'OK') {
        onOKClick && onOKClick(args);
      } else if (command === 'CANCEL') {
        onCancelClick && onCancelClick(args);
      } else {
        onExtraButtonClick && onExtraButtonClick(args);
      }

      onCommand && onCommand(args);
      if (args.autoClose) {
        if (onCloseRequest) {
          onCloseRequest({ source: 'dataAction', command, target: e.target });
          return;
        }

        this.dlg.close();
      }
    }
  };

  render() {
    const { className, open, title, titleIconName, titleIconClassName, container, content, compact, id, children, overlayClassName, ...rest } = this.props;

    const btns = this.getButtons();

    // use the provided id if provided or the default otherwise
    const theId = clsc(id, this.id);
    const compactMode = clsc(compact, true);
    const noTitle = !title;
    const contentId = `${theId}_contentTxt`;
    const theContent = typeof content === 'string' && trim(content) ? <Text id={contentId}>{content}</Text> : content;

    return (
      <Dialog ref={d => (this.dlg = d)} id={theId} className={className} open={open} {...rest}>
        <DialogOverlay
          data-id={`${theId}_dialogOverlay`}
          className={cf('dialog-overlay', { noTitle }, g(overlayClassName))}
          container={container}
          compact={compactMode}
          title={title}
          titleIconName={titleIconName}
          titleIconClassName={titleIconClassName}>
          {theContent}
          {children}
          {btns.length > 0 && <DialogActions data-button-count={btns.length}>{btns}</DialogActions>}
        </DialogOverlay>
      </Dialog>
    );
  }
}
