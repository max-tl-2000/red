/*
 * Copyright (c) 2022 Reva Technology Inc., all rights reserved.
 * Unauthorized copying of this file, via any medium is strictly prohibited
 * Licensed under the Elastic License 2.0; you may not use this file except
 * in compliance with the Elastic License 2.0.
 */

import React, { Component } from 'react';
import { observer, Observer, inject } from 'mobx-react';
import { connect } from 'react-redux';
import { t } from 'i18next';
import { Typography } from 'components';
import * as P from 'components/DualPanelLayout/DualPanelLayout';
import { observable, action, computed } from 'mobx';
import { findDOMNode } from 'react-dom';
import AppBar from '../../components/AppBar/AppBar';
import AppBarIconSection from '../../components/AppBar/AppBarIconSection';
import SideNavigationMenu from '../Dashboard/SideNavigationMenu';
import AppBarMainSection from '../../components/AppBar/AppBarMainSection';
import PostList from './PostList';
import LeftPanelContent from './LeftPanelContent';
import { cf } from './CommunicationManagement.scss';
import { toTitleCase } from '../../helpers/capitalize';
import AnnouncementFormWrapper from './PostForm/AnnouncementFormWrapper';
import AlertFormWrapper from './PostForm/AlertFormWrapper';
import DialogModel from '../PartyPageUnified/DialogModel';
import mediator from '../../helpers/mediator';
import EventTypes from '../../../common/enums/eventTypes';
import { DALTypes } from '../../../common/enums/DALTypes';
import snackbar from '../../helpers/snackbar/snackbar';
import ellipsis from '../../../common/helpers/ellipsis';
import { MAX_TITLE_LENGTH_FOR_SNACKBAR } from '../../mobx/helpers/post';
import SendGridSandboxEnabledWidget from './SendGridSandboxEnabledWidget';
import AppBarActions from '../../components/AppBar/AppBarActions';
import IconButton from '../../components/IconButton/IconButton';
import contains from '../../helpers/contains';
import CommunicationManagementLayoutModel, { COMMUNICATION_MANAGEMENT_CUSTOM_BREAKPOINTS } from './CommunicationManagementLayoutModel';

const { Title } = Typography;

@connect(state => ({
  loggedInUser: state.auth.user,
  users: state.globalStore.get('users'),
}))
@inject('post')
@observer
export default class CommunicationManagement extends Component {
  @observable _postId;

  @action
  setPostId(postId) {
    this._postId = postId;
  }

  @computed
  get postId() {
    return this._postId;
  }

  constructor(props) {
    super(props);
    const dualLayoutModel = new CommunicationManagementLayoutModel();
    this.createAnnouncementDlg = new DialogModel();
    this.createAlertDlg = new DialogModel();

    this.state = {
      dualLayoutModel,
    };
  }

  componentDidMount() {
    mediator.on(EventTypes.DOCUMENTS_UPLOADED, this.handleUploadDocumentNotification);
    mediator.on(EventTypes.DOCUMENTS_DELETED, this.handleDeleteDocumentNotification);
    mediator.on(EventTypes.POST_CREATED, this.handlePostCreatedNotification);
    mediator.on(EventTypes.POST_SENT, this.handlePostSentNotification);
    mediator.on(EventTypes.POST_DELETED, this.handlePostDeletedNotification);
    mediator.on(EventTypes.POST_UPDATED, this.handlePostUpdatedNotification);
  }

  componentWillUnmount() {
    mediator.off(EventTypes.DOCUMENTS_UPLOADED, this.handleUploadDocumentNotification);
    mediator.off(EventTypes.DOCUMENTS_DELETED, this.handleDeleteDocumentNotification);
    mediator.off(EventTypes.POST_CREATED, this.handlePostCreatedNotification);
    mediator.off(EventTypes.POST_SENT, this.handlePostSentNotification);
    mediator.off(EventTypes.POST_DELETED, this.handlePostDeletedNotification);
    mediator.off(EventTypes.POST_UPDATED, this.handlePostUpdatedNotification);
  }

  handlePostUpdatedNotification = (e, data) => {
    const { post: postStore } = this.props;
    const { post } = data;

    postStore.addDraftPost(post);
  };

  handlePostDeletedNotification = (e, data) => {
    const { post: postStore } = this.props;

    postStore.removeDraftPostFromList(data.postId);
  };

  handlePostSentNotification = (e, data) => {
    const { post: postStore } = this.props;
    const { post } = data;

    postStore.removeDraftPostFromList(post.id);
    postStore.refreshSentPostList();

    const trans = post.category === DALTypes.PostCategory.ANNOUNCEMENT ? 'ANNOUNCEMENT_SENT' : 'EMERGENCY_MESSAGE_SENT';
    snackbar.show({ text: t(trans, { title: ellipsis(post.title, MAX_TITLE_LENGTH_FOR_SNACKBAR) }) });
  };

  handlePostCreatedNotification = (e, data) => {
    const { post: postStore } = this.props;

    postStore.addDraftPost(data.post);
  };

  @action
  handleUploadDocumentNotification = (e, data) => {
    const { post } = this.props;

    data.postId && post.addFileMetadataToPostDraft(data.postId, data.files[0]);
  };

  handleDeleteDocumentNotification = (e, data) => {
    const { post } = this.props;

    post.deleteFileMetadataFromPost(data.postId);
  };

  handleOpenPostForm = async (category, postId) => {
    this.setPostId(postId);

    category === DALTypes.PostCategory.ANNOUNCEMENT ? this.createAnnouncementDlg.open() : this.createAlertDlg.open();
  };

  checkIfClickOnTrigger = args => {
    // do not hide the panel if the click happen in the toggle trigger
    // the toggle will open/close the panel any way
    args.cancel = this.btnCommsToggle && contains(findDOMNode(this.btnCommsToggle), args.target);
  };

  renderAppBarActions = () => {
    const { dualLayoutModel } = this.state;

    const assignButtonCommsToggleRef = ref => (this.btnCommsToggle = ref);

    return (
      <Observer>
        {() => (
          <div>
            {dualLayoutModel.collapsed && (
              <IconButton
                key={'panelToggle'}
                ref={assignButtonCommsToggleRef}
                iconName="communication-panel"
                iconStyle="light"
                onClick={dualLayoutModel.toggleRightPanel}
              />
            )}
          </div>
        )}
      </Observer>
    );
  };

  render() {
    const { dualLayoutModel } = this.state;
    const { users, loggedInUser, post } = this.props;
    const { pastPostsCount } = post;
    const user = loggedInUser && users.get(loggedInUser.id);
    const tenantName = (loggedInUser || {}).tenantName;
    const { enableRingPhoneConfiguration } = (loggedInUser || {}).features || {};

    return (
      <div>
        <SendGridSandboxEnabledWidget />
        <AppBar isCommunicationManagement>
          <AppBarIconSection>
            <SideNavigationMenu users={users} loggedInUser={user} tenantName={tenantName} enableRingPhoneConfiguration={enableRingPhoneConfiguration} />
          </AppBarIconSection>
          <AppBarMainSection>
            <Title className={cf('title')}>{toTitleCase(t('COMMUNICATION_MANAGEMENT'))}</Title>
          </AppBarMainSection>
          <AppBarActions className={cf('appBarActions')}>{this.renderAppBarActions()}</AppBarActions>
        </AppBar>
        <P.PanelsContainer
          model={dualLayoutModel}
          onRightPanelClickOutside={this.checkIfClickOnTrigger}
          customBreakpoints={COMMUNICATION_MANAGEMENT_CUSTOM_BREAKPOINTS}>
          <P.LeftPanel>
            <LeftPanelContent handleOpenPostForm={this.handleOpenPostForm} isSmallLayout={dualLayoutModel.small} />
          </P.LeftPanel>
          <P.RightPanel className={cf({ sentPostList: !pastPostsCount })}>
            <PostList handleOpenPostForm={this.handleOpenPostForm} />
          </P.RightPanel>
        </P.PanelsContainer>

        <Observer>
          {() => <AnnouncementFormWrapper postId={this.postId} isOpen={this.createAnnouncementDlg.isOpen} close={() => this.createAnnouncementDlg.close()} />}
        </Observer>
        <Observer>{() => <AlertFormWrapper postId={this.postId} isOpen={this.createAlertDlg.isOpen} close={() => this.createAlertDlg.close()} />}</Observer>
      </div>
    );
  }
}
