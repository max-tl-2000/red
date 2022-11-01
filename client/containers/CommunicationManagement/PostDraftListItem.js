/*
 * Copyright (c) 2022 Reva Technology Inc., all rights reserved.
 * Unauthorized copying of this file, via any medium is strictly prohibited
 * Licensed under the Elastic License 2.0; you may not use this file except
 * in compliance with the Elastic License 2.0.
 */

import PropTypes from 'prop-types';
import React, { Component } from 'react';
import { t } from 'i18next';
import { inject, Observer } from 'mobx-react';
import { RedTable, IconButton, MsgBox, Typography } from 'components';
import { MessageAlert, MessageBullhorn, Delete } from '../../red-icons/index';
import { cf } from './PostCard.scss';
import { DALTypes } from '../../../common/enums/DALTypes';
import ellipsis from '../../../common/helpers/ellipsis';
import DialogModel from '../PartyPageUnified/DialogModel';

const { Text } = Typography;

const { Row, Cell } = RedTable;
const MAX_POST_TITLE_LENGTH_TO_SHOW = 26;

@inject('post')
export default class PostDraftListItem extends Component {
  static propTypes = {
    onCreateAnnouncementClick: PropTypes.func,
    onCreateAlertClick: PropTypes.func,
  };

  constructor(props) {
    super(props);
    this.deleteDraftMsgBox = new DialogModel();
  }

  getIconComponent() {
    const { postCategory } = this.props;
    if (postCategory === DALTypes.PostCategory.EMERGENCY) return <MessageAlert className={cf('icon alert')} />;
    return <MessageBullhorn className={cf('icon announcement')} />;
  }

  get documentOriginalName() {
    const { documentMetadata } = this.props;
    return documentMetadata?.name || '';
  }

  handleRowClick = () => {
    const { postCategory, handleOpenPostForm, postId } = this.props;

    handleOpenPostForm(postCategory, postId);
  };

  handleDeleteDraft = async () => {
    const { postId, post } = this.props;
    await post.deletePost(postId);
  };

  render() {
    const { postTitle, postCreatedBy } = this.props;

    return (
      <div>
        <Row onClick={this.handleRowClick} clickable fullWidthDivider>
          <Cell width={40} noPaddingLeft>
            <div className={cf('icon-wrapper')}>{this.getIconComponent()}</div>
          </Cell>
          <Cell width={'40%'}>{ellipsis(postTitle, MAX_POST_TITLE_LENGTH_TO_SHOW)}</Cell>
          <Cell>{this.documentOriginalName}</Cell>
          <Cell>{postCreatedBy}</Cell>
          <Cell textAlign="right" width={60} onClick={event => event.stopPropagation()}>
            <IconButton onClick={() => this.deleteDraftMsgBox.open()} iconName={() => <Delete className={cf('icon delete')} />} />
          </Cell>
        </Row>

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
      </div>
    );
  }
}
