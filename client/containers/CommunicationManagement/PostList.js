/*
 * Copyright (c) 2022 Reva Technology Inc., all rights reserved.
 * Unauthorized copying of this file, via any medium is strictly prohibited
 * Licensed under the Elastic License 2.0; you may not use this file except
 * in compliance with the Elastic License 2.0.
 */

import React, { Component } from 'react';
import { inject, observer } from 'mobx-react';
import { t } from 'i18next';
import { Typography } from 'components';
import InfiniteScroll from 'react-infinite-scroller';
import PostCard from './PostCard';
import { cf } from './PostList.scss';
import PreloaderBlock from '../../components/PreloaderBlock/PreloaderBlock';
import { NoPostedMessages } from '../../red-icons/index';
import { PAGE_SIZE_PAST_POSTS_LIMIT } from '../../mobx/stores/post';

const { SubHeader, Caption } = Typography;

@inject('post')
@observer
export default class PostList extends Component {
  loadMoreItems = pageNumber => this.props.post.loadPastPosts({ pageNumber, pageSize: PAGE_SIZE_PAST_POSTS_LIMIT, includeMessageDetails: false });

  render() {
    const {
      post: { pastPosts, pastPostsCount, pastPostsHasNextPage },
    } = this.props;
    if (!pastPostsCount) {
      return (
        <div className={cf('no-post-message')}>
          <NoPostedMessages style={{ marginBottom: '2rem' }} />
          <Caption>{t('NO_POSTED_MESSAGE_TXT')}</Caption>
        </div>
      );
    }
    return (
      <div className={cf('itemsList')}>
        <InfiniteScroll pageStart={0} loadMore={this.loadMoreItems} hasMore={pastPostsHasNextPage} loader={<PreloaderBlock size="small" />} useWindow={false}>
          <SubHeader secondary bold className={cf('subtitle')}>
            {t('SENT_POSTS')}
          </SubHeader>
          {pastPosts.map(post => (
            <PostCard key={`postCard-${post.id}`} postInfo={post} handleOpenPostForm={this.props.handleOpenPostForm} />
          ))}
        </InfiniteScroll>
      </div>
    );
  }
}
