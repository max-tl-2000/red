/*
 * Copyright (c) 2022 Reva Technology Inc., all rights reserved.
 * Unauthorized copying of this file, via any medium is strictly prohibited
 * Licensed under the Elastic License 2.0; you may not use this file except
 * in compliance with the Elastic License 2.0.
 */

import React, { Component } from 'react';
import { FullScreenDialog, DialogTitle, MsgBox, Typography, DialogHeaderActions, IconButton } from 'components';
import { t } from 'i18next';
import { observer, inject, Observer } from 'mobx-react';
import { observable, action, runInAction } from 'mobx';
import { connect } from 'react-redux';
import AlertForm from './AlertForm';
import { createAlertFormModel } from '../../../models/AlertFormModel';
import { Delete, Alert } from '../../../red-icons/index';
import { cf } from './FormWrapper.scss';
import snackbar from '../../../helpers/snackbar/snackbar';
import DialogModel from '../../PartyPageUnified/DialogModel';
import { DALTypes } from '../../../../common/enums/DALTypes';
import { initializePost } from '../../../mobx/helpers/post';
import { shouldCloseDialog, dialogHasErrors, isSaveInProgress } from '../../../../common/helpers/cohortDialogUtils';

const { Text, Caption } = Typography;

@connect(state => ({
  users: state.globalStore.get('users'),
}))
@inject('post')
@observer
export default class AlertFormWrapper extends Component {
  constructor(props) {
    super(props);
    this.wasCloseRequested = false;
    this.deleteDraftMsgBox = new DialogModel();
    this.discardDraftMsgBox = new DialogModel();
    this.sendAlertMsgBox = new DialogModel();
    this.postAlreadySentMsgBox = new DialogModel();
  }

  componentDidUpdate = () => {
    const {
      close,
      post: { postEditorModel },
    } = this.props;

    const closeDialog = shouldCloseDialog(this.wasCloseRequested, postEditorModel._wasOperationCompleted, postEditorModel._isOperationInProgress);
    if (closeDialog) {
      this.wasCloseRequested = false;
      close();
    }
    if (dialogHasErrors(postEditorModel.savePostError, postEditorModel.sendPostError)) {
      postEditorModel.setIsOperationInProgressAndStatus(false, false);
    }
  };

  handleCloseRequest = async () => {
    const {
      close,
      post: { postEditorModel },
    } = this.props;
    const { formModel, isReadOnly } = postEditorModel;
    this.wasCloseRequested = true;

    if (postEditorModel.savePostError || postEditorModel.sendPostError || isReadOnly) {
      close();
      return;
    }

    if (!postEditorModel.isDirty || postEditorModel.sentByNotification) {
      close();
      return;
    }

    if (postEditorModel.isExistingPostWithEmptyData) {
      this.discardDraftMsgBox.open();
      return;
    }

    const postSaved = await postEditorModel.savePost(formModel.getValidDraftFieldValues);
    if (postSaved) {
      snackbar.show({ text: t('EMERGENCY_MESSAGE_DRAFT_SAVED') });
      return;
    }
  };

  handleDeleteDraft = async () => {
    const {
      close,
      post: { postEditorModel },
    } = this.props;
    await postEditorModel.deletePost();
    close();
  };

  handleSendAlert = async () => {
    const {
      close: closeAlertFormDlg,
      post: { postEditorModel },
    } = this.props;

    if (postEditorModel.sentByNotification) {
      this.postAlreadySentMsgBox.open();
      return;
    }

    const { formModel, uploadModel } = postEditorModel;
    await formModel.validate();

    if (!formModel.valid || !uploadModel.filesReady) return;

    const sendPostSuccess = await postEditorModel.sendPost();
    if (!sendPostSuccess) {
      return;
    }

    closeAlertFormDlg();
  };

  deleteIconShouldBeDisabled = () => {
    const {
      post: { postEditorModel },
    } = this.props;

    if (postEditorModel.sentByNotification) return true;

    return !postEditorModel.uploadModel?.filesUploaded || !postEditorModel.isSavedPost;
  };

  renderDialogActions = () => (
    <Observer>
      {() => (
        <DialogHeaderActions>
          <IconButton
            disabled={this.deleteIconShouldBeDisabled()}
            onClick={() => this.deleteDraftMsgBox.open()}
            iconName={() => <Delete className={cf('icon')} />}
          />
        </DialogHeaderActions>
      )}
    </Observer>
  );

  @observable
  loading = false;

  @action
  handleOpening = async () => {
    const { postId, post: postStore } = this.props;
    this.loading = true;
    if (postId) {
      await postStore.loadPostById(postId);
    }

    runInAction(() => {
      initializePost(postStore, createAlertFormModel, DALTypes.PostCategory.EMERGENCY);
      this.loading = false;
    });
  };

  shouldDisplayForm() {
    if (!this.props.postId) return true;

    return !!this.props.post.currentPost && !this.loading;
  }

  handleClose = () => {
    const { post } = this.props;

    post.postEditorModel.clearModels();
    post.clearCurrentPost();
  };

  handleSendNowClick = () => {
    const {
      post: { postEditorModel },
    } = this.props;

    if (postEditorModel.sentByNotification) {
      this.postAlreadySentMsgBox.open();
      return;
    }

    this.sendAlertMsgBox.open();
  };

  render() {
    const {
      users,
      isOpen,
      close,
      post: { postEditorModel },
    } = this.props;

    const { fullName } = users.get(postEditorModel.sentByNotification) || {};

    return (
      <div>
        <FullScreenDialog
          onOpening={this.handleOpening}
          open={isOpen}
          onClose={this.handleClose}
          onCloseRequest={() => this.handleCloseRequest()}
          isCohort
          disabledCloseButton={isSaveInProgress(postEditorModel.savePostError, postEditorModel.sendPostError, postEditorModel._isOperationInProgress)}
          title={[
            <DialogTitle key="title">
              <span>{postEditorModel.currentPost?.title ? postEditorModel.currentPost?.title : t('CREATE_EMERGENCY_MESSAGE')}</span>
            </DialogTitle>,
            this.props.postId && !postEditorModel.isReadOnly && (
              <Caption key="caption" lighter={true} className={cf('draftLabel')}>
                ({t('DRAFT')})
              </Caption>
            ),
            isSaveInProgress(postEditorModel.savePostError, postEditorModel.sendPostError, postEditorModel._isOperationInProgress) && (
              <Text key="progress" lighter={true} className={cf('draftLabel')}>
                {t('SAVE_START')}
              </Text>
            ),
          ]}
          actions={!postEditorModel.isReadOnly && this.renderDialogActions()}>
          {this.shouldDisplayForm() && (
            <AlertForm
              sendingPostError={this.sendingPostError}
              postEditorModel={postEditorModel}
              close={close}
              onSendNowClick={this.handleSendNowClick}
              openPostAlreadySentDlg={this.postAlreadySentMsgBox.open}
            />
          )}
        </FullScreenDialog>

        <Observer>
          {() => (
            <MsgBox
              title={t('SENT_EMERGENCY_MSG_BOX_TITLE')}
              open={this.sendAlertMsgBox.isOpen}
              lblOK={t('SEND_ALERT_CONFIRMATION')}
              lblCancel={t('CANCEL')}
              overlayClassName={cf('alertMsgDialog')}
              onOKClick={this.handleSendAlert}
              onCloseRequest={() => this.sendAlertMsgBox.close()}
              isCohort>
              <Alert className={cf('watermarkMsgDialog')} />
              <div className={cf('alertDialogBody')}>
                <Text className={cf('alertDescription')}>{t('SENT_EMERGENCY_MSG_BOX_DESCRIPTION')}</Text>
                <Text>{t('SENT_EMERGENCY_MSG_BOX_DESCRIPTION_QUESTION')}</Text>
              </div>
            </MsgBox>
          )}
        </Observer>
        <Observer>
          {() => (
            <MsgBox
              title={`${t('DELETE_DRAFT')}?`}
              open={this.deleteDraftMsgBox.isOpen}
              lblOK={t('DELETE_DRAFT')}
              lblCancel={t('CANCEL')}
              onOKClick={this.handleDeleteDraft}
              onCloseRequest={() => this.deleteDraftMsgBox.close()}
              isCohort>
              <Text>{t('DELETE_DRAFT_QUESTION')}</Text>
            </MsgBox>
          )}
        </Observer>
        <Observer>
          {() => (
            <MsgBox
              title={`${t('DISCARDED_MSG_BOX_TITLE')}?`}
              open={this.discardDraftMsgBox.isOpen}
              lblOK={t('DISCARD_MSG_BOX_CONFIRMATION')}
              lblCancel={t('CANCEL')}
              onOKClick={this.handleDeleteDraft}
              onCloseRequest={() => this.discardDraftMsgBox.close()}
              isCohort>
              <Text>{t('DISCARDED_MSG_BOX_DESCRIPTION')}</Text>
            </MsgBox>
          )}
        </Observer>
        <Observer>
          {() => (
            <MsgBox
              title={`${t('MESSAGE_ALREADY_SENT_MSG_BOX_TITLE')}`}
              open={this.postAlreadySentMsgBox.isOpen}
              lblOK={t('EXIT_DRAFT_MSG_BOX_CONFIRMATION')}
              lblCancel={t('CANCEL')}
              onOKClick={close}
              onCloseRequest={() => this.postAlreadySentMsgBox.close()}
              isCohort>
              <Text>{t('MESSAGE_ALREADY_SENT_MSG_BOX_DESCRIPTION', { sentBy: fullName })}</Text>
            </MsgBox>
          )}
        </Observer>
      </div>
    );
  }
}
