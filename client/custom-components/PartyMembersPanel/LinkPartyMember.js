/*
 * Copyright (c) 2022 Reva Technology Inc., all rights reserved.
 * Unauthorized copying of this file, via any medium is strictly prohibited
 * Licensed under the Elastic License 2.0; you may not use this file except
 * in compliance with the Elastic License 2.0.
 */

import React, { Component } from 'react';
import { MsgBox, Typography, Form, Field, RedList, Dropdown } from 'components';
import { t } from 'i18next';
import { createSelector } from 'reselect';
import { connect } from 'react-redux';
import { DALTypes } from '../../../common/enums/DALTypes';
import { getDisplayName } from '../../../common/helpers/person-helper';
import { getGuarantor, isResident, isOccupant, isGuarantor } from '../../../common/helpers/party-utils';
const { MainSection, ListItem } = RedList;
const { Text, Caption } = Typography;

const renderDropdownItem = ({ item, selectAffordance }) => {
  const { originalItem } = item;
  const dataId = `${originalItem.text.replace(/\s/g, '')}_ListItem`;
  return (
    <ListItem data-id={dataId}>
      {selectAffordance}
      <MainSection>
        <Text>{originalItem.text}</Text>
        {originalItem.subText && <Text secondary>{t('LINKED_TO', { name: originalItem.subText })}</Text>}
      </MainSection>
    </ListItem>
  );
};

const getItems = createSelector(
  (s, props) => props.partyMembers,
  (s, props) => props.selectedPartyMember,
  (partyMembers = [], selectedPartyMember = {}) => {
    const { memberType } = selectedPartyMember;
    return partyMembers
      .filter(member => member.memberType !== memberType && !isOccupant(member))
      .map(member => ({
        id: member.id,
        text: getDisplayName(member.person),
        subText: getGuarantor(member.guaranteedBy, partyMembers).guarantor,
      }));
  },
);

@connect((state, props) => ({
  items: getItems(state, props),
}))
export default class LinkPartyMember extends Component {
  selectedItems = (partyMembers = [], selectedPartyMember = {}) => {
    const { id, memberType, guaranteedBy } = selectedPartyMember;
    if (isResident(memberType)) {
      return guaranteedBy ? [guaranteedBy] : [];
    }
    return partyMembers.filter(member => member.guaranteedBy === id).map(member => member.id);
  };

  constructor(props) {
    super(props);
    this.state = {
      selectedItems: this.selectedItems(props.partyMembers, props.selectedPartyMember),
    };
  }

  componentWillReceiveProps = nextProps => {
    if (this.props.selectedPartyMember === nextProps.selectedPartyMember) {
      return;
    }
    this.setState({
      selectedItems: this.selectedItems(nextProps.partyMembers, nextProps.selectedPartyMember),
    });
  };

  renderDropdownResidents = (residents, selectedItems) => (
    <Dropdown
      id="selectResidentsDropdown"
      items={residents}
      multiple
      wide
      renderItem={renderDropdownItem}
      selectedValue={selectedItems}
      placeholder={t('SELECT_RESIDENTS')}
      onChange={this.handleDropdownChange}
    />
  );

  renderDropdownGuarantors = (guarantors, selectedItems) => (
    <Dropdown
      id="selectGuarantorsDropdown"
      testId="selectGuarantor"
      items={guarantors}
      wide
      selectedValue={selectedItems}
      placeholder={t('SELECT_GUARANTOR')}
      onChange={this.handleDropdownChange}
    />
  );

  handleDropdownChange = ({ ids }) => this.setState({ selectedItems: ids });

  handleOKClick = () => {
    const { onDone } = this.props;
    onDone && onDone(this.state.selectedItems);
  };

  shouldDisplayRemoveLink = typeToLink => {
    const { selectedItems = [] } = this.state;
    const { selectedPartyMember = {} } = this.props;
    if (!isGuarantor(typeToLink) || !selectedItems.length) return false;
    return !!selectedPartyMember.guaranteedBy;
  };

  render = () => {
    const { items, open, onCancel, selectedPartyMember = {}, onClose, onRemoveLinkPartyMember } = this.props;
    const { selectedItems } = this.state;
    const name = getDisplayName(selectedPartyMember.person);
    const typeToLink = isResident(selectedPartyMember) ? DALTypes.MemberType.GUARANTOR : DALTypes.MemberType.RESIDENT;

    const isResidentTypeToLink = isResident(typeToLink);

    const titleTransToken = isResidentTypeToLink ? 'LINK_RESIDENT' : 'LINK_GUARANTOR';
    const messageTransToken = isResidentTypeToLink ? 'LINK_RESIDENT_MESSAGE' : 'LINK_GUARANTOR_MESSAGE';

    const getDropdown = () => (isResidentTypeToLink ? this.renderDropdownResidents(items, selectedItems) : this.renderDropdownGuarantors(items, selectedItems));

    const displayRemoveLink = this.shouldDisplayRemoveLink(typeToLink);
    return (
      <MsgBox
        id="linkGuarantorResidentDialog"
        open={open}
        closeOnTapAway={false}
        onCloseRequest={() => () => onClose && onClose()}
        lblOK={t('DONE')}
        onOKClick={this.handleOKClick}
        lblCancel={t('CANCEL')}
        onCancelClick={() => onCancel && onCancel()}
        lblExtraButton={displayRemoveLink ? t('REMOVE_LINK') : ''}
        onExtraButtonClick={onRemoveLinkPartyMember}
        title={t(titleTransToken, { name })}>
        <Form>
          <Field noMargin>
            <Caption>{t(messageTransToken, { name })}</Caption>
          </Field>
          <div>
            <Field noMargin columns={12}>
              {getDropdown()}
            </Field>
          </div>
        </Form>
      </MsgBox>
    );
  };
}
