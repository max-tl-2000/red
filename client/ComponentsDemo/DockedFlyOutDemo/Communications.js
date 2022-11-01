/*
 * Copyright (c) 2022 Reva Technology Inc., all rights reserved.
 * Unauthorized copying of this file, via any medium is strictly prohibited
 * Licensed under the Elastic License 2.0; you may not use this file except
 * in compliance with the Elastic License 2.0.
 */

import PropTypes from 'prop-types';
import React, { Component } from 'react';
import generateId from 'helpers/generateId';
import clsc from 'helpers/coalescy';
import { Button, TextBox } from 'components';
import { cf, g } from './Communications.scss';
import Message from './Message';
import Divider from './Divider';

import Tabs from './Tabs';
import Tab from './Tab';

export default class Communications extends Component {
  constructor(props, context) {
    super(props, context);
    this.id = generateId(this);
  }

  static propTypes = {
    id: PropTypes.string,
  };

  render() {
    const { className, section, onChange, id, ...rest } = this.props;
    const theId = clsc(id, this.id);

    return (
      <div id={theId} className={cf('communications', g(className))} {...rest}>
        <Tabs className={cf('tabs-section')} onChange={onChange} section={section}>
          <Tab section="emails" iconName="email">
            Emails
          </Tab>
          <Tab section="messages" iconName="message-text">
            <div className={cf('messages-section')}>
              <div className={cf('messages')}>
                <Divider label="Yesterday" />
                <Message owner={true} userName="Jack Harness" time="10:20" content="Some text goes here. Lorem ipsum" />
                <Message
                  owner={true}
                  userName="Jack Harness"
                  time="10:25"
                  content="Some text goes here. Lorem ipsum Some text goes here. Lorem ipsum Some text goes here. Lorem ipsum Some text goes here. Lorem ipsum Some text goes here. Lorem ipsum"
                />
                <Message owner={false} userName="Mary Jane" time="10:30" content="Some text goes here. Lorem ipsum" />
                <Divider label="Today" />
                <Message owner={true} userName="Jack Harness" time="10:15" content="Some text goes here. Lorem ipsum" />
                <Message
                  owner={true}
                  userName="Jack Harness"
                  time="10:20"
                  content="Some text goes here. Lorem ipsum Some text goes here. Lorem ipsum Some text goes here. Lorem ipsum Some text goes here. Lorem ipsum Some text goes here. Lorem ipsum"
                />
                <Message owner={false} userName="Mary Jane" time="10:50" content="Some text goes here. Lorem ipsum" />
              </div>

              <div className={cf('form-section')}>
                <div className={cf('form')}>
                  <TextBox placeholder="Enter message" />
                  <Button label="Send" type="flat" />
                </div>
              </div>
            </div>
          </Tab>
          <Tab section="calls" iconName="phone">
            Calls
          </Tab>
        </Tabs>
      </div>
    );
  }
}
