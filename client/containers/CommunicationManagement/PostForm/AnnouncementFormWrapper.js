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
import { connect } from 'react-redux';
import { observable, action, runInAction } from 'mobx';
import { findDOMNode } from 'react-dom';
import contains from 'helpers/contains';
import { PanelsContainer, LeftPanel, RightPanel } from 'components/DualPanelLayout/DualPanelLayout';
import { DALTypes } from '../../../../common/enums/DALTypes';
import AnnouncementForm from './AnnouncementForm';
import { createAnnouncementFormModel } from '../../../models/AnnouncementFormModel';
import { Delete } from '../../../red-icons/index';
import { cf } from './FormWrapper.scss';
import snackbar from '../../../helpers/snackbar/snackbar';
import DialogModel from '../../PartyPageUnified/DialogModel';
import { initializePost } from '../../../mobx/helpers/post';
import { shouldCloseDialog, dialogHasErrors, isSaveInProgress } from '../../../../common/helpers/cohortDialogUtils';
import { PostPreview } from './PostPreview';
import CommunicationManagementLayoutModel, { COMMUNICATION_MANAGEMENT_CUSTOM_BREAKPOINTS } from '../CommunicationManagementLayoutModel';

const { Text, Caption } = Typography;

@connect(state => ({
  users: state.globalStore.get('users'),
}))
@inject('post')
@observer
export default class AnnouncementFormWrapper extends Component {
  constructor(props) {
    super(props);

    this.discardDraftMsgBox = new DialogModel();
    this.deleteDraftMsgBox = new DialogModel();
    this.postAlreadySentMsgBox = new DialogModel();
    this.dualLayoutModel = new CommunicationManagementLayoutModel();
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
    const { isReadOnly } = postEditorModel;

    this.wasCloseRequested = true;

    if (postEditorModel.savePostError || postEditorModel.sendPostError || isReadOnly) {
      close();
      return;
    }

    if (postEditorModel.isExistingPostWithEmptyData) {
      this.discardDraftMsgBox.open();
      return;
    }

    if (!postEditorModel.isDirty || postEditorModel.sentByNotification) {
      close();
      return;
    }

    const postSaved = await postEditorModel.savePost();
    if (postSaved) {
      snackbar.show({ text: t('ANNOUNCEMENT_DRAFT_SAVED') });
    }
    return;
  };

  handleClose = () => {
    const { post } = this.props;
    post.postEditorModel.clearModels();
    this.wasCloseRequested = false;
    post.clearCurrentPost();
  };

  handleDeleteDraft = async () => {
    const {
      close,
      post: { postEditorModel },
    } = this.props;

    await postEditorModel.deletePost();
    close();
  };

  deleteIconShouldBeDisabled = () => {
    const {
      post: { postEditorModel },
    } = this.props;

    if (postEditorModel.sentByNotification) return true;

    return !postEditorModel?.uploadModel?.filesUploaded || !postEditorModel.isSavedPost;
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
          {this.dualLayoutModel.collapsed && (
            <IconButton
              key={'panelToggle'}
              ref={ref => (this.btnPreviewToggle = ref)}
              iconName="eye"
              iconStyle="light"
              onClick={this.dualLayoutModel.toggleRightPanel}
            />
          )}
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
      initializePost(postStore, createAnnouncementFormModel, DALTypes.PostCategory.ANNOUNCEMENT);
      this.loading = false;
    });
  };

  shouldDisplayForm() {
    if (!this.props.postId) return true;

    return !!this.props.post.currentPost && !this.loading;
  }

  checkIfClickOnTrigger = args => {
    // do not hide the panel if the click happen in the toggle trigger
    // the toggle will open/close the panel any way
    args.cancel = this.btnPreviewToggle && contains(findDOMNode(this.btnPreviewToggle), args.target);
  };

  renderForm = () => {
    const {
      users,
      close,
      post: { postEditorModel },
    } = this.props;

    const { fullName } = users.get(postEditorModel.sentByNotification) || {};

    if (postEditorModel.isReadOnly) {
      return <AnnouncementForm close={close} openPostAlreadySentDlg={this.postAlreadySentMsgBox.open} />;
    }

    return (
      <PanelsContainer
        model={this.dualLayoutModel}
        onRightPanelClickOutside={this.checkIfClickOnTrigger}
        customBreakpoints={COMMUNICATION_MANAGEMENT_CUSTOM_BREAKPOINTS}>
        <LeftPanel>
          <AnnouncementForm close={close} openPostAlreadySentDlg={this.postAlreadySentMsgBox.open} />
        </LeftPanel>
        <RightPanel className={cf('rPanel')}>
          <PostPreview post={this.props?.post} currentUserName={fullName} />
        </RightPanel>
      </PanelsContainer>
    );
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
          onCloseRequest={this.handleCloseRequest}
          onClose={this.handleClose}
          isCohort
          disabledCloseButton={isSaveInProgress(postEditorModel.savePostError, postEditorModel.sendPostError, postEditorModel._isOperationInProgress)}
          title={[
            <DialogTitle key="title">
              <span>{postEditorModel.currentPost?.title ? postEditorModel.currentPost?.title : t('CREATE_ANNOUNCEMENT')}</span>
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
          {this.shouldDisplayForm() && this.renderForm()}
        </FullScreenDialog>

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
