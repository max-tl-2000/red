/*
 * Copyright (c) 2022 Reva Technology Inc., all rights reserved.
 * Unauthorized copying of this file, via any medium is strictly prohibited
 * Licensed under the Elastic License 2.0; you may not use this file except
 * in compliance with the Elastic License 2.0.
 */

import PropTypes from 'prop-types';
import React, { Component } from 'react';
import { Field, TextBox } from 'components';
import { t } from 'i18next';
import { observer } from 'mobx-react';
import { createDialogFormModel } from './DialogFormModel';
import { cf } from './DeclineDialog.scss';
import DecisionDialog from './DecisionDialog';

@observer
export class DeclineDialog extends Component {
  static propTypes = {
    onDecline: PropTypes.func,
    leaseTermsLength: PropTypes.number,
    inventoryName: PropTypes.string,
  };

  constructor(props, context) {
    super(props, context);
    this.state = {
      model: createDialogFormModel(),
    };
  }

  handleDeclineClick = async () => {
    const { onDecline, formattedLeaseTermsLength, inventoryName } = this.props;
    const { model } = this.state;
    const { fields } = model;
    await model.validate();
    if (model.valid) {
      onDecline &&
        onDecline({
          additionalNotes: fields.additionalNotes.value,
          unit: inventoryName,
          leaseTermsLength: formattedLeaseTermsLength,
        });
    }
  };

  render = () => {
    const { dialogOpen, onCloseRequest, propertySettings } = this.props;
    const { model } = this.state;
    const { fields } = model;
    const subTitle = propertySettings?.applicationReview?.sendAALetterOnDecline ? t('DECLINE_DIALOG_SUBTITLE') : '';

    return (
      <DecisionDialog
        id="declineDialog"
        open={dialogOpen}
        onCloseRequest={onCloseRequest}
        onOkClick={this.handleDeclineClick}
        lblOK={t('DECLINE')}
        title={t('DECLINE_DIALOG_TITLE')}
        subTitle={subTitle}
        headerColor={cf('decline-header')}>
        <Field columns={12} noMargin>
          <TextBox
            placeholder={t('DIALOG_INTERNAL_ADDITIONAL_NOTES')}
            value={fields.additionalNotes.value}
            wide
            onChange={({ value }) => fields.additionalNotes.setValue(value)}
          />
        </Field>
      </DecisionDialog>
    );
  };
}
