/*
 * Copyright (c) 2022 Reva Technology Inc., all rights reserved.
 * Unauthorized copying of this file, via any medium is strictly prohibited
 * Licensed under the Elastic License 2.0; you may not use this file except
 * in compliance with the Elastic License 2.0.
 */

import PropTypes from 'prop-types';
import React, { Component } from 'react';
import { createPhoneContactGroupsFromPartyMembers } from 'helpers/contacts';
import CopyToClipboard from 'react-copy-to-clipboard';
import { t } from 'i18next';

import ContactsSearchForm from 'custom-components/SearchForm/ContactsSearchForm';

import { IconButton, FlyOut, FlyOutOverlay, Dialog, DialogOverlay, AutoSize, Button } from 'components';
import Headline from '../../components/Typography/Headline';
import SubHeader from '../../components/Typography/SubHeader';
import Caption from '../../components/Typography/Caption';
import { cf, g } from './CommunicationBox.scss';

export default class ExternalCommunicationBox extends Component {
  static propTypes = {
    className: PropTypes.string,
    showContactEvent: PropTypes.bool,
    onContactEvent: PropTypes.func,
    onMail: PropTypes.func,
    iconsStyle: PropTypes.string,
    phoneDisabled: PropTypes.bool,
    mailDisabled: PropTypes.bool,
    partyMembers: PropTypes.object,
  };

  static defaultProps = {
    showContactEvent: true,
  };

  constructor(props) {
    super(props);
    this.state = {
      isContactsFlyoutOpen: false,
      isContactInfoDialogOpen: false,
    };
  }

  openContactsFlyout = () => this.setState({ isContactsFlyoutOpen: true });

  onCloseContactsFlyout = () => this.setState({ isContactsFlyoutOpen: false });

  openContactInfoDialog = ({ item: selectedContact }) => {
    this.setState({
      isContactsFlyoutOpen: false,
      isContactInfoDialogOpen: true,
      selectedContact,
    });
  };

  onCloseContactInfoDialog = () =>
    this.setState({
      isContactInfoDialogOpen: false,
      isPhoneCopiedToClipboard: false,
    });

  renderPhone = () => (
    <span>
      <IconButton
        id="phone-button"
        iconName="phone"
        className="commButton"
        disabled={this.props.phoneDisabled}
        iconStyle={this.props.iconsStyle}
        onClick={this.openContactsFlyout}
      />
      <FlyOut positionArgs={{ at: 'bottom', of: '#phone-button' }} open={this.state.isContactsFlyoutOpen} onCloseRequest={this.onCloseContactsFlyout}>
        <FlyOutOverlay style={{ padding: 0 }}>
          <ContactsSearchForm contacts={createPhoneContactGroupsFromPartyMembers(this.props.partyMembers)} onContactSelected={this.openContactInfoDialog} />
        </FlyOutOverlay>
      </FlyOut>
      <Dialog id="contact-dialog" type="modal" closeOnTapAway={true} open={this.state.isContactInfoDialogOpen} onCloseRequest={this.onCloseContactInfoDialog}>
        <DialogOverlay className={cf('contact-dialog')}>
          {this.state.selectedContact && (
            <div className={cf('contact-dialog-content')}>
              <SubHeader lighter>{this.state.selectedContact.fullName}</SubHeader>
              <div className={cf('dialog-copy-phone')}>
                <div className={cf('dialog-before-phone')} />
                <div className={cf('dialog-phone')}>
                  <Headline lighter>{this.state.selectedContact.phone}</Headline>
                </div>
                <div className={cf('dialog-after-phone')}>
                  <CopyToClipboard text={this.state.selectedContact.phone} onCopy={() => this.setState({ isPhoneCopiedToClipboard: true })}>
                    <Button type="flat">Copy</Button>
                  </CopyToClipboard>
                </div>
              </div>
              <div className={cf('dialog-phone-copied-label')}>
                {this.state.isPhoneCopiedToClipboard ? (
                  <Caption lighter disabled>
                    {t('PHONE_COPIED_TO_CLIPBOARD')}
                  </Caption>
                ) : (
                  <noscript />
                )}
              </div>
            </div>
          )}
        </DialogOverlay>
      </Dialog>
    </span>
  );

  renderLoose = () => {
    const boxStyle = cf({ commBox: !this.props.noAutoSize }, g(this.props.commBoxClassName));
    return (
      <div className={boxStyle}>
        {this.renderPhone()}
        <IconButton iconName="email" className="commButton" disabled={this.props.mailDisabled} iconStyle={this.props.iconsStyle} onClick={this.props.onMail} />
        {this.props.showContactEvent ? (
          <IconButton iconName="calendar-text" className="commButton" iconStyle={this.props.iconsStyle} onClick={this.props.onContactEvent} />
        ) : (
          <noscript />
        )}
      </div>
    );
  };

  renderCompact = () => (
    <div className={cf({ commBox: !this.props.noAutoSize }, g(this.props.commBoxClassName))}>
      {this.renderPhone()}
      <FlyOut expandTo="bottom" overTrigger>
        <IconButton className={cf('affordance')} iconStyle={this.props.iconsStyle} iconName="menu-down" />
        <FlyOutOverlay container={false} contentClassName={cf('dropdown')}>
          <IconButton iconName="email" className="commButton" disabled={this.props.mailDisabled} onClick={this.props.onMail} />
          {this.props.showContactEvent ? <IconButton iconName="calendar-text" className="commButton" onClick={this.props.onContactEvent} /> : <noscript />}
        </FlyOutOverlay>
      </FlyOut>
    </div>
  );

  render() {
    const { className, noAutoSize, compact } = this.props;
    const theClasses = cf('wrapper', g(className));

    return do {
      if (noAutoSize) {
        compact ? this.renderCompact() : this.renderLoose();
      } else {
        <AutoSize breakpoints={false} className={theClasses}>
          {({ width }) => (width < 200 ? this.renderCompact() : this.renderLoose())}
        </AutoSize>;
      }
    };
  }
}
