/*
 * Copyright (c) 2022 Reva Technology Inc., all rights reserved.
 * Unauthorized copying of this file, via any medium is strictly prohibited
 * Licensed under the Elastic License 2.0; you may not use this file except
 * in compliance with the Elastic License 2.0.
 */

export enum MaintenanceStatus {
  Open = 'open',
  Resolved = 'resolved',
  Cancelled = 'cancelled',
}

export enum MaintenancePriority {
  Low = 'low',
  Medium = 'medium',
  High = 'high',
  Emergency = 'emergency',
}

export interface AttachmentUrlMetadata {
  'Content-Type': string;
  'reva-userid': string;
  'reva-inventoryid': string;
}

export interface AttachmentUrl {
  metadata: AttachmentUrlMetadata;
  url: string;
}

export interface Ticket {
  location: string;
  priority: MaintenancePriority;
  dateCreated: string;
  dateCompleted: string;
  dateCancelled: string;
  type: string;
  description: string;
  hasPermissionToEnter: boolean;
  hasPets: boolean;
  status: MaintenanceStatus;
  ticketNumber: number;
  attachmentUrls: AttachmentUrl[];
  phone: string;
}

export interface MaintenanceTicket {
  inventoryId: string;
  tickets: Ticket[];
}

export interface MaintenanceInfo {
  unitsMaintenanceInfo: MaintenanceTicket[];
}
