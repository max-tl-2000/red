/*
 * Copyright (c) 2022 Reva Technology Inc., all rights reserved.
 * Unauthorized copying of this file, via any medium is strictly prohibited
 * Licensed under the Elastic License 2.0; you may not use this file except
 * in compliance with the Elastic License 2.0.
 */

import { PropTypes } from 'prop-types';
import React, { Component } from 'react';

import { t } from 'i18next';
import { Typography } from 'components';
import { EditorState, ContentState, convertFromHTML, convertToRaw, convertFromRaw } from 'draft-js';
import Editor, { composeDecorators } from 'draft-js-plugins-editor';

import createInlineToolbarPlugin, { Separator } from 'draft-js-inline-toolbar-plugin';
import createToolbarPlugin from 'draft-js-static-toolbar-plugin';

import createLinkPlugin from 'draft-js-anchor-plugin';
import createEmojiPlugin from 'draft-js-emoji-plugin';
import createSideToolbarPlugin from 'draft-js-side-toolbar-plugin';

import createImagePlugin from 'draft-js-image-plugin';
import createAlignmentPlugin from 'draft-js-alignment-plugin';
import createFocusPlugin from 'draft-js-focus-plugin';
import createResizeablePlugin from 'draft-js-resizeable-plugin';
import createBlockDndPlugin from 'draft-js-drag-n-drop-plugin';
import createDividerPlugin from 'draft-js-divider-plugin';

import {
  ItalicButton,
  BoldButton,
  UnderlineButton,
  CodeButton,
  HeadlineOneButton,
  HeadlineTwoButton,
  UnorderedListButton,
  OrderedListButton,
  BlockquoteButton,
  CodeBlockButton,
} from 'draft-js-buttons';

import 'draft-js/dist/Draft.css';
import 'draft-js-inline-toolbar-plugin/lib/plugin.css';
import 'draft-js-static-toolbar-plugin/lib/plugin.css';
import 'draft-js-side-toolbar-plugin/lib/plugin.css';
import 'draft-js-anchor-plugin/lib/plugin.css';
import 'draft-js-emoji-plugin/lib/plugin.css';
import 'draft-js-focus-plugin/lib/plugin.css';
import 'draft-js-alignment-plugin/lib/plugin.css';
import 'draft-js-divider-plugin/lib/plugin.css';

import { observer, Observer } from 'mobx-react';
import { observable, action, runInAction } from 'mobx';
import debounce from 'lodash/debounce';

import createLinkifyPlugin from './linkify-plugin/createLinkifyPlugin';
import { removeExtraNewLineBlocks } from '../../helpers/richTextHelpers';
import { cf } from './RichEditor.scss';

import HeadlinesButton from './HeadlinesButton';
import EmojiButtonWrapper from './EmojiButtonWrapper';
import { createDndFileUploadPlugin } from './dragndrop-plugin/dragndrop-plugin';
import { createPasteFileUploadPlugin } from './pasteFile-plugin/pasteFile-plugin';
import UploadImageButton from './UploadImageButton';
import tryParse from '../../../common/helpers/try-parse';
import { createVideoPlugin } from './video-plugin';
import { showMsgBox } from '../MsgBox/showMsgBox';
import { AddVideoPrompt } from './AddVideoPrompt';
import Icon from '../Icon/Icon';

const { Caption, Text } = Typography;

import FlyOut from '../FlyOut/FlyOut';
import FlyOutOverlay from '../FlyOut/FlyOutOverlay';

class InlineToolbarFlyOut extends Component {
  // this hack is needed because the Reva FlyOut was not designed to re-render the content inside the flyout
  // in a way that will change the dimensions of the flyout. The use case on the RichEditor toolbar requires
  // the container to be re-created, so in this case we need to remove the originally calculated width from the
  // overlay and force it to be relocated to the correct position
  componentWillReceiveProps(nextProps) {
    const contentIsBeingOverridenAndFlyOutIsVisible = this.props.overridingContent !== nextProps.overridingContent && nextProps.isVisible;
    if (contentIsBeingOverridenAndFlyOutIsVisible) {
      // we remove the overlay width so the new content will
      // set the width of the overlay
      this.ref?.removeOverlayWidth();

      // with the new overlay width we relocate the overlay to a proper position
      setTimeout(() => {
        this.ref?.locateFlyOutOverlay();
      }, 0);
    }
  }

  componentDidUpdate(prevProps) {
    const { isVisible, position } = this.props;
    // if the position of the selection changes
    // while the overlay is opened
    if (prevProps.position !== position && isVisible) {
      setTimeout(() => {
        // relocate the overlay
        this.ref?.locateFlyOutOverlay();
      }, 0);
    }
  }

  setRef = ref => {
    this.ref = ref;
  };

  render() {
    const { children, isVisible, position, overlayContainer } = this.props;

    return (
      <FlyOut overlayContainer={overlayContainer} ref={this.setRef} expandTo="top" open={isVisible} closeOnTapAway={false}>
        <div style={{ left: position?.left, top: position?.top, position: 'absolute', width: 1, height: 1, pointerEvents: 'none' }} />
        <FlyOutOverlay contentClassName={cf('toolbar')} container={false}>
          {children}
        </FlyOutOverlay>
      </FlyOut>
    );
  }
}

@observer
export default class RichEditor extends Component {
  static propTypes = {
    readOnly: PropTypes.bool,
    placeholder: PropTypes.string,
    sideToolbarFeatures: PropTypes.array,
    inlineToolbarFeatures: PropTypes.array,
    characterLimit: PropTypes.number,
    minCharactersRemainingWarning: PropTypes.number,
    txtLoadingImages: PropTypes.string,
  };

  static defaultProps = {
    readOnly: false,
    txtLoadingImages: 'Loading...',
  };

  @observable
  areFilesUploading = false;

  @action
  handleFilesEvent = async (editorAPI, files) => {
    if (!this.props.onImagesUploadRequest || !files || files.length === 0) return;
    try {
      this.areFilesUploading = true;

      const urls = await this.props.onImagesUploadRequest(files);

      runInAction(() => {
        this.areFilesUploading = false;
        let editorState = editorAPI.getEditorState();

        urls.forEach(url => {
          editorState = this.imagePlugin.addImage(editorState, url);
        });

        editorAPI.setEditorState(editorState);
      });
    } catch (err) {
      console.error('>>> err', err);

      runInAction(() => {
        this.areFilesUploading = false;
      });
    }
  };

  constructor(props) {
    super(props);
    if (props?.rawField?.value) {
      const DBEditorState = tryParse(props?.rawField?.value);
      this.state = {
        editorState: EditorState.createWithContent(convertFromRaw(DBEditorState)),
      };
    } else if (props?.htmlField?.value) {
      const blocksFromHTMLStoredInDB = convertFromHTML(props.field.value);
      const DBEditorState = ContentState.createFromBlockArray(blocksFromHTMLStoredInDB.contentBlocks, blocksFromHTMLStoredInDB.entityMap);
      this.state = {
        editorState: EditorState.createWithContent(DBEditorState),
      };
    } else {
      this.state = {
        editorState: EditorState.createEmpty(),
        remainingCharacters: props.characterLimit,
      };
    }

    const sideToolbarPlugin = createSideToolbarPlugin();
    const { SideToolbar } = sideToolbarPlugin;

    const inlineToolbarPlugin = createInlineToolbarPlugin();
    const { InlineToolbar } = inlineToolbarPlugin;

    const staticToolbarPlugin = createToolbarPlugin();
    const { Toolbar: StaticToolbar } = staticToolbarPlugin;

    const linkPlugin = createLinkPlugin({ linkTarget: '_blank', theme: { input: cf('txt-add-link') } });
    const { LinkButton } = linkPlugin;

    const linkifyPlugin = createLinkifyPlugin({
      target: '_blank',
    });

    const emojiPlugin = createEmojiPlugin();
    const { EmojiSuggestions, EmojiSelect } = emojiPlugin;

    const focusPlugin = createFocusPlugin();
    const resizeablePlugin = createResizeablePlugin();
    const blockDndPlugin = createBlockDndPlugin();
    const alignmentPlugin = createAlignmentPlugin();
    const { AlignmentTool } = alignmentPlugin;

    const decorator = composeDecorators(resizeablePlugin.decorator, alignmentPlugin.decorator, focusPlugin.decorator, blockDndPlugin.decorator);

    this.imagePlugin = createImagePlugin({ decorator });

    this.videoPlugin = createVideoPlugin({ decorator });

    const dragNDropFileUploadPlugin = createDndFileUploadPlugin({
      onFilesDropped: this.handleFilesEvent,
    });

    const pasteFileUploadPlugin = createPasteFileUploadPlugin({
      onFilesPasted: this.handleFilesEvent,
    });

    const dividerDecorator = composeDecorators(focusPlugin.decorator);
    const dividerPlugin = createDividerPlugin({ decorator: dividerDecorator });
    const { DividerButton } = dividerPlugin;

    this.pluginComponents = { SideToolbar, InlineToolbar, EmojiSuggestions, EmojiSelect, AlignmentTool, StaticToolbar };
    this.plugins = [
      sideToolbarPlugin,
      inlineToolbarPlugin,
      linkPlugin,
      linkifyPlugin,
      emojiPlugin,
      dragNDropFileUploadPlugin,
      blockDndPlugin,
      focusPlugin,
      alignmentPlugin,
      resizeablePlugin,
      this.imagePlugin,
      dividerPlugin,
      pasteFileUploadPlugin,
      this.videoPlugin,
      staticToolbarPlugin,
    ];

    this.featureMap = new Map([
      ['h1', HeadlineOneButton],
      ['h2', HeadlineTwoButton],
      ['code', CodeButton],
      ['unorderedList', UnorderedListButton],
      ['orderedList', OrderedListButton],
      ['blockQuote', BlockquoteButton],
      ['codeBlock', CodeBlockButton],
      ['bold', BoldButton],
      ['italic', ItalicButton],
      ['underline', UnderlineButton],
      ['headlines', HeadlinesButton],
      ['link', LinkButton],
      ['separator', Separator],
      ['emoji', EmojiSelect],
      ['divider', DividerButton],
    ]);

    this.customStyleMap = {
      UNDERLINE: {
        textDecorationLine: 'underline',
      },
    };
  }

  INITIAL_VALUE;

  shouldBeDirty = editorContent => editorContent !== this.INITIAL_VALUE;

  componentWillUnmount = () => {
    this.INITIAL_VALUE = undefined;
  };

  updateFieldValue = () => {
    const { field, rawField, rawEditorContent, characterLimit } = this.props;
    const { editorState } = this.state;
    const innerText = this?.editorDraftComponent?.editor?.editor?.textContent;
    field.text = innerText;
    const currentEditorContent = editorState.getCurrentContent();

    const isEmpty = !(currentEditorContent?.hasText() && currentEditorContent?.getPlainText()?.length);

    if (this.INITIAL_VALUE === undefined) this.INITIAL_VALUE = innerText;

    // TODO: we should use convertToRaw only right before of send post data
    if (!isEmpty) {
      field.setValue(this?.editorDraftComponent?.editor?.editor?.innerHTML);
      rawField.setValue(JSON.stringify(convertToRaw(currentEditorContent)));
      rawEditorContent.setValue(editorState);
    }
    if (isEmpty) {
      field.setValue('');
      rawField.setValue('');
    }

    // TODO: we should not validate only the text, if we change only the styles or add images the text does not change
    // and the post will be not saved with the changes
    if (!this.shouldBeDirty(innerText)) {
      field.resetInteractedFlag();
      rawField.resetInteractedFlag();
    }

    this.setState({
      remainingCharacters: characterLimit - field.text.length,
    });
  };

  // TODO: we need to revisit this. There should be no need to put this into the state and the later to update the form field
  // updating the form field directly should be enough
  onChange = editorState => {
    const { readOnly } = this.props;
    !readOnly &&
      this.setState(
        {
          editorState,
        },
        this.updateFieldValue,
      );
  };

  applyEnhancements = debounce(() => {
    const editorWithoutExtraNewLines = removeExtraNewLineBlocks(this.state.editorState, false, false);
    this.onChange(editorWithoutExtraNewLines);
  }, 100);

  focus = () => {
    this?.editorDraftComponent.focus();
  };

  renderMenuComponent = ({ feature, keyPattern, externalProps }) => {
    const { EmojiSelect } = this.pluginComponents;
    const key = `${keyPattern}-${feature}`;

    switch (feature) {
      case 'emoji': {
        return (
          <EmojiButtonWrapper key={key}>
            <EmojiSelect {...externalProps} />
          </EmojiButtonWrapper>
        );
      }
      case 'image':
        return <UploadImageButton key={key} {...externalProps} handleFilesUpload={this.handleFilesEvent} />;
      case 'video':
        return (
          <div key={key} className={cf('toolbarButtonWrapper')}>
            <button type="button" onClick={this.showDialogToAddVideo}>
              <Icon name="play" />
            </button>
          </div>
        );
      default: {
        const FeatureComponent = this.featureMap.get(feature);
        return FeatureComponent && <FeatureComponent key={key} {...externalProps} />;
      }
    }
  };

  renderFeatures = () => {
    const { SideToolbar, InlineToolbar, EmojiSuggestions, AlignmentTool, StaticToolbar } = this.pluginComponents;
    const { readOnly, sideToolbarFeatures, inlineToolbarFeatures, staticToolbarFeatures, editorKey, overlayContainer } = this.props;
    if (readOnly) {
      return <div />;
    }
    let sideToolbar;
    let inlineToolbar;
    let staticToolbar;
    if (sideToolbarFeatures?.length) {
      sideToolbar = (
        <SideToolbar>
          {externalProps => (
            <div>{sideToolbarFeatures.map(feature => this.renderMenuComponent({ feature, keyPattern: `${editorKey}-side-toolbar`, externalProps }))}</div>
          )}
        </SideToolbar>
      );
    }
    if (inlineToolbarFeatures?.length) {
      inlineToolbar = (
        <InlineToolbar OverrideToolbar={InlineToolbarFlyOut} overlayContainer={overlayContainer} height={40}>
          {externalProps => (
            <div>{inlineToolbarFeatures.map(feature => this.renderMenuComponent({ feature, keyPattern: `${editorKey}-inline-toolbar`, externalProps }))}</div>
          )}
        </InlineToolbar>
      );
    }
    if (staticToolbarFeatures?.length) {
      staticToolbar = (
        <StaticToolbar>
          {externalProps => (
            <div>{staticToolbarFeatures.map(feature => this.renderMenuComponent({ feature, keyPattern: `${editorKey}-static-toolbar`, externalProps }))}</div>
          )}
        </StaticToolbar>
      );
    }
    return (
      <div>
        <EmojiSuggestions />
        {sideToolbar && sideToolbar}
        {inlineToolbar && inlineToolbar}
        {staticToolbar && staticToolbar}
        <AlignmentTool className={cf('alignmentTool')} />
      </div>
    );
  };

  showDialogToAddVideo = () => {
    // TODO: if escape should not close the dialog
    // just don't call close?.() on onCloseRequest
    const close = showMsgBox(
      <AddVideoPrompt
        onCloseRequest={() => close?.()}
        addVideoURLRequest={src => {
          this.setState(({ editorState: oldEditorState }) => {
            const editorState = this.videoPlugin.addVideo(oldEditorState, { src });
            this.onChange(editorState);
          });
          close?.();
        }}
      />,
      {
        lblOK: '',
        lblCancel: '',
        closeOnTapAway: true,
      },
    );
  };

  get shouldShowCaption() {
    const { characterLimit, field, minCharactersRemainingWarning } = this.props;
    const { remainingCharacters } = this.state;

    if (field.errorMessage) return true;

    if (!characterLimit || remainingCharacters < 0) return false;

    const are25PercentOfCharactersRemaining = remainingCharacters / characterLimit < 0.25;

    return minCharactersRemainingWarning ? remainingCharacters <= minCharactersRemainingWarning : are25PercentOfCharactersRemaining;
  }

  render() {
    const { readOnly, field, useFixedHeight, fitContent, transparent } = this.props;
    const { remainingCharacters, editorState } = this.state;

    return (
      <div>
        <div className={cf('editor', { readOnly, useFixedHeight, fitContent, transparent })} onClick={this.focus} onBlur={this.applyEnhancements}>
          <Observer>
            {() =>
              this.areFilesUploading ? (
                <div className={cf('loadingLabelContainer')}>
                  <div className={cf('loadingLabel')}>
                    <Text>{this.props.txtLoadingImages}</Text>
                  </div>
                </div>
              ) : (
                <div />
              )
            }
          </Observer>
          <Editor
            {...this.props}
            editorState={editorState}
            onChange={this.onChange}
            stripPastedStyles={true}
            plugins={this.plugins}
            ref={element => {
              this.editorDraftComponent = element;
            }}
            customStyleMap={this.customStyleMap}
          />
          {this.renderFeatures()}
        </div>
        {!readOnly && (
          <div className={cf('options')}>
            {this.shouldShowCaption && (
              <Caption error={!!field.errorMessage} className={cf('characterRemaining')} secondary>
                {field.errorMessage || t('MESSAGE_CHARACTERS_REMAINING', { count: remainingCharacters })}
              </Caption>
            )}
          </div>
        )}
      </div>
    );
  }
}
