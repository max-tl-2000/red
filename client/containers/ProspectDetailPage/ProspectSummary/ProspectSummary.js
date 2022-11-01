/*
 * Copyright (c) 2022 Reva Technology Inc., all rights reserved.
 * Unauthorized copying of this file, via any medium is strictly prohibited
 * Licensed under the Elastic License 2.0; you may not use this file except
 * in compliance with the Elastic License 2.0.
 */

import React, { Component } from 'react';
import { Text, Title, Caption } from '../../../components/Typography/Typography';

export default class ProspectSummary extends Component {
  constructor(props) {
    super(props);
    this.state = {
      data: [
        {
          id: 1,
          sectionTypeGlyph: 'description',
          sectionType: 'GUEST APPS',
          accentInfo: '1 denied Guest App',
          accentInfoColor: 'red',
          accentInfoDetail: '2 pending, 3 approved',
        },
        {
          id: 2,
          sectionTypeGlyph: 'people',
          sectionType: 'SALES TEAM',
          accentInfo: 'Jack Harkness',
          accentInfoDetail: 'Rose Tyler and 2 others',
        },
        {
          id: 3,
          sectionTypeGlyph: 'event_note',
          sectionType: 'APPOINTMENTS',
          accentInfo: 'Upcoming in 2 days',
          accentInfoDetail: '1 completed on Oct 5th',
        },
        {
          id: 4,
          sectionTypeGlyph: 'forum',
          sectionType: 'ACTIVITY',
          accentInfo: '3 unread emails',
          accentInfoDetail: '6 emails, 4 call logs this week',
        },
        {
          id: 5,
          sectionTypeGlyph: 'home',
          sectionType: 'QUOTES',
          accentInfo: '$4597 last quoted',
          accentInfoDetail: '2 other quotes sent',
        },
        {
          id: 6,
          sectionTypeGlyph: 'attach_money',
          sectionType: 'CURRENT BALANCE',
          accentInfo: '$350.00',
          accentInfoDetail: 'holding fee due from 2 Guests',
        },
      ],
    };
  }

  render() {
    const sectionStyle = {
      marginLeft: '20px',
      marginRight: '20px',
    };

    function getActionInfoStyle(section) {
      const st = {
        color: section.accentInfoColor,
      };
      return st;
    }

    const itemStyle = {
      minWidth: '350px',
      paddingLeft: '0px',
      marginLeft: '10px',
      marginBottom: '10px',
    };

    const buttonStyle = {
      margin: 'auto',
      padding: '0px',
    };

    const buttonContainerStyle = {
      margin: 'auto',
      background: 'darkgrey',
      height: '4rem',
      width: '4rem',
      padding: '0px',
      alignItems: 'center',
      display: 'flex',
    };

    const summarySections = this.state.data.map(section => (
      <div style={itemStyle} key={section.id}>
        <div style={{ display: 'flex' }}>
          <div style={buttonContainerStyle}>
            <a className="btn-flat" style={buttonStyle}>
              <i className="material-icons">{section.sectionTypeGlyph}</i>
            </a>
          </div>
          <div style={{ paddingTop: '.25em' }}>
            <Caption>{section.sectionType}</Caption>
            <Title style={getActionInfoStyle(section)}>{section.accentInfo}</Title>
            <Text secondary>{section.accentInfoDetail}</Text>
          </div>
        </div>
      </div>
    ));

    return (
      <div>
        <div style={sectionStyle}>
          <div>{summarySections}</div>
        </div>
      </div>
    );
  }
}
