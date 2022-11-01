/*
 * Copyright (c) 2022 Reva Technology Inc., all rights reserved.
 * Unauthorized copying of this file, via any medium is strictly prohibited
 * Licensed under the Elastic License 2.0; you may not use this file except
 * in compliance with the Elastic License 2.0.
 */

import PropTypes from 'prop-types';
import React, { Component } from 'react';
import { t } from 'i18next';
import { formatPhone } from 'helpers/phone-utils';
import difference from 'lodash/difference';
import { Button, Dialog, DialogHeader, DialogOverlay, DialogActions } from 'components';
import PersonCard from './PersonCard';
import { cf } from './MergePersons.scss';
import { isFullNameAContactInfo } from '../../../helpers/contacts';
import { DALTypes } from '../../../../common/enums/DALTypes';
import Divider from '../../../containers/Communication/Divider';
import { enhance as enhanceContactInfos, contactInfoListContainsValue } from '../../../../common/helpers/contactInfoUtils';

export default class MergePersons extends Component {
  static propTypes = {
    firstPerson: PropTypes.object,
    secondPerson: PropTypes.object,
    open: PropTypes.bool,
    onCloseRequest: PropTypes.func,
    onMergePersons: PropTypes.func.isRequired,
  };

  constructor(props) {
    super(props);
    this.state = {
      mergedPerson: this.createMergedPerson(props),
    };
  }

  createMergedPerson = ({ firstPerson, secondPerson }) => {
    const basePerson = firstPerson?.commonUserEmail ? firstPerson : secondPerson;
    const otherPerson = basePerson.id === secondPerson.id ? firstPerson : secondPerson;
    if (basePerson && otherPerson) {
      const mergedPerson = {
        ...basePerson,
        fullName: isFullNameAContactInfo(basePerson) && !isFullNameAContactInfo(otherPerson) ? otherPerson.fullName : basePerson.fullName,
        contactInfo: {
          phones: this.getContactInfoPhones(basePerson, otherPerson),
          emails: this.getContactInfoEmails(basePerson, otherPerson),
        },
      };
      return mergedPerson;
    }
    return basePerson;
  };

  getPersonPhones = person => {
    if (person && person.contactInfo) {
      if (person.contactInfo.phones) {
        return person.contactInfo.phones;
      }

      return person.contactInfo.filter(item => item.type === DALTypes.ContactInfoType.PHONE);
    }
    return [];
  };

  getPersonEmails = person => {
    if (person && person.contactInfo) {
      if (person.contactInfo.emails) {
        return person.contactInfo.emails;
      }

      return person.contactInfo.filter(item => item.type === DALTypes.ContactInfoType.EMAIL);
    }
    return [];
  };

  getContactInfoPhones = (basePerson, otherPerson) => {
    const basePersonPhones = this.getPersonPhones(basePerson);
    const otherPersonPhones = this.getPersonPhones(otherPerson);

    return basePersonPhones.concat(otherPersonPhones.filter(item => !contactInfoListContainsValue(basePersonPhones, item)));
  };

  getContactInfoEmails = (basePerson, otherPerson) => {
    const basePersonEmails = this.getPersonEmails(basePerson);
    const otherPersonEmails = this.getPersonEmails(otherPerson);

    return basePersonEmails.concat(otherPersonEmails.filter(item => !contactInfoListContainsValue(basePersonEmails, item)));
  };

  componentWillReceiveProps = nextProps => {
    const mergedPerson = this.createMergedPerson(nextProps);
    this.setState({ mergedPerson });
  };

  getHighlights = () => {
    const firstPersonPhones = this.getPersonPhones(this.props.firstPerson).map(item => formatPhone(item.value));
    const firstPersonEmails = this.getPersonEmails(this.props.firstPerson).map(item => item.value);
    const secondPersonPhones = this.getPersonPhones(this.props.secondPerson).map(item => formatPhone(item.value));
    const secondPersonEmails = this.getPersonEmails(this.props.secondPerson).map(item => item.value);

    return {
      phones: { phones: difference(firstPersonPhones, secondPersonPhones), exactMatch: true },
      emails: { emails: difference(firstPersonEmails, secondPersonEmails), exactMatch: true },
    };
  };

  getContactInfoToUpdate = () => {
    const firstPersonPhones = this.getPersonPhones(this.props.firstPerson);
    const firstPersonEmails = this.getPersonEmails(this.props.firstPerson);
    const secondPersonPhones = this.getPersonPhones(this.props.secondPerson);
    const secondPersonEmails = this.getPersonEmails(this.props.secondPerson);

    if (this.props.firstPerson && this.props.firstPerson.id) {
      const contactInfos = firstPersonPhones
        .filter(item => !contactInfoListContainsValue(secondPersonPhones, item))
        .concat(firstPersonEmails.filter(item => !contactInfoListContainsValue(secondPersonEmails, item)));
      return enhanceContactInfos(contactInfos);
    }

    const phonesRes = secondPersonPhones.concat(firstPersonPhones.filter(item => !contactInfoListContainsValue(secondPersonPhones, item)));
    const emailsRes = secondPersonEmails.concat(firstPersonEmails.filter(item => !contactInfoListContainsValue(secondPersonEmails, item)));

    return enhanceContactInfos(phonesRes.concat(emailsRes));
  };

  performMerge = () => {
    const contactInfoToUpdate = this.getContactInfoToUpdate(this.props.firstPerson.contactInfo);
    const {
      firstPerson: { id: firstPersonId },
      secondPerson: { id: secondPersonId },
    } = this.props;
    const mergeData = {
      firstPersonId,
      secondPersonId,
      contactInfoToUpdate,
    };

    this.props.onMergePersons(mergeData);
  };

  render({ firstPerson, secondPerson, open, onCloseRequest } = this.props) {
    return (
      <Dialog id="mergePersonsDialog" open={open} onCloseRequest={onCloseRequest} absoluteZIndex={9999}>
        <DialogOverlay container={false}>
          <DialogHeader title={t('MERGE_PERSONS_FORM_TITLE')} />
          <div className={cf('main-content')}>
            <div className={cf('leftPanel')}>
              <Divider label={t('MERGE')} />
              <PersonCard person={firstPerson} />

              <Divider label={t('WITH')} />
              <PersonCard person={secondPerson} />
            </div>
            <div className={cf('rightPanel')}>
              <Divider label={t('RESULTING_IN')} />
              <PersonCard person={this.state.mergedPerson} query={this.getHighlights()} />
            </div>
          </div>
          <DialogActions>
            <Button
              id="backMergePersonsBtn"
              onClick={() => {
                onCloseRequest(false);
              }}
              label={t('BACK')}
              btnRole={'secondary'}
            />
            <Button id="mergePersonsBtn" onClick={this.performMerge} label={'MERGE'} btnRole={'primary'} />
          </DialogActions>
        </DialogOverlay>
      </Dialog>
    );
  }
}
