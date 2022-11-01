/*
 * Copyright (c) 2022 Reva Technology Inc., all rights reserved.
 * Unauthorized copying of this file, via any medium is strictly prohibited
 * Licensed under the Elastic License 2.0; you may not use this file except
 * in compliance with the Elastic License 2.0.
 */

import React, { Component } from 'react';

import { createModel } from 'mobx-form';
import { t } from 'i18next';

import { observer } from 'mobx-react';
import TextBox from '../TextBox/TextBox';
import Button from '../Button/Button';
import utils from './video-plugin/video/utils';
import { cf } from './AddVideoPrompt.scss';

@observer
export class AddVideoPrompt extends Component {
  constructor(props) {
    super(props);
    this.model = createModel({
      descriptors: {
        url: {
          required: t('PLEASE_ADD_VIDEO_URL'),
          validator: field => {
            if (!utils.isYoutube(field.value) && !utils.isVimeo(field.value)) {
              throw new Error(t('PLEASE_ADD_VIDEO_URL'));
            }
          },
        },
      },
    });
  }

  requestToAddVideo = async () => {
    const { model } = this;

    const { addVideoURLRequest } = this.props;

    await model.validate();

    if (model.valid) {
      addVideoURLRequest?.(model.serializedData?.url);
    }
  };

  render() {
    const { url } = this.model.fields;
    return (
      <div className={cf('addVideoPrompt')}>
        <TextBox
          onEnterPress={this.requestToAddVideo}
          errorMessage={url.errorMessage}
          placeholder={t('PASTE_THE_VIDEO_URL')}
          value={url.value}
          onChange={({ value }) => url.setValue(value)}
          autoFocus
        />
        <Button onClick={this.requestToAddVideo} className={cf('addButton')} label={t('ADD')} />
      </div>
    );
  }
}
