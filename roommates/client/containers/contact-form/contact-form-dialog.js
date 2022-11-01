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
import { Dialog, DialogOverlay } from 'components';
import { MessageForm } from './message-form';
import { SuggestedConversationTopics } from './suggested-conversation-topics';
import { cf } from './contact-form-dialog.scss';

export class ContactFormDialog extends Component {
  constructor(props) {
    super(props);
    this.id = generateId(this);
  }

  static propTypes = {
    open: PropTypes.bool,
    onSubmit: PropTypes.func,
    onCancel: PropTypes.func,
    contactFormModel: PropTypes.object,
  };

  render() {
    const { onSubmit, onCancel, id, open, contactFormModel } = this.props;
    const theId = clsc(id, this.id);
    return (
      <Dialog open={open} id={theId} onClosing={onCancel}>
        <DialogOverlay container={false}>
          <div className={cf('contact-form-wrapper')}>
            <div>
              <MessageForm onSubmit={onSubmit} onCancel={onCancel} contactFormModel={contactFormModel} />
            </div>
            <div>
              <SuggestedConversationTopics contactFormModel={contactFormModel} />
            </div>
          </div>
        </DialogOverlay>
      </Dialog>
    );
  }
}
