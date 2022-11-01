/*
 * Copyright (c) 2022 Reva Technology Inc., all rights reserved.
 * Unauthorized copying of this file, via any medium is strictly prohibited
 * Licensed under the Elastic License 2.0; you may not use this file except
 * in compliance with the Elastic License 2.0.
 */

import PropTypes from 'prop-types';
import React, { Component } from 'react';
import { connect } from 'react-redux';
import { t } from 'i18next';
import Dropzone from 'react-dropzone';
import generateId from 'helpers/generateId';
import { getEmailAttachmentValidations, validateAttachmentsSize } from 'helpers/emailAttachmentHelper';
import omit from 'lodash/omit';
import AttachmentsTooLargeDialog from 'custom-components/SendMail/AttachmentsTooLargeDialog';
import RecipientsDropdown from 'custom-components/RecipientsDropdown/RecipientsDropdown';
import { Typography, Button, MsgBox, FroalaEditor } from 'components';
import { createSelector } from 'reselect';
import uniq from 'lodash/uniq';
import { isPagePersonDetails } from 'helpers/leasing-navigator';
import { getOutProgramSelector } from 'redux/selectors/programSelectors';
import { isActiveLeaseParty as isActiveLeaseWfParty, getDaysToRouteToALPostMoveout } from 'redux/selectors/partySelectors';
import isEqual from 'lodash/isEqual';
import {
  getRecipientsForEmailDropDown,
  getEmailSignature,
  getCommunicationPlaceholderMessage,
  getCommEmailsToReply,
  removeMultipleReplyPrefixes,
} from '../../helpers/communications';
import { isEmailValidAndNotBlacklisted } from '../../helpers/contacts';
import { uploadState } from './EmailReplyUploadState';
import { client } from './EmailReplyRestClient';
import { MULTIFILE_UPLOADER_PATH } from '../../../common/document-constants';
import { FileEntry } from '../../components/MultiFileUploader/FileEntry';
import { FileQueueModel } from '../../components/MultiFileUploader/FileQueueModel';
import { FileQueue } from '../../components/MultiFileUploader/FileQueue';
import { DALTypes } from '../../../common/enums/DALTypes';
import { cf } from './EmailReply.scss';
import TemplateExpander from '../../custom-components/TemplateExpander/TemplateExpander';

const { SubHeader } = Typography;
const getBounceEmails = createSelector(
  (state, props) => props.communications,
  communications => {
    const bounceCriteria = ({ status }) => status === DALTypes.CommunicationStatus.BOUNCED;
    const isStatusBounced = comStatus => ((comStatus || {}).status || []).some(bounceCriteria);
    const bouncedEmailList = communications.reduce((acc, com) => {
      const commStatus = com.status;
      if (com.type === DALTypes.CommunicationMessageType.EMAIL && isStatusBounced(commStatus)) {
        acc.push(commStatus.status.filter(bounceCriteria));
      }
      return acc;
    }, []);

    return uniq(bouncedEmailList.map(e => e[0].address));
  },
);

@connect((state, props) => ({
  bouncedEmailList: getBounceEmails(state, props),
  outgoingProgram: getOutProgramSelector()(state, props),
  isActiveLeaseParty: isActiveLeaseWfParty(state, props),
  daysToRouteToALPostMoveout: getDaysToRouteToALPostMoveout(state, props),
}))
export default class EmailReply extends Component {
  static propTypes = {
    partyMembers: PropTypes.object,
    persons: PropTypes.object,
    replyToCommunication: PropTypes.object,
    sendMethod: PropTypes.func,
    scrollToBottom: PropTypes.func,
    currentUser: PropTypes.object,
    deleteAttachments: PropTypes.func,
    saveDraft: PropTypes.func,
    deleteDraft: PropTypes.func,
    draft: PropTypes.object,
    setBeforeClose: PropTypes.func,
    clearFlyoutDraft: PropTypes.func,
    propertyId: PropTypes.string,
    readOnly: PropTypes.bool,
    isActiveLeaseParty: PropTypes.bool,
    daysToRouteToALPostMoveout: PropTypes.number,
  };

  constructor(props) {
    super(props);
    const selectedRecipientEmails = getCommEmailsToReply(props.replyToCommunication, props.persons);
    const recipients = this.getRecipients(props);
    this.froalaEditor = null;

    const { draft } = props;
    const draftObject = draft || {};
    const draftFiles = (draftObject.data || {}).files;
    const completedFiles = (draftFiles || []).map(
      completedFile => new FileEntry({ file: { ...completedFile, clientId: completedFile.id, name: completedFile.originalName } }),
    );

    this.state = {
      extended: !!props.draft,
      selectedRecipientEmails,
      recipients,
      fileQueueModel: this.createFileQueueModel(completedFiles),
      isUploadInProgress: false,
      attachedFiles: draftFiles || [],
      isFileSizeDialogOpen: false,
      wasManuallyClosed: false,
    };

    if (props.userToken) {
      client.setExtraHeaders({
        Authorization: `Bearer ${props.userToken}`,
      });
    }

    window.addEventListener('beforeunload', this.handleFlyoutClosing);
  }

  getRecipients({ replyToCommunication, persons, partyMembers }) {
    if (!replyToCommunication) return [];
    const commPartyMember = replyToCommunication.parties[0]
      ? partyMembers.filter(pm => replyToCommunication.parties.includes(pm.partyId))
      : partyMembers.filter(pm => replyToCommunication.persons.includes(pm.personId));
    return getRecipientsForEmailDropDown(commPartyMember, persons);
  }

  componentWillReceiveProps(nextProps) {
    if (this.props.partyMembers !== nextProps.partyMembers) {
      const recipients = this.getRecipients(nextProps);
      this.setState({ recipients });
    }
  }

  componentDidMount() {
    const { setBeforeClose } = this.props;
    setBeforeClose && setBeforeClose(this.beforeClose);
  }

  componentWillUnmount() {
    this.handleFlyoutClosing();
    window.removeEventListener('beforeunload', this.handleFlyoutClosing);
  }

  beforeClose = (manuallyClosed, maximizeIfNecessary) => {
    const { message, recipients } = this.constructMessage();
    if (this.isDraftEmpty(message, recipients)) {
      this.setState(
        {
          wasManuallyClosed: manuallyClosed,
        },
        () => this.props.onClose(),
      );
      return;
    }
    maximizeIfNecessary();
    this.setState({
      wasManuallyClosed: manuallyClosed,
      discardChangesWarning: true,
    });
  };

  handleFlyoutClosing = () => {
    const { wasManuallyClosed, attachedFiles } = this.state;
    const draftId = this.props.draft && this.props.draft.id;

    if (wasManuallyClosed) {
      draftId && this.props.deleteDraft(draftId);
      attachedFiles.length && this.props.deleteAttachments(attachedFiles.map(file => file.id));
      return;
    }

    const { recipients, message, html } = this.constructMessage();

    const isDraftEmpty = this.isDraftEmpty(message);
    if (isDraftEmpty) {
      draftId && this.props.deleteDraft(draftId);
      return;
    }

    this.props.saveDraft({
      id: draftId || '',
      recipients,
      message: { ...message, files: this.state.attachedFiles, content: html },
      threadId: this.props.threadId,
      type: DALTypes.CommunicationMessageType.EMAIL,
      partyId: this.props.partyId,
      userId: this.props.currentUser.id,
    });
  };

  isDraftEmpty = (message, recipients) => {
    if (!message) return false;

    const noContent = !message.content;

    const { currentUser, assignedProperty, outgoingProgram } = this.props;
    const isDefaultContent =
      message.content.replace(/\n|\r/g, '').trim() === getEmailSignature(currentUser, assignedProperty, outgoingProgram).replace(/\n|\r/g, '').trim();
    const noAttachments = !this.state.attachedFiles.length;
    const defaultEmailList = getCommEmailsToReply(this.props.replyToCommunication, this.props.persons);
    const isDefaultRecipientList = isEqual(recipients?.contactInfos.sort(), defaultEmailList.sort());

    return (noContent || isDefaultContent) && noAttachments && isDefaultRecipientList;
  };

  onClickReplyHandler = () => {
    if (!isPagePersonDetails()) {
      this.setState({ extended: true });
      this.props.scrollToBottom();
    }
  };

  doSendMessage = () => {
    this.handleSendMessage();
    this.setState({ extended: false });
  };

  onClickDeleteHandler = () => {
    this.setState({ extended: false });
  };

  get signature() {
    return getEmailSignature(this.props.currentUser, this.props.assignedProperty, this.props.outgoingProgram);
  }

  getContent = () => (this.props.draft ? this.props.draft.data.content : this.signature);

  handleRecipientsChange = ids => this.setState({ selectedRecipientEmails: ids });

  setSubjectReply = (subject, currentUser) => {
    if (subject) return subject.toString().startsWith(`${t('REPLY_ACRONYM')}`) ? removeMultipleReplyPrefixes(subject) : `${t('REPLY_ACRONYM')} ${subject}`;
    return `${t('REPLY_FROM')} ${currentUser.fullName}`;
  };

  handleOnItemCancelUploadClick = fileEntry => {
    const { fileQueueModel, attachedFiles } = this.state || {};
    const { id, clientId, hasError } = fileEntry;
    const remainingAttachments = attachedFiles.filter(file => file.id !== id);
    if (!hasError) {
      fileQueueModel.client.abortUpload(clientId);
    }
    fileQueueModel.remove(clientId);
    this.setState({
      attachedFiles: remainingAttachments,
      isUploadInProgress: fileQueueModel.isDirty,
    });
  };

  handleOnItemDeleteClick = fileEntry => {
    const { fileQueueModel, attachedFiles } = this.state || {};
    const { id, clientId, hasError } = fileEntry;
    const remainingAttachments = attachedFiles.filter(file => file.id !== id);
    if (!hasError) {
      this.props.deleteAttachments([id]);
    }
    fileQueueModel.remove(clientId);

    this.setState({
      attachedFiles: remainingAttachments,
      isUploadInProgress: fileQueueModel.isDirty,
    });
  };

  constructMessage = () => {
    let { subject } = this.props.replyToCommunication.message;
    const { html = '', text = '' } = this?.froalaEditor?.getInnerValues() || {};
    subject = this.setSubjectReply(subject, this.props.currentUser);

    const { selectedRecipientEmails: contactInfos, attachedFiles } = this.state;
    const recipients = {
      contactInfos,
      freeFormAddresses: [],
    };

    const message = {
      subject,
      content: text,
      unread: false,
      files: attachedFiles.map(file => omit(file, ['size'])),
    };

    return { recipients, message, html };
  };

  handleSendMessage() {
    const { replyToCommunication } = this.props;
    const { recipients, message, html } = this.constructMessage();

    this.props.sendMethod(
      recipients,
      message,
      DALTypes.CommunicationMessageType.EMAIL,
      replyToCommunication.parties[0],
      replyToCommunication.messageId,
      null,
      null,
      null,
      html,
    );
    const draftId = this.props.draft && this.props.draft.id;
    draftId && this.props.deleteDraft(draftId);
    this.props.clearFlyoutDraft();

    this.setState({
      fileQueueModel: this.createFileQueueModel([]),
      isUploadInProgress: false,
      attachedFiles: [],
    });
  }

  handleAttachmentClick = () => this.dropzone.open();

  handleDrop = files => {
    const { fileQueueModel } = this.state || {};

    if (!validateAttachmentsSize(this.state.attachedFiles, fileQueueModel.pendingUploads || [], files)) {
      this.setState({
        isFileSizeDialogOpen: true,
      });
      return;
    }

    files.forEach(file => {
      file.clientId = generateId(this);
      fileQueueModel.add(file);
    });

    this.setState({
      isUploadInProgress: true,
    });

    fileQueueModel.upload(uploadResponse => {
      this.state.attachedFiles.push(uploadResponse);
      this.setState({
        isUploadInProgress: fileQueueModel.isDirty,
      });
    });
  };

  createFileQueueModel(files) {
    return new FileQueueModel({
      uploadState,
      validations: getEmailAttachmentValidations(),
      files,
      keepUploadedFiles: true,
      apiClient: client,
      uploadPath: MULTIFILE_UPLOADER_PATH,
      serverErrorMessages: {
        size: t('LIMIT_FILE_SIZE', { fileSize: this.props.fileSize }),
        generic: t('SERVER_ERROR'),
      },
    });
  }

  shouldSendBeDisabled = () => {
    const { bouncedEmailList } = this.props;
    const { recipients, selectedRecipientEmails, isUploadInProgress } = this.state;

    if (!selectedRecipientEmails || !selectedRecipientEmails.length || isUploadInProgress) {
      return true;
    }

    // FIXME: bounced list is there but not in the SendEmailComponent... This code is so different when it should be the same CPM-8429
    const emailList = recipients.reduce(
      (allEmails, recipient) =>
        allEmails.concat(
          recipient.items.reduce((acc, item) => {
            // The selected items don't reflect the smaller list in the case one of the contacts in the previous email in thread loses the email in the person detail
            // It looks the opposite of the sendEmailComponent... However the recipients list is updated and loses the contact that no longer has an email. So
            // ignoring when it becomes undefined and returns true
            if (!item.disabled && selectedRecipientEmails.includes(item.id)) {
              acc.push(item.value);
            }
            return acc;
          }, []),
        ),
      [],
    );

    const valid = emailList.length && emailList.every(email => !bouncedEmailList.includes(email) && isEmailValidAndNotBlacklisted(email));
    return !valid;
  };

  renderFooter = () => (
    <div className={cf('bottomSection')}>
      <div className={cf('dropzone')}>
        <Dropzone ref={item => (this.dropzone = item)} onDrop={this.handleDrop} />
      </div>
      <div className={cf('fileQueue')}>
        <FileQueue queue={this.state.fileQueueModel} onDeleteItem={this.handleOnItemDeleteClick} onCancelUpload={this.handleOnItemCancelUploadClick} />
        <AttachmentsTooLargeDialog open={this.state.isFileSizeDialogOpen} onCloseRequest={() => this.setState({ isFileSizeDialogOpen: false })} />
      </div>
    </div>
  );

  render() {
    const { propertyId, partyId, readOnly, templateArgs, isActiveLeaseParty, daysToRouteToALPostMoveout } = this.props;

    const emailPlaceholderMessage = getCommunicationPlaceholderMessage({
      areCommsDisabled: readOnly,
      isActiveLeaseParty,
      isEmail: true,
      daysToRouteToALPostMoveout,
    });

    return (
      <TemplateExpander
        propertyId={propertyId}
        partyId={partyId}
        context="email"
        signature={this.signature}
        data={{ templateArgs }}
        getEditorInstance={this.state.extended && (() => this.froalaEditor?.getEditor())}>
        {({ renderProcessingStatus, renderErrorSection }) => (
          <div>
            {renderErrorSection()}
            <div className={cf('reply', { readOnly })}>
              {!this.state.extended && (
                <div className={cf('collapseContent')} onClick={this.onClickReplyHandler}>
                  <SubHeader disabled>{emailPlaceholderMessage}</SubHeader>
                </div>
              )}
              {this.state.extended && (
                <div className={cf('replyContent')} ref={c => (this.replyElement = c)}>
                  <div className={cf('header')}>
                    <RecipientsDropdown
                      recipients={this.state.recipients}
                      selectedRecipients={this.state.selectedRecipientEmails}
                      onChange={this.handleRecipientsChange}
                      showListOnFocus
                    />
                  </div>
                  <div className={cf('messageBox')}>
                    {renderProcessingStatus()}
                    <FroalaEditor
                      content={this.getContent()}
                      ref={editor => (this.froalaEditor = editor)}
                      sendMessage={this.doSendMessage}
                      sendMessageButton={() => (
                        <Button onClick={this.doSendMessage} disabled={this.shouldSendBeDisabled()}>
                          {t('SEND')}
                        </Button>
                      )}
                      handleAttachmentClick={this.handleAttachmentClick}
                      footer={this.renderFooter}
                      config={{ height: 'auto' }}
                      scrollToBottom={this.props.scrollToBottom}
                    />
                  </div>
                </div>
              )}
              <MsgBox
                open={this.state.discardChangesWarning}
                onCloseRequest={() => this.setState({ discardChangesWarning: false })}
                onOKClick={this.props.onClose}
                lblOK={t('DISCARD_CHANGES')}
                lblCancel={t('KEEP_EDITING')}
                title={t('DISCARD_MESSAGE_DRAFT')}
              />
            </div>
          </div>
        )}
      </TemplateExpander>
    );
  }
}
