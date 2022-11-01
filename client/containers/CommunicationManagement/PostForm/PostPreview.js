/*
 * Copyright (c) 2022 Reva Technology Inc., all rights reserved.
 * Unauthorized copying of this file, via any medium is strictly prohibited
 * Licensed under the Elastic License 2.0; you may not use this file except
 * in compliance with the Elastic License 2.0.
 */

import React, { PureComponent } from 'react';
import { reaction } from 'mobx';
import { Iframe } from 'components';
import debounce from 'debouncy';

import { cf } from './PostPreview.scss';
import { getResidentSrc } from '../../../helpers/postPreview';

const UPDATE_PREVIEW_THRESHOLD = 2000;

export class PostPreview extends PureComponent {
  constructor(props) {
    super(props);
    this.postPreviewSrc = getResidentSrc();
  }

  componentDidMount() {
    const {
      post: {
        postEditorModel: { formModel, uploadHeroModel },
      },
    } = this.props;

    this.updatePreview();

    this.stopReaction = reaction(
      () => [formModel?.getValidFieldValues, uploadHeroModel.filesUploaded, uploadHeroModel.allFilesInQueueAreDeleted],
      () => {
        this.updatePreview();
      },
    );
  }

  componentWillUnmount() {
    this.stopReaction && this.stopReaction();
  }

  updatePreview = debounce(() => {
    const {
      post: {
        postEditorModel: { formModel, currentPost = {}, uploadHeroModel },
      },
      currentUserFullName,
    } = this.props;

    const heroImageURL =
      !uploadHeroModel?.currentTracker?.deleted && !uploadHeroModel?.isUploading && (uploadHeroModel?.currentTracker?.s3Url || currentPost?.heroImageURL);

    const { title = '', message = '', messageDetails = '' } = formModel?.getValidFieldValues ?? {};

    const { updatedBy, sentAt } = currentPost;

    this?.iframe?.postMessage({
      title,
      message,
      messageDetails,
      heroImageURL,
      createdBy: updatedBy || currentUserFullName,
      sentAt: sentAt || new Date().toISOString(),
    });
  }, UPDATE_PREVIEW_THRESHOLD);

  render() {
    return (
      <Iframe
        onLoad={() => this.updatePreview()}
        id="post-preview"
        src={this.postPreviewSrc}
        className={cf('iframe')}
        ref={node => {
          this.iframe = node;
        }}
      />
    );
  }
}
