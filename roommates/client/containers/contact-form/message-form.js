/*
 * Copyright (c) 2022 Reva Technology Inc., all rights reserved.
 * Unauthorized copying of this file, via any medium is strictly prohibited
 * Licensed under the Elastic License 2.0; you may not use this file except
 * in compliance with the Elastic License 2.0.
 */

import PropTypes from 'prop-types';
import React, { Component } from 'react';
import { observer } from 'mobx-react';
import { t } from 'i18next';
import { Button, Typography as T, TextBox } from 'components';
import trim from 'lodash/trim';
import { cf } from './message-form.scss';

@observer
export class MessageForm extends Component {
  static propTypes = {
    contactFormModel: PropTypes.object,
  };

  constructor(props, context) {
    super(props, context);
    this.state = {
      message: '',
    };
  }

  get isSubmitDisabled() {
    const { message } = this.state;
    return !trim(message);
  }

  updateMessage = message => this.setState({ message });

  handleOnChange = e => {
    this.setState({ message: e.value });
  };

  handleOnClick = () => {
    const { onSubmit } = this.props;
    onSubmit && onSubmit(this.state.message);
  };

  render() {
    const {
      onCancel,
      contactFormModel: {
        applicantName,
        propertyName,
        roommate: { preferredName },
      },
    } = this.props;
    return (
      <div className={cf('message-form-container')}>
        <div className={cf('form')}>
          <div className={cf('to')}>
            <T.Text inline secondary>{`${t('ROOMMATE_MESSAGE_TO')}: `}</T.Text> <T.Text inline>{preferredName}</T.Text>
            <T.Text inline secondary>{` (${t('ROOMMATES_EMAIL_PRIVACY_NOTE')})`}</T.Text>
          </div>
          <div className={cf('subject')}>
            <T.Text>
              {t('ROOMMATE_MESSAGE_SUBJECT', {
                applicant: applicantName,
                property: propertyName,
              })}
            </T.Text>
          </div>
          <div className={cf('message')}>
            <TextBox placeholder={t('ROOMMATE_MESSAGE_PLACEHOLDER')} multiline autoResize={false} autoFill onChange={this.handleOnChange} />
          </div>
        </div>
        <div className={cf('actions')}>
          <Button type="flat" btnRole="secondary" label={t('CANCEL')} onClick={onCancel} />
          <Button type="raised" onClick={this.handleOnClick} label={t('SEND')} disabled={this.isSubmitDisabled} />
        </div>
      </div>
    );
  }
}
