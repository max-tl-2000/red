/*
 * Copyright (c) 2022 Reva Technology Inc., all rights reserved.
 * Unauthorized copying of this file, via any medium is strictly prohibited
 * Licensed under the Elastic License 2.0; you may not use this file except
 * in compliance with the Elastic License 2.0.
 */

import React, { Component } from 'react';
import { t } from 'i18next';
import { Typography, TextBox, Button, FormField, SimpleUploader, ErrorMessage, MsgBox, Dropdown, Icon } from 'components';
import { observer, inject, Observer } from 'mobx-react';
import { connect } from 'react-redux';
import { computed, reaction, action, observable } from 'mobx';
import { InformationOutline, Alert } from '../../../red-icons/index';
import { cf } from './PostForm.scss';
import PostInfoSection from './PostInfoSection';
import EmergencyMessageInfo from './EmergencyMessageInfo';
import { EMERGENCY_MESSAGE_CHARACTERS_LIMIT, POST_TITLE_CHARACTERS_LIMIT } from '../../../mobx/helpers/post';
import mediator from '../../../helpers/mediator';
import notifier from '../../../helpers/notifier/notifier';
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
export default class AlertForm extends Component {
  @computed
  get titleCharactersRemaining() {
    const { post } = this.props;
    const { postEditorModel } = post;
    const { formModel } = postEditorModel;
    const { fields } = formModel;
    const { title } = fields;

    return calculatePostCharactersRemaining(POST_TITLE_CHARACTERS_LIMIT, title.value?.length);
  }

  @computed
  get messageCharactersRemaining() {
    const { post } = this.props;
    const { postEditorModel } = post;
    const { formModel } = postEditorModel;
    const { fields } = formModel;
    const { message } = fields;

    return calculatePostCharactersRemaining(EMERGENCY_MESSAGE_CHARACTERS_LIMIT, message.value?.length);
  }

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

  onMessageChange = (args, field) => field.setValue(args.value);

  onTitleChange = (args, field) => field.setValue(args.value);

  shouldDisplayTitleRemainingCharacters = field => !field.errorMessage && this.titleCharactersRemaining <= 20;

  @action
  handleDownload = entry => {
    const { auth } = this.props;
    const { token: userToken } = auth;

    const { postEditorModel } = this.props.post;

    postEditorModel.requestDocumentDownload(entry, userToken);
  };

  @action
  handleDownloadPostRecipientsResult = () => {
    const { auth } = this.props;
    const { token: userToken } = auth;

    const { postEditorModel } = this.props.post;

    postEditorModel.requestPostRecipientDownload(userToken);
  };

  @action
  setRetractPostReason = ({ item }) => {
    this.retractedReason = item.id;
  };

  @action
  toggleRetractPostDialog = open => {
    this.retractPostDialogOpen = open;
    this.retractedReason = '';
  };

  handleRetractPost = async () => {
    const { post, close } = this.props;

    await post.retractPost(post.currentPost.id, this.retractedReason);

    notifier.success(t('POST_WAS_SUCCESSFULLY_RETRACTED'));
    post.refreshSentPostList();
    close();
  };

  displayBanner = () => {
    const {
      post: { postEditorModel },
      users,
    } = this.props;
    const { sentByNotification } = postEditorModel;

    const user = users.get(sentByNotification);

    if (sentByNotification || !!postEditorModel.currentPost) {
      return <PostInfoSection post={postEditorModel.currentPost} isReadOnly={postEditorModel.isReadOnly} user={user} />;
    }

    return <EmergencyMessageInfo />;
  };

  render() {
    const { postEditorModel, onSendNowClick, post, openPostAlreadySentDlg } = this.props;
    const { formModel, uploadModel, isSendingPost, sendPostError, sentByNotification } = postEditorModel;
    const { fields } = formModel;

    const retractedReasonsValues = Object.keys(RetractedPostReasons).map(key => ({ id: key, text: t(key) }));
    const retractedDate = formatMoment(toMoment(postEditorModel.currentPost?.retractedAt), { format: SHORT_ORDINAL_DAY_MONTH_FORMAT });
    const retractedBy = postEditorModel.currentPost?.metadata?.retractDetails?.retractedBy;
    const retractedReason = t(`${postEditorModel.currentPost?.metadata?.retractDetails?.retractedReason}`);

    const { matchingResidentCodes, totalResidentCodes } = post;

    return (
      <div className={cf('alertFormContainer')}>
        {this.displayBanner()}
        <Alert className={cf('watermark')} />
        {postEditorModel.currentPost?.retractedAt && (
          <div className={cf('retractedResonBanner')}>
            <Icon name="alert" className={cf('alert-icon')} />
            <Text secondary>{t('RETRACTED_POST_BANNER_TEXT', { retractedDate, retractedBy, retractedReason })}</Text>
          </div>
        )}

        <div className={cf('formContainer')}>
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
                readOnly={postEditorModel.isReadOnly}
              />
              {this.shouldDisplayTitleRemainingCharacters(fields.title) && (
                <Caption secondary>{t('MESSAGE_CHARACTERS_REMAINING', { count: this.titleCharactersRemaining })}</Caption>
              )}
              <FormField
                className={cf('message')}
                fieldStyle={{ marginTop: '1.5rem' }}
                noMargin
                fullWidth
                Component={TextBox}
                autoTrim={false}
                autoRemoveNewLines={true}
                label={t('MESSAGE')}
                multiline
                numRows={6}
                field={fields.message}
                wide
                onChange={args => this.onMessageChange(args, fields.message)}
                readOnly={postEditorModel.isReadOnly}
              />
              {!fields.message.errorMessage && <Caption secondary>{t('MESSAGE_CHARACTERS_REMAINING', { count: this.messageCharactersRemaining })}</Caption>}
            </div>
            {!postEditorModel.isReadOnly && (
              <div className={cf('sendBtn')}>
                <Observer>
                  {() => <Button isCohort onClick={onSendNowClick} disabled={!postEditorModel.canSendPost} loading={isSendingPost} label={t('SEND_NOW')} />}
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
      </div>
    );
  }
}
