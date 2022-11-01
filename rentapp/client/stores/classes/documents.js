/*
 * Copyright (c) 2022 Reva Technology Inc., all rights reserved.
 * Unauthorized copying of this file, via any medium is strictly prohibited
 * Licensed under the Elastic License 2.0; you may not use this file except
 * in compliance with the Elastic License 2.0.
 */

import { action, observable, computed, toJS } from 'mobx';

export class Documents {
  @observable
  documentsError;

  @observable
  documents;

  constructor({ apiClient, path, userId }) {
    this.apiClient = apiClient;
    this.path = path;
    this.userId = userId;
  }

  @computed
  get files() {
    return (this.documents && toJS(this.documents)) || [];
  }

  @action
  addFile({ id, name, type, size, categoryId }) {
    if (this.files.some(file => file.id === id)) return;

    const file = {
      id,
      name,
      type,
      size,
      metadata: {
        categoryId,
      },
    };

    this.documents.push(file);
  }

  @action
  removeFile(id) {
    const documentIndex = (this.documents || []).findIndex(doc => doc.id === id);
    if (documentIndex < 0) return;

    this.documents.splice(documentIndex, 1);
  }

  @action
  updateCategory(id, categoryId) {
    const document = (this.documents || []).find(doc => doc.id === id);
    if (!document) return;

    document.metadata.categoryId = categoryId;
  }

  @action
  fillItems(files) {
    if (files) {
      this.documents = files.map(doc => ({
        id: doc.file.id,
        name: doc.file.originalName,
        type: doc.file.mimetype,
        size: doc.file.size,
        metadata: {
          categoryId: doc.category,
        },
      }));
    }
  }

  @action
  _handleError(err) {
    this.documentsError = err.token || err.message || err.code;
    console.error('error fetching documents', err);
  }

  @action
  async loadDocuments() {
    try {
      const response = await this.apiClient.get(`${this.path}/${this.userId}/documents`);
      this.fillItems(response);
    } catch (err) {
      this._handleError(err);
    }
  }
}
