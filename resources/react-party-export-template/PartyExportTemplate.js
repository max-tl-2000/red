/*
 * Copyright (c) 2022 Reva Technology Inc., all rights reserved.
 * Unauthorized copying of this file, via any medium is strictly prohibited
 * Licensed under the Elastic License 2.0; you may not use this file except
 * in compliance with the Elastic License 2.0.
 */

import React, { Component } from 'react';
import CollectionPanel from '../custom-components/PartyExport/CollectionPanel';
import CommonPersonCard from '../custom-components/PartyExport/CommonPersonCard';
import PersonCollectionViewModel from '../custom-components/PartyExport/PersonCollectionViewModel';
import Summary from '../custom-components/PartyExport/Summary';
import { ChildrenCard } from '../custom-components/PartyExport/ChildrenCard';
import { notesCard } from '../custom-components/PartyExport/notesCard';
import { PetCard } from '../custom-components/PartyExport/PetCard';
import VehicleCard from '../custom-components/PartyExport/VehicleCard';
import { InsuranceChoiceSummary } from '../custom-components/PartyExport/InsuranceChoiceSummary';
import IncomeSourceCard from '../custom-components/PartyExport/IncomeSourceCard';
import AddressCard from '../custom-components/PartyExport/AddressCard';
import DocumentCard from '../custom-components/PartyExport/DocumentCard';
import { DisclosureCard } from '../custom-components/PartyExport/DisclosureCard';
import Invoices from '../custom-components/PartyExport/Invoices';
import ScreeningRecommendations from '../custom-components/PartyExport/ScreeningRecommendations';
import { DALTypes } from '../../common/enums/DALTypes';
import { Title } from '../custom-components/PartyExport/Title';
import MemberApplicationInfo from '../custom-components/PartyExport/MemberApplicationInfo';

const addResidentGuaranteedFullNameToGuarantors = (guarantors, residents) => {
  guarantors.forEach(guarantor => {
    const guaranteedResident = residents.find(resident => resident.guaranteedBy === guarantor.id);
    if (guaranteedResident) guarantor.guaranteedFullName = guaranteedResident.fullName;
  });
};

const formatAdditionalInfoItems = items =>
  items.map(item => ({
    id: item.id,
    ...item.info,
    createdAt: item.created_at,
  }));

const formatAddressHistoryItems = items =>
  items.map(item => ({
    ...item.address,
    ownOrRent: item.ownOrRent,
    ownerName: item.ownerName,
    moveInDate: item.moveInDate,
    ownerPhone: item.ownerPhone,
    monthlyPayment: item.monthlyPayment,
    personId: item.personId,
    fullName: item.fullName,
  }));

export default class PartyExportTemplate extends Component {
  static styles = [...CollectionPanel.styles, ...CommonPersonCard.styles, ...Summary.styles, ...Invoices.styles, ...MemberApplicationInfo.styles];

  constructor(props) {
    super(props);
    addResidentGuaranteedFullNameToGuarantors(props.guarantors, props.residents);
    this.state = {
      residentsViewModel: new PersonCollectionViewModel(props.residents, DALTypes.MemberType.RESIDENT),
      guarantorsViewModel: new PersonCollectionViewModel(props.guarantors, DALTypes.MemberType.GUARANTOR),
      children: formatAdditionalInfoItems(props.children),
      pets: formatAdditionalInfoItems(props.pets),
      vehicles: formatAdditionalInfoItems(props.vehicles),
      insuranceChoice: formatAdditionalInfoItems(props.insuranceChoices).shift(),
      addressHistory: formatAddressHistoryItems(props.addressHistory),
      leaseNotes: formatAdditionalInfoItems(props.leaseNotes),
    };
  }

  renderCollectionPanel = (collection, title, entityComponent, collectionViewModel) => {
    if (!collection || !collection.length) return null;

    return (
      <div>
        <Title text={title} />
        <CollectionPanel EntityComponent={entityComponent} collectionViewModel={collectionViewModel} />
      </div>
    );
  };

  renderSummary = (items, title, childComponent) => {
    if (!items || !items.length) return null;
    return (
      <div>
        <Title text={title} />
        <Summary items={items} ChildComponent={childComponent} />
      </div>
    );
  };

  renderMembersApplicationInfo = () => {
    const { addressHistory } = this.state;
    const { applicationDataList, incomeSources, partyDocumentsSummary, disclosures } = this.props;

    return applicationDataList.map(applicationData => {
      const personId = applicationData.personId;
      const filterByPerson = item => item.personId === personId;

      const memberIncomeSources = incomeSources.filter(filterByPerson);
      const memberAddressHistory = addressHistory.filter(filterByPerson);
      const memberPartyDocuments = partyDocumentsSummary.filter(filterByPerson);
      const memberDisclosures = disclosures.filter(filterByPerson);

      return (
        <div key={personId}>
          <MemberApplicationInfo applicationInfo={applicationData} />
          <div style={{ paddingLeft: 16 }}>
            {this.renderSummary(memberIncomeSources, 'INCOME_SOURCES', IncomeSourceCard)}
            {this.renderSummary(memberAddressHistory, 'ADDRESS_HISTORY', AddressCard)}
            {this.renderSummary(memberPartyDocuments, 'ATTACHMENTS_SUMMARY', DocumentCard)}
            {this.renderSummary(memberDisclosures, 'DISCLOSURES', DisclosureCard)}
          </div>
        </div>
      );
    });
  };

  render() {
    const { residentsViewModel, guarantorsViewModel, children, pets, vehicles, insuranceChoice, leaseNotes } = this.state;
    const { guarantors, residents, partyInvoices, screeningResults } = this.props;
    return (
      <div style={{ maxWidth: 700 }}>
        {this.renderCollectionPanel(residents, 'RESIDENT_plural', CommonPersonCard, residentsViewModel)}
        {this.renderCollectionPanel(guarantors, 'GUARANTOR_plural', CommonPersonCard, guarantorsViewModel)}
        {this.renderSummary(children, 'CHILD_plural', ChildrenCard)}
        {this.renderSummary(pets, 'PETS', PetCard)}
        {this.renderSummary(vehicles, 'VEHICLES', VehicleCard)}
        {insuranceChoice && (
          <div>
            <Title text={'RENTERS_INSURANCE'} />
            <InsuranceChoiceSummary insuranceChoice={insuranceChoice} />
          </div>
        )}
        {screeningResults && !!screeningResults.length && (
          <div>
            <Title text={'SCREENING_RECOMMENDATIONS'} />
            <ScreeningRecommendations screeningResults={screeningResults} />
          </div>
        )}
        {partyInvoices && !!partyInvoices.length && (
          <div>
            <Title text={'PAYMENTS_AND_FEES'} />
            <Invoices invoices={partyInvoices} />
          </div>
        )}
        {leaseNotes?.some(note => note.isAnAuthorizedUser) && this.renderSummary(leaseNotes, 'APPLICATION_DECISION', notesCard)}

        {this.renderMembersApplicationInfo()}
      </div>
    );
  }
}
