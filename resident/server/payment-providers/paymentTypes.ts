/*
 * Copyright (c) 2022 Reva Technology Inc., all rights reserved.
 * Unauthorized copying of this file, via any medium is strictly prohibited
 * Licensed under the Elastic License 2.0; you may not use this file except
 * in compliance with the Elastic License 2.0.
 */

export enum ChargeType {
  Rent = 'RENT',
  Pet = 'PET',
}

export enum PaymentChannel {
  Debit = 'DEBIT',
  Credit = 'CREDIT',
  Ach = 'ACH',
  None = 'NONE',
}

export enum PaymentBrand {
  Visa = 'VISA',
  MasterCard = 'MASTERCARD',
  Amex = 'AMEX',
  Discover = 'DISCOVER',
}

export enum PaymentStatus {
  ACCEPT = 'PAYMENT_PERMITTED',
  NOT_ACCEPT = 'PAYMENT_NOT_PERMITTED',
  CERTIFIED_FUNDS = 'CERTIFIED_PAYMENT_PERMITTED',
}

export enum SchedulePaymentFrequencyType {
  MONTHLY = 'MONTHLY',
}

export interface CurrentCharge {
  type: ChargeType;
  description: string;
  dueDate: string; // earliest due date of all open charges
  balanceAmount: number;
}

export interface ShortPaymentMethod {
  channelType: PaymentChannel;
  brand: PaymentBrand;
  lastFour: string;
}

export interface Payment {
  method: ShortPaymentMethod;
  date: string;
  amount: number;
  fee: number;
  reversalFee?: number;
  totalAmount: number;
  providerTransactionId: string; // Aptexx calls this transaction ref
  checkNumber?: number;
  checkMemo?: string;
  reason?: string;
  inventoryId: string;
  providerRefundedTransactionId?: number;
}

export interface Transactions {
  payments?: Payment[];
  declines?: Payment[];
  voids?: Payment[];
  refunds?: Payment[];
  reversals?: Payment[];
  unitUserInfo?: UnitUserInfo;
}

export interface PaymentMethod {
  id: string; // Reva method ID used to create payment
  brand: PaymentBrand; // only applies to CC/Debit
  channelType: PaymentChannel;
  lastFour: string;
  expirationDate: string;
  isExpired: boolean;
  isDefault: boolean;
  absoluteServiceFeePrice?: number;
  relativeServiceFeePrice?: number;
  userId?: string;
  inventoryId?: string;
  createdAt: Date;
  externalId: string;
}

export interface ScheduledPayment {
  providerId: number;
  frequency: SchedulePaymentFrequencyType;
  startMonth: string;
  endMonth?: string;
  dayOfMonth: string;
  paymentMethodProviderId?: number;
  paymentAmount: number;
  paymentAccountName: ChargeType;
}

export interface UnitUserInfo {
  inventoryId: string;
  buildingDisplayName: string;
  unitDisplayName: string;
  fullyQualifiedName: string;
  balanceDueAmount?: number;
  balanceDueDate?: string; // computed on the backend as the earliest due date of all open charges
  paymentStatus?: PaymentStatus;
  isPastResident?: boolean;
  integrationIdIsMissing?: boolean;
}

export interface PaymentInfoToBuildFormUrl {
  personId: string;
  propertyId: string;
  inventoryId: string;
  commonUserId: string;
  successUrl: string;
  cancelUrl: string;
  tenantName: string;
}

export interface ScheduleInfoToBuildFormUrl {
  personId: string;
  propertyId: string;
  inventoryId: string;
  commonUserId: string;
  successUrl: string;
  cancelUrl: string;
}

export interface PaymentInfo {
  currentCharges?: CurrentCharge[];
  transactions?: Transactions;
  paymentMethods?: PaymentMethod[];
  scheduledPayments?: ScheduledPayment[];
  unitUserInfo?: UnitUserInfo;
}

export interface LeaseInfo {
  inventoryId?: string;
  unitFullyQualifiedName?: string;
  unitDisplayName?: string;
  buildingDisplayName?: string;
  partyMemberId?: string;
  partyId?: string;
  partyWorkflowState?: string;
  leaseId?: string;
  aptexxData: { accountPersonId: string; integrationId: string };
  personExternalId: string;
  propertyId: string;
}
