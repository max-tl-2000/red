/*
 * Copyright (c) 2022 Reva Technology Inc., all rights reserved.
 * Unauthorized copying of this file, via any medium is strictly prohibited
 * Licensed under the Elastic License 2.0; you may not use this file except
 * in compliance with the Elastic License 2.0.
 */

import React, { Component } from 'react';
import { computed, action, observable, reaction } from 'mobx';
import { t } from 'i18next';
import { Typography, TextBox, Button, FormField, SimpleUploader, ErrorMessage, RichEditor, MsgBox, Dropdown, Icon } from 'components';
import { inject, observer, Observer } from 'mobx-react';
import { connect } from 'react-redux';
import notifier from '../../../helpers/notifier/notifier';
import { InformationOutline } from '../../../red-icons/index';
import { cf } from './PostForm.scss';
import PostInfoSection from './PostInfoSection';
import {
  ANNOUNCEMENT_MESSAGE_CHARACTERS_LIMIT,
  POST_TITLE_CHARACTERS_LIMIT,
  ANNOUNCEMENT_MESSAGE_DETAILS_CHARACTERS_LIMIT,
  MIN_ANNOUNCEMENT_MESSAGE_CHARACTERS_REMAINING,
} from '../../../mobx/helpers/post';
import mediator from '../../../helpers/mediator';
import EventTypes from '../../../../common/enums/eventTypes';
import { RetractedPostReasons } from '../../../../common/enums/enums';
import { calculatePostCharactersRemaining } from '../../../helpers/postHelpers';
import { toMoment, formatMoment } from '../../../../common/helpers/moment-utils.ts';
import { SHORT_ORDINAL_DAY_MONTH_FORMAT } from '../../../../common/date-constants';

const { Text, Caption } = Typography;

@connect(state => ({
  users: state.globalStore.get('users'),
}))
@inject('post', 'auth')
@observer
export default class AnnouncementForm extends Component {
  @computed
  get titleCharactersRemaining() {
    const { post } = this.props;
    const { postEditorModel } = post;
    const { formModel } = postEditorModel;
    const { fields } = formModel;
    const { title } = fields;

    return calculatePostCharactersRemaining(POST_TITLE_CHARACTERS_LIMIT, title.value?.length);
  }

  @observable
  messageDetailsClicked = false;

  @observable
  retractPostDialogOpen = false;

  @observable
  retractedReason;

  componentDidMount = () => {
    const {
      post: { postEditorModel },
    } = this.props;

    if (postEditorModel.postId) {
      mediator.on(`${EventTypes.POST_SENT}_${postEditorModel.postId}`, this.handlePostSentNotification);
    } else {
      this.stopPostIdChangeReaction = reaction(
        () => {
          const { postId } = postEditorModel;
          return { postId };
        },
        ({ postId }) => {
          mediator.on(`${EventTypes.POST_SENT}_${postId}`, this.handlePostSentNotification);
          this.stopPostIdChangeReaction?.();
        },
      );
    }
  };

  componentWillUnmount = () => {
    const {
      post: { postEditorModel },
    } = this.props;

    mediator.off(`${EventTypes.POST_SENT}_${postEditorModel.postId}`, this.handlePostSentNotification);
    this.stopPostIdChangeReaction?.();
  };

  handlePostSentNotification = (e, data) => {
    const {
      post: { postEditorModel },
    } = this.props;

    postEditorModel.sentPostNotificationReceived(data?.post?.sentBy);
  };

  onTitleChange = (args, field) => field.setValue(args.value);

  @action
  onClickAddMoreContent = () => {
    this.messageDetailsClicked = true;
  };

  @action
  setRetractPostReason = ({ item }) => {
    this.retractedReason = item.id;
  };

  @action
  handleNotification = (e, data) => {
    const {
      post: { postEditorModel },
    } = this.props;
    postEditorModel.uploadModel.notifyFileUploaded(data.fileIds);
  };

  handleSubmit = async () => {
    const {
      openPostAlreadySentDlg,
      close: closeAnnouncementFormDlg,
      post: { postEditorModel },
    } = this.props;

    if (postEditorModel.sentByNotification) {
      openPostAlreadySentDlg();
      return;
    }

    const { formModel, uploadModel } = postEditorModel;
    await formModel.validate();

    if (!formModel.valid || !uploadModel.filesReady) return;

    const sendPostSuccess = await postEditorModel.sendPost();

    if (!sendPostSuccess) {
      return;
    }

    closeAnnouncementFormDlg();
  };

  handleRetractPost = async () => {
    const { post, close } = this.props;

    await post.retractPost(post.currentPost.id, this.retractedReason);

    notifier.success(t('POST_WAS_SUCCESSFULLY_RETRACTED'));
    post.refreshSentPostList();
    close();
  };

  renderPlaceholder = () => (
    <div className={cf('dropzone-placeholder')}>
      <Text secondary={this.props.post.postEditorModel.isReadOnly}>{t('RECIPIENT_LIST')}</Text>
      <Text secondary>{t('UPLOAD_OR_DRAG_AND_DROP_FILE')}</Text>
    </div>
  );

  renderUploadDescription = () => (
    <div className={cf('dropzoneInfo')}>
      <InformationOutline className={cf('icon')} />
      <Caption secondary>{t('UPLOAD_OR_DRAG_AND_DROP_FILE_DESCRIPTION')}</Caption>
    </div>
  );

  renderHeroUploadPlaceholder = () => (
    <div className={cf('dropzone-placeholder')}>
      <Text secondary={this.props.post.postEditorModel.isReadOnly}>{t('UPLOAD_OPTIONAL_BANNER_IMAGE')}</Text>
      <Text secondary>{t('UPLOAD_OR_DRAG_AND_DROP_FILE')}</Text>
    </div>
  );

  renderHeroUploadDescription = () => (
    <div className={cf('dropzoneInfo')}>
      <InformationOutline className={cf('icon')} />
      <Caption secondary>{t('UPLOAD_OPTIONAL_BANNER_IMAGE_DESCRIPTION')}</Caption>
    </div>
  );

  shouldDisplayTitleRemainingCharacters = field => !field.errorMessage && this.titleCharactersRemaining <= 20;

  shouldDisplayMessageDetails = messageDetails => this.messageDetailsClicked || messageDetails?.value?.length;

  @action
  toggleRetractPostDialog = open => {
    this.retractPostDialogOpen = open;
    this.retractedReason = '';
  };

  @action
  handleDownload = entry => {
    const { auth } = this.props;
    const { token: userToken } = auth;

    const { postEditorModel } = this.props.post;

    postEditorModel.requestDocumentDownload(entry, userToken);
  };

  @action
  handleHeroImage = entry => {
    const { auth } = this.props;
    const { token: userToken } = auth;

    const { postEditorModel } = this.props.post;

    postEditorModel.requestHeroImageDownload(entry, userToken);
  };

  @action
  handleImagesUpload = async files => {
    const { postEditorModel } = this.props.post;
    const { postsImagesUploadModel } = postEditorModel;
    if (!postEditorModel.isSavedPost) {
      await postEditorModel.savePost();
    }
    const results = await postsImagesUploadModel.addFilesToQueue(files);
    return (results || []).filter(result => result.success).map(result => result.s3Url);
  };

  @action
  handleDownloadPostRecipientsResult = () => {
    const { auth } = this.props;
    const { token: userToken } = auth;

    const { postEditorModel } = this.props.post;

    postEditorModel.requestPostRecipientDownload(userToken);
  };

  render() {
    const { post, users, openPostAlreadySentDlg } = this.props;
    const { postEditorModel, matchingResidentCodes, totalResidentCodes } = post;
    const { formModel, uploadModel, uploadHeroModel, isSendingPost, sendPostError, sentByNotification } = postEditorModel;
    const { fields } = formModel;
    const retractedReasonsValues = Object.keys(RetractedPostReasons).map(key => ({ id: key, text: t(key) }));
    const user = users.get(sentByNotification);
    const retractedDate = formatMoment(toMoment(postEditorModel.currentPost?.retractedAt), { format: SHORT_ORDINAL_DAY_MONTH_FORMAT });
    const retractedBy = postEditorModel.currentPost?.metadata?.retractDetails?.retractedBy;
    const retractedReason = t(`${postEditorModel.currentPost?.metadata?.retractDetails?.retractedReason}`);

    return (
      <div className={cf('formContainer')} data-container="post-container">
        {(sentByNotification || !!postEditorModel.currentPost) && (
          <PostInfoSection post={postEditorModel.currentPost} isReadOnly={postEditorModel.isReadOnly} user={user} />
        )}
        {postEditorModel.currentPost?.retractedAt && (
          <div className={cf('retractedResonBanner')}>
            <Icon name="alert" className={cf('alert-icon')} />
            <Text secondary>{t('RETRACTED_POST_BANNER_TEXT', { retractedDate, retractedBy, retractedReason })}</Text>
          </div>
        )}

        <div className={cf('postForm')}>
          <div>
            <div className={cf('uploaderContainer')}>
              <SimpleUploader
                onDownloadRequest={this.handleDownload}
                placeholder={this.renderPlaceholder()}
                uploadDescription={this.renderUploadDescription()}
                uploadModel={uploadModel}
                readOnly={postEditorModel.isReadOnly}
                onClearQueue={post.resetMatchingResidents}
                onBeforeHandleDrop={args => {
                  if (sentByNotification) {
                    openPostAlreadySentDlg?.();
                    args.cancel = true;
                  }
                }}
                onDeleteFile={() => post.resetMatchingResidents()}
              />
              {!!matchingResidentCodes && (
                <div className={cf('uploadMessage')}>
                  <Text className={cf('uploadCompleteMsg')}>{t('POST_SENT_TO_RESIDENTS', { matchingResidentCodes, totalResidentCodes })}</Text>
                  <a className={cf('downloadMessage')} onClick={this.handleDownloadPostRecipientsResult}>
                    {t('DOWNLOAD_DETAILS')}
                  </a>
                </div>
              )}
            </div>
            <FormField
              fieldStyle={{ marginTop: '1.5rem' }}
              fullWidth
              Component={TextBox}
              label={t('TITLE')}
              field={fields.title}
              wide
              onChange={args => this.onTitleChange(args, fields.title)}
              disabled={postEditorModel.isReadOnly}
            />
            {this.shouldDisplayTitleRemainingCharacters(fields.title) && (
              <Caption secondary>{t('MESSAGE_CHARACTERS_REMAINING', { count: this.titleCharactersRemaining })}</Caption>
            )}
            <div className={cf('uploaderContainer')}>
              <SimpleUploader
                style={{ marginTop: '1.5rem' }}
                onDownloadRequest={this.handleHeroImage}
                placeholder={this.renderHeroUploadPlaceholder()}
                uploadDescription={this.renderHeroUploadDescription()}
                uploadModel={uploadHeroModel}
                readOnly={postEditorModel.isReadOnly}
                onBeforeHandleDrop={args => {
                  if (sentByNotification) {
                    openPostAlreadySentDlg?.();
                    args.cancel = true;
                  }
                }}
              />
            </div>
            <div className={cf('richEditorWrapper')}>
              <Observer>
                {() => (
                  <RichEditor
                    overlayContainer={'[data-container="post-container"]'}
                    editorKey="re-message"
                    spellCheck
                    placeholder={t('MESSAGE')}
                    readOnly={postEditorModel.isReadOnly}
                    field={fields.message}
                    rawField={fields.rawMessage}
                    rawEditorContent={fields.rawMessageEditorContent}
                    onChange={args => this.onTitleChange(args, fields.title)}
                    characterLimit={ANNOUNCEMENT_MESSAGE_CHARACTERS_LIMIT}
                    minCharactersRemainingWarning={MIN_ANNOUNCEMENT_MESSAGE_CHARACTERS_REMAINING}
                    inlineToolbarFeatures={['bold', 'italic', 'link']}
                  />
                )}
              </Observer>
            </div>
            {!postEditorModel.isReadOnly && !this.shouldDisplayMessageDetails(fields.messageDetails) && (
              <Button type="flat" useWaves label={t('ADD_MORE_CONTENT')} onClick={this.onClickAddMoreContent} />
            )}
            <div className={cf('richEditorWrapper')}>
              {!!this.shouldDisplayMessageDetails(fields.messageDetails) && (
                <Observer>
                  {() => (
                    <RichEditor
                      editorKey="re-message-details"
                      overlayContainer={'[data-container="post-container"]'}
                      spellCheck
                      placeholder={t('MESSAGE_DETAILS')}
                      readOnly={postEditorModel.isReadOnly}
                      onImagesUploadRequest={this.handleImagesUpload}
                      field={fields.messageDetails}
                      rawField={fields.rawMessageDetails}
                      rawEditorContent={fields.rawMessageDetailsEditorContent}
                      characterLimit={ANNOUNCEMENT_MESSAGE_DETAILS_CHARACTERS_LIMIT}
                      sideToolbarFeatures={['image', 'video', 'divider']}
                      inlineToolbarFeatures={[
                        'bold',
                        'italic',
                        'underline',
                        'code',
                        'headlines',
                        'unorderedList',
                        'orderedList',
                        'blockQuote',
                        'link',
                        'emoji',
                      ]}
                    />
                  )}
                </Observer>
              )}
            </div>
          </div>
          {!postEditorModel.isReadOnly && (
            <div className={cf('sendBtn')}>
              <Observer>
                {() => <Button isCohort onClick={this.handleSubmit} disabled={!postEditorModel.canSendPost} loading={isSendingPost} label={t('SEND_NOW')} />}
              </Observer>
            </div>
          )}
          {(sendPostError || postEditorModel.savePostError) && (
            <div className={cf('postError')}>
              <ErrorMessage message={t('POST_ERROR')} />
            </div>
          )}
          {postEditorModel.isReadOnly && (
            <div className={cf('retractContainer')}>
              <Button
                isCohort
                type="flat"
                useWaves
                label={t('RETRACT_POST')}
                disabled={postEditorModel.currentPost?.retractedAt}
                onClick={() => this.toggleRetractPostDialog(true)}
              />
            </div>
          )}
        </div>
        {this.retractPostDialogOpen && (
          <MsgBox
            open={this.retractPostDialogOpen}
            closeOnTapAway={false}
            id="retractPostDialog"
            lblOK={t('RETRACT')}
            onOKClick={this.handleRetractPost}
            btnOKDisabled={!this.retractedReason}
            lblCancel={t('CANCEL')}
            onCancelClick={() => this.toggleRetractPostDialog(false)}
            title={t('RETRACT_POST_TITLE')}
            onCloseRequest={() => this.toggleRetractPostDialog(false)}
            isCohort>
            <Text>{t('RETRACT_POST_MSG')}</Text>
            <Dropdown placeholder={t('RETRACT_POST_PLACEHOLDER')} wide onChange={this.setRetractPostReason} items={retractedReasonsValues} />
          </MsgBox>
        )}
      </div>
    );
  }
}
