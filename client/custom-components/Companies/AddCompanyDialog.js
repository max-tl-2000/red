/*
 * Copyright (c) 2022 Reva Technology Inc., all rights reserved.
 * Unauthorized copying of this file, via any medium is strictly prohibited
 * Licensed under the Elastic License 2.0; you may not use this file except
 * in compliance with the Elastic License 2.0.
 */

import PropTypes from 'prop-types';
import React, { Component } from 'react';
import { MsgBox, Dropdown } from 'components';
import { t } from 'i18next';
import trim from 'helpers/trim';
import { cf } from './AddCompanyDialog.scss';
import { COMPANY_NAME_MAX_LENGTH } from '../../../common/enums/enums';
import { COMPANY_FAKE_ID } from '../../../common/helpers/party-utils';

export default class AddCompanyDialog extends Component {
  static propTypes = {
    open: PropTypes.bool,
    handleShowDialog: PropTypes.func,
    handleSaveCompany: PropTypes.func,
    loadCompanySuggestions: PropTypes.func,
    partyMember: PropTypes.object,
    companyId: PropTypes.string,
    companyName: PropTypes.string,
  };

  constructor(props) {
    super(props);
    this.state = {
      searchString: props.companyName,
    };
  }

  handleCloseDialog = () => {
    const { handleShowDialog } = this.props;
    handleShowDialog && handleShowDialog(false);
  };

  handleOkClick = () => {
    if (this.state?.companyName) {
      this.props.handleSaveCompany({ companyName: this.state.companyName, companyId: COMPANY_FAKE_ID }, this.props.partyMember);
    } else if (this.dropdown.value.item) {
      if (this.props.partyMember) {
        this.props.handleUpdatePartyMember(this.dropdown.value.item.id, this.props.partyMember);
      } else {
        const companyId = this.dropdown.value.item.id;
        const companyName = this.dropdown.value.item.displayName;

        this.props.handleSaveCompany({ companyId, companyName });
      }
    }
  };

  handleQueryChange = input => {
    const { handleLoadSuggestions } = this.props;

    if (!handleLoadSuggestions) return;
    return handleLoadSuggestions(input); // eslint-disable-line consistent-return
  };

  handleOnBlur = query => this.setState({ companyName: query });

  handleSearchString = query => {
    if (query.value === this.state.searchString) return;
    this.setState({ searchString: trim(query.value) });
  };

  render() {
    const { open, companyId, companySuggestions } = this.props;
    return (
      <MsgBox
        open={open}
        lblOK={t('EDIT_CONTACT_INFO_SAVE')}
        onCloseRequest={() => this.handleCloseDialog()}
        onOKClick={() => this.handleOkClick()}
        btnOKDisabled={!trim(this.state?.searchString)}
        onCancelClick={() => this.handleCloseDialog()}>
        <div className={cf('searchContainer')}>
          <Dropdown
            ref={ref => (this.dropdown = ref)}
            placeholder={t('COMPANY_NAME_TEXTBOX_PLACEHOLDER')}
            overlayClassName={cf('searchOverlay')}
            wide
            label={t('COMPANY_NAME')}
            autocomplete
            showAutocompleteTextBoxValue
            showCurrentSuggestion
            textField="displayName"
            valueField="id"
            id="txtCompanyName"
            items={companySuggestions}
            selectedValue={companyId}
            autocompleteTextBoxValue={this.state.searchString}
            source={this.handleQueryChange}
            onAutocompleteTextBoxChange={this.handleSearchString}
            maxLength={COMPANY_NAME_MAX_LENGTH}
            onBlur={this.handleOnBlur}
          />
        </div>
      </MsgBox>
    );
  }
}
