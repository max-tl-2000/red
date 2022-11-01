/*
 * Copyright (c) 2022 Reva Technology Inc., all rights reserved.
 * Unauthorized copying of this file, via any medium is strictly prohibited
 * Licensed under the Elastic License 2.0; you may not use this file except
 * in compliance with the Elastic License 2.0.
 */

import PropTypes from 'prop-types';
import React, { Component } from 'react';
import generateId from 'helpers/generateId';
import { t } from 'i18next';
import clsc from 'helpers/coalescy';
import FlyOutOverlay from '../FlyOut/FlyOutOverlay';
import FlyOut from '../FlyOut/FlyOut';
import FlyOutActions from '../FlyOut/FlyOutActions';
import Button from '../Button/Button';
import Text from '../Typography/Text';
import { cf, g } from './InlineConfirm.scss';

export default class InlineConfirm extends Component {
  constructor(props, context) {
    super(props, context);
    this.id = generateId(this);
  }

  static propTypes = {
    content: PropTypes.any,
    overlayClassName: PropTypes.string,
    positionArgs: PropTypes.object,
    expandTo: PropTypes.string,
    onCancelClick: PropTypes.func,
    onOKClick: PropTypes.func,
    btnOkDisabled: PropTypes.bool,
    btnCancelDisabled: PropTypes.bool,
    lblCancel: PropTypes.string,
    lblOK: PropTypes.string,
  };

  render() {
    const {
      content,
      overlayClassName,
      children,
      positionArgs,
      expandTo,
      onCancelClick,
      onOKClick,
      btnOkDisabled,
      btnCancelDisabled,
      lblOK,
      lblCancel,
      passThru,
      width,
      ...props
    } = this.props;

    if (passThru) return children;

    const cancelLabel = clsc(lblCancel, t('CANCEL'));
    const okLabel = clsc(lblOK, t('OK'));

    const theContent = content && typeof content === 'string' ? <Text>{content}</Text> : content;

    return (
      <FlyOut positionArgs={positionArgs} expandTo={expandTo} {...props}>
        {children}
        <FlyOutOverlay style={{ width }} elevation={2} lazy container className={cf('overlayWrapper', g(overlayClassName))}>
          {theContent}
          <FlyOutActions>
            {cancelLabel && (
              <Button data-action="close" label={cancelLabel} btnRole="secondary" type="flat" onClick={onCancelClick} disabled={btnCancelDisabled} />
            )}
            {okLabel && <Button data-action="close" label={okLabel} type="flat" onClick={onOKClick} disabled={btnOkDisabled} />}
          </FlyOutActions>
        </FlyOutOverlay>
      </FlyOut>
    );
  }
}
