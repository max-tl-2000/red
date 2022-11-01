/*
 * Copyright (c) 2022 Reva Technology Inc., all rights reserved.
 * Unauthorized copying of this file, via any medium is strictly prohibited
 * Licensed under the Elastic License 2.0; you may not use this file except
 * in compliance with the Elastic License 2.0.
 */

import PropTypes from 'prop-types';
import React, { Component } from 'react';
import { findDOMNode } from 'react-dom';
import { observer } from 'mobx-react';

import { Card, CardActions, Field, FormActions, MsgBox, Button } from 'components';

import scrollIntoView from 'helpers/scrollIntoView';
import sleep from 'helpers/sleep';
import $ from 'jquery';
import { t } from 'i18next';

import EmptyMessage from 'custom-components/EmptyMessage/EmptyMessage';

import { toSentenceCase } from 'helpers/capitalize';
import { sortByCreationDate } from 'helpers/sortBy';
import isEqual from 'lodash/isEqual';
import CollectionPanelContextMenu from './CollectionPanelContextMenu';
import { cf } from './CollectionPanel.scss';

@observer
export default class CollectionPanel extends Component {
  static propTypes = {
    entityName: PropTypes.string,
    entityLabel: PropTypes.string,
    FormComponent: PropTypes.func.isRequired,
    EntityComponent: PropTypes.func.isRequired,
    contextMenuActions: PropTypes.array,
    contextMenuDefaults: PropTypes.bool.isRequired,
    collectionViewModel: PropTypes.object.isRequired,
    createFormModel: PropTypes.func.isRequired,
    useRevealingPanel: PropTypes.bool,
    lblBtnAdd: PropTypes.string,
    lblBtnEdit: PropTypes.string,
    lblBtnRemove: PropTypes.string,
    lblBtnSave: PropTypes.string,
    lblBtnCancel: PropTypes.string,
    noItemsLabel: PropTypes.string,
    initialData: PropTypes.object,
    hideEditAction: PropTypes.bool,
    hideRemoveAction: PropTypes.bool,
    restrictAddOrRemoveItems: PropTypes.bool,
    restrictAddOrRemoveItemsTitle: PropTypes.string,
    restrictAddOrRemoveItemsMsg: PropTypes.string,
    validateOnChange: PropTypes.func,
  };

  constructor(props) {
    super(props);
    this.state = {
      createModel: props.createFormModel(props.initialData || {}),
      editingModel: props.createFormModel({}),
      editDialogOpen: false,
      editingItem: null,
      contextOpen: false,
      isCardExpanded: false,
      isAddingItemsNotAllowedMsgOpen: false,
    };
  }

  componentWillReceiveProps = nextProps => {
    if (!isEqual(nextProps.initialData, this.props.initialData)) {
      this.setState({
        createModel: nextProps.createFormModel(nextProps.initialData || {}),
      });
    }
  };

  entityStr(plural = false) {
    if (plural) {
      if (this.props.entityLabel) {
        return t(this.props.entityLabel, { count: 2 });
      }
      // this will always make naive translation of adding s; caller still has option of overriding labels if this
      // is not correct
      return `${this.props.entityName}s`;
    }
    return this.props.entityLabel ? t(this.props.entityLabel) : this.props.entityName;
  }

  validateAndSave = async args => {
    const formModel = this.state.createModel;
    if (formModel.dataIsReady) {
      await this.addNewEntity();
    } else if (formModel.atLeastOneRequiredIsFilled || formModel.interacted) {
      args.cancel = true;
      await formModel.validate();
    }
  };

  validateOnChangeType = async () => {
    const formModel = this.state.createModel;
    const validateFields = false;
    await formModel.validate(validateFields);
  };

  renderContextMenu = () => {
    const { lblBtnEdit, lblBtnRemove, contextMenuActions, contextMenuDefaults, hideEditAction, hideRemoveAction } = this.props;
    const translateLabel = label => `${t(label, { entityName: this.entityStr() })}`;
    const editLabel = toSentenceCase(lblBtnEdit || translateLabel('EDIT_ITEM'));
    const removeLabel = toSentenceCase(lblBtnRemove || translateLabel('REMOVE_ITEM'));
    return (
      <CollectionPanelContextMenu
        defaultActions={contextMenuDefaults}
        customActions={contextMenuActions}
        open={this.state.contextOpen}
        onSelect={this.handleContextMenuAction}
        positionArgs={{
          my: 'left top',
          at: 'left top',
          of: this.state.trigger,
        }}
        onCloseRequest={this.closeContextMenu}
        editLabel={editLabel}
        removeLabel={removeLabel}
        hideEditAction={hideEditAction}
        hideRemoveAction={hideRemoveAction}
        id={this.entityStr()}
      />
    );
  };

  handleContextMenuAction = ({ action } = {}) => {
    const { contextMenuDefaults, contextMenuActions } = this.props;
    if (contextMenuDefaults) {
      if (action === 'edit') {
        const { editingModel, editingItem } = this.state;
        editingModel.updateFrom(editingItem);
        this.setState({ editDialogOpen: true });
      }
      if (action === 'remove') {
        this.props.restrictAddOrRemoveItems ? this.openAddingItemsNotAllowedMsgBox() : this.handleRemove();
      }
    }
    if (contextMenuActions && contextMenuActions.length) {
      const customAction = contextMenuActions.find(ca => ca.action === action);
      const { editingItem } = this.state;
      customAction && customAction.handler && customAction.handler(editingItem);
    }
  };

  closeContextMenu = e => {
    if (e.button === 2) return; // ignore right click to not mess with the context menu
    this.setState({ trigger: null, contextOpen: false });
  };

  renderItems = collectionItems => {
    const { EntityComponent } = this.props;
    return (
      <div>
        {collectionItems.sort(sortByCreationDate).map(item => (
          <Field key={item.id} className={cf('field-divider')} inline hoverable>
            <EntityComponent item={item} onItemSelected={this.showContextMenu} />
          </Field>
        ))}
      </div>
    );
  };

  showContextMenu = (e, item) => {
    e.preventDefault();
    this.setState({ trigger: e.target, editingItem: item, contextOpen: true });
  };

  getNoItemsMessage = noItemsLabel => {
    if (this.props.entityLabel === 'MINOR') return t('NO_MINORS_ADDED');

    if (this.props.entityLabel === 'ANIMAL') return t('NO_PETS_OR_SERVICE_ANIMALS_ADDED');

    return toSentenceCase(noItemsLabel || `${t('NO_ENTITY_ITEMS', { entityName: this.entityStr(true) })}`);
  };

  renderNoItems = () => {
    const { noItemsLabel, emptyMessageClassName, emptyMessageStyle } = this.props;
    const message = this.getNoItemsMessage(noItemsLabel);
    return <EmptyMessage data-id={`no_${this.entityStr(true)}_AddText`} className={emptyMessageClassName} style={emptyMessageStyle} message={message} />;
  };

  createForm = ({ noButtons = false, collectionItems } = {}) => {
    const { FormComponent, lblBtnAdd, validateOnChange } = this.props;
    const { createModel } = this.state;
    const actionLabel = lblBtnAdd || `${t('ADD_ITEM', { entityName: this.entityStr() })}`;
    return (
      <div className={cf({ 'form-component-container': !noButtons })}>
        <FormComponent
          model={createModel}
          mode="create"
          actionLabel={actionLabel}
          shouldDisableSearch={false}
          collectionItems={collectionItems}
          onSuggestedPersonSelected={this.addItemToCollection}
          validateOnChange={validateOnChange}
        />
        {!noButtons && (
          <FormActions className={cf('form-actions-margin')}>
            <Button id="addNewEntityBtn" label={actionLabel} disabled={!createModel.dataIsReady} onClick={this.addNewEntity} />
          </FormActions>
        )}
      </div>
    );
  };

  addItemToCollection = entity => {
    const { collectionViewModel: viewModel } = this.props;
    viewModel.add(entity);
  };

  renderEditForm = () => {
    const { FormComponent, lblBtnEdit, entityName } = this.props;
    const { editingModel, editDialogOpen } = this.state;
    const dialogTitle = `${lblBtnEdit || t('EDIT_ITEM', { entityName })}`;

    return (
      <MsgBox
        open={editDialogOpen}
        overlayClassName={cf('editFormDialog')}
        lblOK={lblBtnEdit || `${t('UPDATE_ITEM', { entityName })}`}
        container={false}
        compact={false}
        btnOKDisabled={!editingModel.dataIsReady}
        onOKClick={this.handleUpdateAction}
        onCloseRequest={this.handleCloseDialog}
        title={dialogTitle}>
        <FormComponent model={editingModel} mode="edit" />
      </MsgBox>
    );
  };

  handleUpdateEntity = (entity, id) => {
    const { collectionViewModel: viewModel } = this.props;
    viewModel.update(entity, id);
    this.cleanSelectedItem();
  };

  handleCloseDialog = () => {
    this.cleanSelectedItem();
  };

  handleRemove() {
    const { collectionViewModel: viewModel } = this.props;
    viewModel.remove(this.state.editingItem);
    this.cleanSelectedItem();
  }

  cleanSelectedItem() {
    const { editingModel } = this.state;
    editingModel.restoreInitialValues();

    this.setState({
      editingItem: null,
      editDialogOpen: false,
      contextOpen: false,
    });
  }

  get domNode() {
    return findDOMNode(this);
  }

  handleUpdateAction = async args => {
    const { editingModel, editingItem } = this.state;
    args.autoClose = false;

    await editingModel.validate();

    if (editingModel.valid) {
      const entity = editingModel.serializedData;

      this.handleUpdateEntity(entity, editingItem.id);

      this.handleCloseDialog();
    }
  };

  revealPanel = async () => {
    this.setState({ isCardExpanded: true });
    await sleep(300);
    scrollIntoView($(this.domNode).find(`.${cf('card')}`)[0]);
  };

  hidePanel = () => {
    this.setState({ isCardExpanded: false });
  };

  addNewEntity = async () => {
    const { createModel } = this.state;

    await createModel.validate();

    if (createModel.valid) {
      const item = createModel.serializedData;
      this.addItemToCollection(item);
      createModel.clearValues ? createModel.clearValues() : createModel.restoreInitialValues();

      const { useRevealingPanel } = this.props;
      if (useRevealingPanel) {
        this.hidePanel();
      }
    }
  };

  hideAndClear = () => {
    const { createModel } = this.state;
    createModel.restoreInitialValues();
    this.hidePanel();
  };

  openAddingItemsNotAllowedMsgBox = () => this.setState({ isAddingItemsNotAllowedMsgOpen: true });

  renderRevealingItem(collectionItems) {
    const { lblBtnAdd, lblBtnCancel, lblBtnSave, restrictAddOrRemoveItems } = this.props;
    const { isCardExpanded, createModel } = this.state;
    return (
      <div>
        {!isCardExpanded && (
          <Button
            data-id={`add${this.entityStr()}`}
            type="flat"
            onClick={restrictAddOrRemoveItems ? this.openAddingItemsNotAllowedMsgBox : this.revealPanel}
            label={lblBtnAdd || `${t('ADD_ITEM', { entityName: this.entityStr() })}`}
            data-command="ADD"
          />
        )}
        <Card container={false} className={cf('card', { open: isCardExpanded })}>
          {this.createForm({ noButtons: true, collectionItems })}
          <CardActions textAlign="right">
            <Button
              data-id={`btnCancelEdit${this.entityStr()}`}
              label={lblBtnCancel || t('CANCEL')}
              btnRole="secondary"
              type="flat"
              onClick={this.hideAndClear}
              data-command="CANCEL"
            />
            <Button
              data-id={`btnDoneEdit${this.entityStr()}`}
              label={lblBtnSave || t('DONE')}
              disabled={!createModel.dataIsReady}
              type="flat"
              onClick={this.addNewEntity}
              data-command="OK"
            />
          </CardActions>
        </Card>
      </div>
    );
  }

  render() {
    const {
      useRevealingPanel,
      collectionViewModel: { items: collectionItems },
      restrictAddOrRemoveItemsTitle,
      restrictAddOrRemoveItemsMsg,
    } = this.props;
    const { editingItem, editDialogOpen } = this.state;
    const collectionPanelId = this.props.collectionPanelId || 'collectionPanel';
    return (
      <div id={collectionPanelId}>
        <div className={cf('cards-section')}>{collectionItems.length ? this.renderItems(collectionItems) : this.renderNoItems()}</div>
        {this.renderContextMenu()}
        <div>{useRevealingPanel ? this.renderRevealingItem(collectionItems) : this.createForm()}</div>
        {editDialogOpen && editingItem && this.renderEditForm(editingItem)}
        <MsgBox
          open={this.state.isAddingItemsNotAllowedMsgOpen}
          onCloseRequest={() => this.setState({ isAddingItemsNotAllowedMsgOpen: false })}
          lblOK={t('OK_GOT_IT')}
          lblCancel=""
          title={restrictAddOrRemoveItemsTitle}
          content={restrictAddOrRemoveItemsMsg}
        />
      </div>
    );
  }
}
