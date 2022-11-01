/*
 * Copyright (c) 2022 Reva Technology Inc., all rights reserved.
 * Unauthorized copying of this file, via any medium is strictly prohibited
 * Licensed under the Elastic License 2.0; you may not use this file except
 * in compliance with the Elastic License 2.0.
 */

import PropTypes from 'prop-types';
import React, { Component } from 'react';
import { t } from 'i18next';
import { getRecipientsForEmailDropDown } from 'helpers/communications';
import Dropzone from 'react-dropzone';
import generateId from 'helpers/generateId';
import { getEmailAttachmentValidations, validateAttachmentsSize } from 'helpers/emailAttachmentHelper';
import omit from 'lodash/omit';
import RecipientsDropdown from 'custom-components/RecipientsDropdown/RecipientsDropdown';
import { Button, TextBox, Typography as T, Field, MsgBox, FroalaEditor } from 'components';
import isEqual from 'lodash/isEqual';
import { cf } from './SendEmailComponent.scss';
import { DALTypes } from '../../../common/enums/DALTypes';
import { FileQueue } from '../../components/MultiFileUploader/FileQueue';
import { FileQueueModel } from '../../components/MultiFileUploader/FileQueueModel';
import { FileEntry } from '../../components/MultiFileUploader/FileEntry';
import { MULTIFILE_UPLOADER_PATH } from '../../../common/document-constants';
import { client } from './SendEmailComponentRestClient';
import { uploadState } from './sendEmailUploadState'; // TODO: check why this is duplicated
import AttachmentsTooLargeDialog from './AttachmentsTooLargeDialog';
import { arePersonsContactInfoValid } from '../../helpers/contacts';
import TemplateExpander from '../TemplateExpander/TemplateExpander';
import { window } from '../../../common/helpers/globals';

export default class SendEmailComponent extends Component {
  static propTypes = {
    onClose: PropTypes.func,
    onSubjectChange: PropTypes.func,
    subject: PropTypes.string,
    templateSubject: PropTypes.string,
    onContentChange: PropTypes.func,
    content: PropTypes.string,
    emailType: PropTypes.string,
    sendMethod: PropTypes.func,
    saveDraft: PropTypes.func,
    deleteDraft: PropTypes.func,
    setBeforeClose: PropTypes.func,
    draft: PropTypes.object,
    draftRecipients: PropTypes.object,
    draftFiles: PropTypes.array,
    prospectId: PropTypes.string,
    partyMembers: PropTypes.array,
    persons: PropTypes.array,
    templateDataId: PropTypes.string,
    currentUser: PropTypes.object,
    deleteAttachments: PropTypes.func,
    showListOnFocus: PropTypes.bool,
    propertyId: PropTypes.string,
  };

  constructor(props) {
    super(props);
    const { emailType, emailTo, partyMembers, draftFiles } = props;
    this.emailType = emailType || t('SEND');
    this.froalaEditor = null;

    const emailToArray = Array.isArray(emailTo) ? emailTo : emailTo.toArray();

    const draftRecipients = props.draftRecipients ? props.draftRecipients.contactInfos : null;
    const selectedRecipientEmails = emailToArray
      .filter(p => partyMembers.find(pm => pm.personId === p.id))
      .map(p => p.contactInfo.defaultEmailId)
      .filter(email => email);

    const defaultElements = [DALTypes.VisibleElements.BOLD, DALTypes.VisibleElements.ATTACHMENT, DALTypes.VisibleElements.SUBJECT];

    const completedFiles = (draftFiles || []).map(
      completedFile => new FileEntry({ file: { ...completedFile, clientId: completedFile.id, name: completedFile.originalName } }),
    );

    this.state = {
      selectedRecipientEmails: draftRecipients || selectedRecipientEmails,
      defaultElements,
      fileQueueModel: this.createFileQueueModel(completedFiles),
      isUploadInProgress: false,
      attachedFiles: props.draftFiles || [],
      wasEmailSent: false,
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

  componentWillUnmount() {
    this.handleFlyoutClosing();
    window.removeEventListener('beforeunload', this.handleFlyoutClosing);
  }

  createDefaultEmailList = personList => personList.map(p => p?.contactInfo.defaultEmailId);

  handleFlyoutClosing = () => {
    const { wasManuallyClosed, wasEmailSent, attachedFiles } = this.state;

    if (wasEmailSent) {
      this.props.draftId && this.props.deleteDraft(this.props.draftId);
      return;
    }

    if (wasManuallyClosed) {
      this.props.draftId && this.props.deleteDraft(this.props.draftId);
      attachedFiles.length && this.props.deleteAttachments(attachedFiles.map(file => file.id));
      return;
    }

    const { recipients, message, type, partyId, html } = this.constructMessage();

    const isDraftEmpty = this.isDraftEmpty(message);
    if (isDraftEmpty) {
      this.props.draftId && this.props.deleteDraft(this.props.draftId);
      return;
    }

    this.props.saveDraft({
      id: this.props.draftId || '',
      recipients,
      message: { ...message, files: this.state.attachedFiles, content: html || message.content },
      type,
      partyId,
      userId: this.props.currentUser.id,
      threadId: null,
    });
  };

  isDraftEmpty = (message, recipients) => {
    const { persons } = this.props;
    if (!message) return false;

    const noSubject = !message.subject;
    const noContent = !message.content;
    const noAttachments = !this.state.attachedFiles.length;
    const isDefaultContent = message.content.replace(/\n|\r/g, '').trim() === this.props.defaultContent.replace(/\n|\r/g, '').trim();
    const defaultEmailList = this.createDefaultEmailList(persons);
    const isDefaultRecipientList = isEqual(recipients?.contactInfos.sort(), defaultEmailList.sort());
    return noSubject && (noContent || isDefaultContent) && noAttachments && isDefaultRecipientList;
  };

  handleRecipientsChange = ids => {
    this.setState({
      selectedRecipientEmails: ids,
    });
  };

  constructMessage = () => {
    const { templateSubject, content, templateDataId } = this.props;
    const { selectedRecipientEmails: contactInfos, attachedFiles } = this.state;
    const subject = templateSubject || this.subjectTextBox.value;
    const { html = '', text = '' } = this?.froalaEditor?.getInnerValues() || {};
    const emailContent = templateDataId ? content : text;

    const recipients = {
      contactInfos,
      freeFormAddresses: [],
    };

    const message = {
      subject,
      content: emailContent,
      unread: false,
      files: attachedFiles.map(file => omit(file, ['size'])),
    };

    return { recipients, message, type: DALTypes.CommunicationMessageType.EMAIL, partyId: this.props.prospectId, html };
  };

  getRecipientPersons = (persons, selectedRecipientEmails = []) =>
    selectedRecipientEmails.reduce((acc, email) => {
      const pers = persons.find(p => p.contactInfo?.emails.some(e => e.id === email));
      if (pers && !acc.includes(pers)) {
        acc.push(pers);
      }
      return acc;
    }, []);

  handleSendMessage = () => {
    const { recipients, message, type, partyId, html = false } = this.constructMessage();

    const { persons } = this.props;
    const { selectedRecipientEmails } = this.state;
    const recipientPersons = this.getRecipientPersons(persons, selectedRecipientEmails);

    this.props.sendMethod(recipients, message, type, partyId, recipientPersons, html);

    this.setState(
      {
        wasEmailSent: true,
      },
      () => this.props.onClose(),
    );
  };

  handleAttachmentClick = () => this.dropzone.open();

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

  handleDrop = files => {
    const { fileQueueModel } = this.state || {};

    if (!validateAttachmentsSize(fileQueueModel.completedUploads || [], fileQueueModel.pendingUploads || [], files)) {
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

  renderEmailQuoteContent = () => {
    const { location } = window;
    const origin = location.origin || `${location.protocol}//${location.host}`;
    const urlPublishedQuote = `${origin}/publishedQuote/${this.props.templateDataId}`;
    return (
      <div className={cf('backgroundEmailQuote')}>
        <T.Text inline>
          <T.Link href={urlPublishedQuote} rel="noreferrer noopener" target="_blank">
            {t('VIEW_QUOTE_IN_BROWSER')}
          </T.Link>
        </T.Text>
        <img src="/images/flyout-quote-placeholder.png" alt="quote placeholder" />
      </div>
    );
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

  shouldSendBeDisabled() {
    const { persons } = this.props;
    const { selectedRecipientEmails, isUploadInProgress } = this.state;
    if (!selectedRecipientEmails || !selectedRecipientEmails.length || isUploadInProgress) {
      return true;
    }
    const recipientPersons = this.getRecipientPersons(persons, selectedRecipientEmails);

    return !recipientPersons.length || !arePersonsContactInfoValid(recipientPersons);
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

  componentDidMount() {
    const { setBeforeClose } = this.props;
    setBeforeClose && setBeforeClose(this.beforeClose);
  }

  setSubject = subject => {
    const { subjectTextBox } = this;
    subjectTextBox.value = subject;
    subjectTextBox.blur();
  };

  getSubject = () => {
    const { subjectTextBox } = this;
    return subjectTextBox.value;
  };

  renderFooter = () => {
    const { templateDataId } = this.props;
    return (
      <div className={cf('footer')}>
        {!templateDataId && (
          <div>
            <div className={cf('dropzone')}>
              <Dropzone ref={item => (this.dropzone = item)} onDrop={this.handleDrop} />
            </div>
            <div className={cf('fileQueue')}>
              <FileQueue queue={this.state.fileQueueModel} onDeleteItem={this.handleOnItemDeleteClick} onCancelUpload={this.handleOnItemCancelUploadClick} />
              <AttachmentsTooLargeDialog open={this.state.isFileSizeDialogOpen} onCloseRequest={() => this.setState({ isFileSizeDialogOpen: false })} />
            </div>
          </div>
        )}
      </div>
    );
  };

  render = () => {
    const {
      partyMembers,
      persons,
      subject,
      onSubjectChange,
      content,
      onContentChange,
      templateDataId,
      propertyId,
      prospectId,
      visibleElements = this.state.defaultElements,
      showListOnFocus,
      signature,
      templateArgs,
    } = this.props;

    const recipients = getRecipientsForEmailDropDown(partyMembers, persons);

    return (
      <TemplateExpander
        propertyId={propertyId}
        partyId={prospectId}
        data={{ templateArgs }}
        context="email"
        setSubject={this.setSubject}
        getSubject={this.getSubject}
        getEditorInstance={this.froalaEditor?.getEditor}
        signature={signature}>
        {({ renderProcessingStatus, renderErrorSection }) => (
          <div className={cf('main')}>
            {renderErrorSection()}
            <Field className={cf('field to')}>
              <RecipientsDropdown
                recipients={recipients}
                selectedRecipients={this.state.selectedRecipientEmails}
                onChange={this.handleRecipientsChange}
                showListOnFocus={showListOnFocus}
              />
            </Field>
            {visibleElements.includes(DALTypes.VisibleElements.SUBJECT) && (
              <Field className={cf('field')}>
                <TextBox
                  id="emailSubject"
                  wide
                  boldText
                  textRoleSecondary
                  underlineOnEditOnly
                  placeholder={t('EMAIL_DIALOG_SUBJECT')}
                  value={subject}
                  multiline={false}
                  autoResize={false}
                  onBlur={(e, { value }) => onSubjectChange && onSubjectChange(value)}
                  ref={item => (this.subjectTextBox = item)}
                />
              </Field>
            )}
            {templateDataId ? (
              <div>
                {this.renderEmailQuoteContent()}
                <div className={cf('footer')}>
                  <Button
                    id="sendEmail"
                    type="raised"
                    btnRole="primary"
                    label={this.emailType}
                    disabled={this.shouldSendBeDisabled()}
                    onClick={this.handleSendMessage}
                  />
                </div>
              </div>
            ) : (
              <Field className={cf('field textarea')}>
                {renderProcessingStatus()}
                <div id="emailBody">
                  <FroalaEditor
                    content={content}
                    onContentChange={onContentChange}
                    ref={editor => (this.froalaEditor = editor)}
                    sendMessage={() => this.handleSendMessage()}
                    sendMessageButton={() => (
                      <Button
                        id="sendEmail"
                        type="raised"
                        btnRole="primary"
                        label={this.emailType}
                        disabled={this.shouldSendBeDisabled()}
                        onClick={this.handleSendMessage}
                      />
                    )}
                    handleAttachmentClick={this.handleAttachmentClick}
                    footer={this.renderFooter}
                  />
                </div>
              </Field>
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
        )}
      </TemplateExpander>
    );
  };
}
