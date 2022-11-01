/*
 * Copyright (c) 2022 Reva Technology Inc., all rights reserved.
 * Unauthorized copying of this file, via any medium is strictly prohibited
 * Licensed under the Elastic License 2.0; you may not use this file except
 * in compliance with the Elastic License 2.0.
 */

'use strict';
import BasePage from 'lib/BasePage';
import { expect } from 'chai';
import config from 'config';
import logger from 'helpers/logger';

const { cucumber } = config;

export default class Home extends BasePage {
  constructor() {
    super();
    this.url = `${this.baseURL}/sales`;
  }

  async validateHome() {
    const text = await this.getText('#lbl-invite-success');
    expect(text).to.equal('Login Success');
  }

  async checkForDashboard() {
    await this.findElement('.dashboard-view');
  }

  async openPage() {
    return this.visit(this.baseURL);
  }

  async openMainMenu() {
    return this.clickOnElement('#side-nav');
  }

  clickLogout() {
    return this.clickOnElement('#logout');
  }

  clickIMAvailable() {
    return this.clickOnElement('#availableBtn');
  }

  async checkEmployeeCardStatus(status) {
    await this.findElement(`[data-id="employee-avatar"] [data-part="badge"] [data-red-icon][name="${status}"]`);
  }

  async checkIfCardExistInColumn(columnId, personName) {
    const condFunc = async () => {
      logger.trace(`Check if card: '${personName}' exists in column '${columnId}'.`);
      const cardText = await this.getText(`#${columnId} [data-id="card"] [data-id="${personName}"]`);
      return cardText.indexOf(personName) !== -1;
    };
    await this.waitForCondition(
      `time to check if card: '${personName}' exists in column '${columnId}' has expired`,
      condFunc,
      cucumber.selenium.defaultTimeout,
    );
  }

  async checkIfCardContainsMessage(personName, columnId, message) {
    const condFunc = async () => {
      logger.trace(`Check if card: '${personName}' exists in column '${columnId}'.`);
      const cardMessageText = await this.getText(`#${columnId} [data-id="card"] [data-id="message ${personName}"] p:nth-child(2)`);
      return cardMessageText.indexOf(message) !== -1;
    };
    await this.waitForCondition(
      `time to check if card: '${personName}' in column '${columnId}' contains '${message}' has expired`,
      condFunc,
      cucumber.selenium.defaultTimeout,
    );
  }

  clickOnCard(personName, columnId) {
    return this.clickOnElement(`#${columnId} [data-id="${personName}"]`);
  }

  async clickOnFirstLead() {
    const firstLead = await this.findElement("#leads [data-component='card']:first-of-type [data-component='subheader']:first-of-type");
    return this.clickOnWebdriverElement(firstLead);
  }

  async clickOnTask(columnId, personName, taskName) {
    const getTasksForCard = async cardsColumn => {
      logger.trace(`Check if card: '${cardsColumn}' belongs to person '${personName}'.`);
      const subHeader = await this.findElement('[data-component="subheader"]', cardsColumn);
      const titleEl = await subHeader.getText();

      logger.trace(`Check card title: '${titleEl}' equals to '${personName}'.`);
      return titleEl === personName ? await this.findElement(`[data-task-name="${taskName}"]`, cardsColumn) : null;
    };

    // Get all cards from column
    const cardsList = await this.findElements(`#${columnId} [data-id="card"]`);

    // Find the specific tasks associated to card
    let tasksList = await Promise.all(cardsList.map(column => getTasksForCard(column)));

    tasksList = tasksList.filter(Boolean);

    logger.trace(`Task List: '${tasksList[0]}'`);
    if (tasksList[0]) {
      await this.clickOnWebdriverElement(tasksList[0]);
    }
  }

  async navigateRight() {
    return this.clickOnElement('[class^="navigatorRight"]');
  }

  async navigateLeft() {
    return this.clickOnElement('[class^="navigatorLeft"]');
  }
}
