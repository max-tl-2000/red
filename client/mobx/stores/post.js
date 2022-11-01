/*
 * Copyright (c) 2022 Reva Technology Inc., all rights reserved.
 * Unauthorized copying of this file, via any medium is strictly prohibited
 * Licensed under the Elastic License 2.0; you may not use this file except
 * in compliance with the Elastic License 2.0.
 */

import { observable, computed, action, ObservableMap } from 'mobx';
import { t } from 'i18next';
import { MobxRequest } from '../helpers/mobx-request';
import nullish from '../../../common/helpers/nullish';
import { createPostEditorModel } from '../../models/PostEditorModel';
import { toMoment } from '../../../common/helpers/moment-utils.ts';

export const PAGE_SIZE_PAST_POSTS_LIMIT = 20;

class Post {
  @observable
  draftPostsListMap;

  @observable
  pastPostsListMap;

  @observable
  pastPostsTotalCount;

  @observable
  matchingResidentCodes;

  @observable
  hasResidentCode;

  @observable
  totalResidentCodes;

  constructor(service) {
    this.postEditorModel = createPostEditorModel(service);
    this.postEditorModel.onFileUpload = (tracker, matchingResidentInfo) => {
      this.setMatchingResidentCodes(tracker, matchingResidentInfo);
    };
    this.draftPostsRq = new MobxRequest({
      call: service.getDraftPosts,
      onResponse: ({ response }) => this.combineResultsDraftPosts(response),
    });
    this.postByIdRq = new MobxRequest({
      call: service.getPostById,
      onResponse: ({ response }) => this.setPostInfo(response),
    });
    this.deletePostRq = new MobxRequest({ call: service.deletePost });
    this.retractPostRq = new MobxRequest({ call: service.retractPost });
    this.pastPostsRq = new MobxRequest({
      call: service.getPosts,
      onResponse: ({ response }) => this.combineResultsPastPosts(response),
    });
    this.pastPostsListMap = new ObservableMap();
    this.draftPostsListMap = new ObservableMap();
  }

  @action
  addPastPost(post) {
    if (!post) return;
    this.pastPostsListMap.set(post.id, post);
  }

  @action
  combineResultsPastPosts({ rows: posts, totalRows }) {
    posts.forEach(post => this.pastPostsListMap.set(post.id, post));
    this.pastPostsTotalCount = totalRows;
  }

  @action
  refreshSentPostList() {
    this.pastPostsListMap.clear();
    this.pastPostsTotalCount = 0;
    this.loadPastPosts({ includeMessageDetails: false });
  }

  @computed
  get currentPost() {
    return this.postByIdRq?.response;
  }

  @computed
  get pastPosts() {
    return this.pastPostsListMap.values().sort((a, b) => toMoment(b.sentAt) - toMoment(a.sentAt));
  }

  @computed
  get pastPostsCount() {
    return this.pastPostsHasNextPage ? this.pastPosts.length + 1 : this.pastPosts.length;
  }

  @computed
  get getResidentCodesStats() {
    return {
      matchingResidentCodes: this.matchingResidentCodes,
      totalResidentCodes: this.totalResidentCodes,
    };
  }

  @computed
  get pastPostsHasNextPage() {
    return !nullish(this.pastPostsTotalCount) ? this.pastPosts.length < this.pastPostsTotalCount : true;
  }

  @action
  loadPastPosts(params = {}) {
    this.pastPostsRq.execCall(params);
  }

  @action
  combineResultsDraftPosts(draftPosts) {
    draftPosts.forEach(post => this.draftPostsListMap.set(post.id, post));
  }

  @action
  removeDraftPostFromList(postId) {
    this.draftPostsListMap.delete(postId);
  }

  @action
  async deletePost(postId) {
    await this.deletePostRq.execCall({ postId });
    if (this.deletePostRq.success) {
      this.removeDraftPostFromList(postId);
    }
  }

  @action
  async retractPost(postId, retractedReason) {
    await this.retractPostRq.execCall({ postId, retractedReason });
  }

  @action
  clearCurrentPost() {
    this.postByIdRq.clearResponse();
    this.matchingResidentCodes = null;
    this.totalResidentCodes = null;
  }

  @action
  setPostInfo(post) {
    this.setMatchingResidentCodes(this.postEditorModel.uploadModel?.currentTracker, post.documentMetadata?.matchingResidentInfo || {});
  }

  @action
  async loadPostById(postId) {
    await this.postByIdRq.execCall({ postId });
  }

  @action
  deleteFileMetadataFromPost(postId) {
    if (!this.draftPostsListMap.get(postId)) return;

    const { documentMetadata, ...rest } = this.draftPostsListMap.get(postId);
    this.draftPostsListMap.set(postId, rest);
  }

  @action
  loadDraftPosts() {
    this.draftPostsRq.execCall();
  }

  @action
  addDraftPost(draftPost) {
    if (!draftPost) return;
    this.postEditorModel.setIsOperationInProgressAndStatus(false, true);
    this.draftPostsListMap.set(draftPost.id, draftPost);
  }

  @action
  addFileMetadataToPostDraft(postId, fileInfo) {
    this.draftPostsListMap.set(postId, { ...this.draftPostsListMap.get(postId), documentMetadata: fileInfo });
  }

  @computed
  get isLoadingDraftPosts() {
    return this.draftPostsRq.loading;
  }

  @computed
  get draftPosts() {
    return this.draftPostsListMap.values().sort((a, b) => toMoment(b.created_at) - toMoment(a.created_at));
  }

  @action
  setMatchingResidentCodes(tracker, { numberOfMatchingCodes, totalNumberOfCodes, hasResidentCode } = {}) {
    this.matchingResidentCodes = numberOfMatchingCodes;
    this.totalResidentCodes = totalNumberOfCodes;
    this.hasResidentCode = hasResidentCode;

    if (numberOfMatchingCodes === 0) {
      tracker?.setValidationError(t('NO_MATCH_FOR_POST_RECIPIENTS'));
    }
  }

  @action
  resetMatchingResidents = () => {
    this.matchingResidentCodes = null;
    this.totalResidentCodes = null;
    this.hasResidentCode = null;
  };
}

export const createPostStore = service => new Post(service);
