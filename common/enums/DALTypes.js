/*
 * Copyright (c) 2022 Reva Technology Inc., all rights reserved.
 * Unauthorized copying of this file, via any medium is strictly prohibited
 * Licensed under the Elastic License 2.0; you may not use this file except
 * in compliance with the Elastic License 2.0.
 */

export const DALTypes = {
  PersonIdType: {
    OTHER: 'Other',
    MEDICARE: 'Medicare',
    DRIVERLICENSE: 'DriverLicense',
    MILITARY: 'Military',
    SCHOOL: 'School',
    STATE: 'State',
  },

  // State for party and members.
  PartyStateType: {
    MOVINGOUT: 'MovingOut',
    FUTURERESIDENT: 'FutureResident',
    PASTRESIDENT: 'PastResident',
    PROSPECT: 'Prospect',
    RESIDENT: 'Resident',
    APPLICANT: 'Applicant',
    LEAD: 'Lead',
    CONTACT: 'Contact',
    LEASE: 'Lease',
  },

  PersonApplicationStatus: {
    OPENED: 'opened',
    PAID: 'paid',
    COMPLETED: 'completed',
    SENT: 'sent',
    NOT_SENT: 'not_sent',
    UNKNOWN_STATUS: 'unknown_status',
  },

  ApplicationWelcomeScreenEvents: {
    CHECKED: 'checked',
    UNCHECKED: 'unchecked',
    PAGE_VIEW: 'pageView',
    BUTTON: 'buttonClicked',
  },

  ScreeningRecommendation: {
    ERROR_ADDRESS_UNPARSABLE_RECOMMENDATION: 'error_address_unparsable_recommendation',
    GENERIC_ERROR_RECOMMENDATION: 'generic_error_recommendation',
  },

  ScreeningConditions: {
    ADD_GUARANTOR: 'add_guarantor',
    INCREASE_DEPOSIT_1_5X: 'increase_deposit_1_5X',
    INCREASE_DEPOSIT_2X: 'increase_deposit_2x',
    REQUIRE_CERTIFIED_PAYMENT: 'require_certified_payment',
  },

  ScreeningShape: {
    CIRCLE: 'circle',
    SQUARE: 'square',
    TRIANGLE: 'triangle',
  },

  ScreeningCriteriaResult: {
    SCREENING_NOT_COMPLETED: 'Screening not completed',
    AWAITING_SCREENING_FOR_APPLICANT: 'Awaiting screening for this applicant',
  },

  // Types of members: by default it is a tenant.
  MemberType: {
    OCCUPANT: 'Occupant',
    RESIDENT: 'Resident',
    GUARANTOR: 'Guarantor',
  },

  GuarantorLevel: {
    RESIDENT: 'resident',
    PARTY: 'party',
  },

  AmenityTargetType: {
    BUILDING: 'Building',
    INVENTORY: 'Inventory',
    INVENTORY_GROUP: 'InventoryGroup',
    LAYOUT: 'Layout',
  },

  AmenityCategory: {
    BUILDING: 'building',
    INVENTORY: 'inventory',
    PROPERTY: 'property',
  },

  AmenitySubCategory: {
    ACCESSIBILITY: 'accessibility',
    APPLIANCES: 'appliances',
    BATH: 'bath',
    COMFORT: 'comfort',
    ELEVATION: 'elevation',
    ENVIRONMENT_FRIENDLY: 'environmentFriendly',
    ENVIRONMENT: 'environment',
    FINANCIAL: 'financial',
    FLOORING: 'flooring',
    KITCHEN: 'kitchen',
    LIFESTYLE: 'lifestyle',
    LIVING_SPACE: 'livingSpace',
    PARKING: 'parking',
    RESIDENT_EXPERIENCE: 'residentExperience',
    RESIDENT_SERVICE: 'residentService',
    SECURITY: 'security',
    STORAGE: 'storage',
    TECHNOLOGY: 'technology',
    UPGRADES: 'upgrades',
    UTILITIES_CABLE: 'utilitiesAndCable',
    VIEW: 'view',
    WINDOWS: 'windows',
  },

  // Types of Buildings
  BuildingType: {
    COMMON: 'common',
    TOWER: 'tower',
    GARDEN: 'garden',
    SINGLE_FAMILY: 'singleFamily',
    STORAGE: 'storage',
    PARKING: 'parking',
    PODIUM: 'podium',
  },

  // Inventory types
  InventoryType: {
    UNIT: 'unit',
    PARKING: 'parking',
    STORAGE: 'storage',
    SUBUNIT: 'subUnit',
    COMMON: 'common',
    APPLIANCE: 'appliance',
  },

  // Inventory Subtypes
  InventorySubtype: {
    SUBUNIT: 'Sub-Unit',
    EV: 'EV',
    MOTORCYCLE: 'Motorcycle',
  },

  // Inventory states
  InventoryState: {
    ADMIN: 'admin',
    DOWN: 'down',
    EXCLUDED: 'excluded',
    MODEL: 'model',
    OCCUPIED_NOTICE_RESERVED: 'occupiedNoticeReserved',
    OCCUPIED_NOTICE: 'occupiedNotice',
    OCCUPIED: 'occupied',
    VACANT_MAKE_READY_RESERVED: 'vacantMakeReadyReserved',
    VACANT_READY_RESERVED: 'vacantReadyReserved',
    VACANT_MAKE_READY: 'vacantMakeReady',
    VACANT_READY: 'vacantReady',
    VACANT_DOWN: 'vacantDown',
    UNAVAILABLE: 'unavailable',
  },

  // Bussines Entities Types
  BusinessEntityType: {
    OWNER: 'owner',
    OPERATOR: 'operator',
    VENDOR: 'vendor',
  },

  // Expertise of Business Entities
  BusinessEntityExpertise: {
    MAINTENANCE: 'maintenance',
    CALLCENTER: 'callCenter',
    SUPPLY: 'supply',
    SECURITY: 'security',
  },

  EconomicStatus: {
    COMMERCIAL: 'commercial',
    INDUSTRIAL: 'industrial',
    RESIDENTIAL: 'residential',
    RETAIL: 'retail',
  },

  CommunicationMessageType: {
    EMAIL: 'Email',
    SMS: 'Sms',
    CALL: 'Call',
    WEB: 'Web',
    CONTACTEVENT: 'ContactEvent',
    DIRECT_MESSAGE: 'DirectMessage',
  },

  ContactInfoType: {
    EMAIL: 'email',
    PHONE: 'phone',
  },

  CommunicationDirection: {
    IN: 'in',
    OUT: 'out',
  },

  CommunicationStatus: {
    DELIVERY: 'Delivery',
    BOUNCED: 'Bounce',
    PENDING: 'Pending',
    QUEUED: 'Queued',
    SENT: 'sent',
    UNDELIVERED: 'undelivered',
    FAILED: 'failed',
    DELIVERED: 'delivered',
    FILTERED: 'filtered',
  },
  // sms status from plivo : "queued", "sent", "delivered", "undelivered", or "failed"

  ItemType: {
    party: 'party',
    person: 'person',
    unit: 'unit',
    activityLog: 'ActivityLog',
  },

  LeasePeriod: {
    MONTH: 'month',
    WEEK: 'week',
    DAY: 'day',
    HOUR: 'hour',
  },

  LeaseState: {
    NEW: 'new',
    RENEWAL: 'renewal',
    MONTH_TO_MONTH: 'month-to-month',
  },

  FeeLeaseState: {
    NEW: 'new',
    RENEWAL: 'renewal',
  },

  LeaseStatus: {
    DRAFT: 'draft',
    SUBMITTED: 'submitted',
    VOIDED: 'voided',
    EXECUTED: 'executed',
  },

  LeaseType: {
    STANDARD: 'standard',
    CORPORATE: 'corporate',
    EMPLOYEE: 'employee',
    STUDENT: 'student',
    FAIR_MARKET: 'fairMarket',
    GOOD_SAMARITAN: 'goodSamaritan',
    SECTION8: 'section8',
  },

  LeaseSignatureStatus: {
    NOT_SENT: 'not_sent',
    SENT: 'sent',
    SIGNED: 'signed',
    WET_SIGNED: 'wet_signed',
    VOIDED: 'voided',
  },

  LeaseSignatureTypes: {
    DIGITAL: 'digital',
    WET: 'wet',
  },

  FADVCallMethod: {
    GET_SIGNER_TOKEN: 'GetSignerToken',
    GET_COUNTERSIGNER_TOKEN: 'GetCounterSignerToken',
    GET_FORMSETS_LIST: 'GetFormSetsList',
    CREATE_ENVELOPE: 'CreateEnvelope',
    IN_OFFICE: 'inOffice',
    REQUEST_DOCUMENT: 'RequestDocument',
    GET_ENVELOPE_STATUS: 'GetEnvelopeStatus',
  },

  LeaseStatusEvent: {
    COMPLETED: 'COMPLETED',
    DECLINED: 'DECLINED',
  },

  NonRecurringApplied: {
    FIRST: 'first',
    LAST: 'last',
    FIRST_FULL: 'firstFull',
  },

  NotificationCategory: {
    ALERT: 'alert',
    DIRECT_MESSAGE: 'rxpDirectMessage',
    ANNOUNCEMENT: 'announcement',
  },

  NotificationType: {
    SMS: 'sms',
    EMAIL: 'email',
    PUSH: 'push',
    VOICE: 'voice',
  },

  NotificationDeliveryFailedReason: {
    BOUNCE: 'bounce',
  },

  PostCategory: {
    ANNOUNCEMENT: 'announcement',
    EMERGENCY: 'emergency',
  },

  PostPublicDocumentContext: {
    POST_HERO_IMAGE: 'postHeroImage',
    POST_MESSAGE_IMAGE: 'postMessageImage',
  },

  LeadScore: {
    PROSPECT: 'prospect',
    BRONZE: 'bronze',
    SILVER: 'silver',
    GOLD: 'gold',
  },

  FeeType: {
    APPLICATION: 'application',
    WAIVER_APPLICATION: 'waiverApplication',
    DEPOSIT: 'deposit',
    INVENTORY_GROUP: 'inventoryGroup',
    LEASE_BREAK: 'leaseBreak',
    PENALTY: 'penalty',
    SERVICE: 'service',
    HOLD_DEPOSIT: 'holdDeposit',
  },
  FeeName: {
    PET_DEPOSIT: 'PetDeposit',
    PET_RENT: 'PetRent',
    PET_FEE: 'PetFee',
    SERVICE_ANIMAL_RENT: 'serviceAnimalRent',
    SERVICE_ANIMAL_DEPOSIT: 'serviceAnimalDeposit',
    SERVICE_ANIMAL_FEE: 'serviceAnimalFee',
  },
  QuoteSection: {
    APPLICATION: 'application',
    INVENTORY: 'inventory',
    PARKING: 'parking',
    SERVICE: 'service',
    DEPOSIT: 'deposit',
    APPLIANCE: 'appliance',
    PET: 'pet',
    PENALTY: 'penalty',
    STORAGE: 'storage',
    UTILITY: 'utility',
  },

  ServicePeriod: {
    ONE_TIME: 'oneTime',
    MONTH: 'month',
    WEEK: 'week',
    DAY: 'day',
    HOUR: 'hour',
  },
  EmploymentType: {
    PERMANENT: 'permanent',
    PART_TIME: 'partTime',
    CONTRACTOR: 'contractor',
  },
  ModuleType: {
    LEASING: 'leasing',
    RESIDENT_SERVICES: 'residentServices',
    ACCOUNTING: 'accounting',
    MAINTENANCE: 'maintenance',
    MARKETING: 'marketing',
    SECURITY: 'security',
    CALL_CENTER: 'callCenter',
    PROPERTY_MANAGER: 'propertyManager',
  },
  SourceMedium: {
    NONE: 'none',
    PRINT: 'print',
    ONLINE: 'online',
    MEDIA: 'media',
  },
  SourceType: {
    AGENT: 'Agent',
    DIRECT_MARKETING: 'Direct Marketing',
    DISPLAY_ADVERTISING: 'Display Advertising',
    EVENT: 'Event',
    ILS: 'ILS',
    PARTNER: 'Partner',
    PR: 'PR',
    PROPERTY_PHONE: 'Property Phone',
    REFERRAL: 'Referral',
    SEARCH_ORGANIC: 'Search (Organic)',
    SEARCH_PAID: 'Search (Paid)',
    SOCIAL_ORGANIC: 'Social (Organic)',
    SOCIAL_PAID: 'Social (Paid)',
    TRADITIONAL_ADVERTISING: 'Traditional Advertising',
    WEBSITE: 'Website',
    RESIDENT_SERVICES: 'Resident Services',
  },
  PartyRoutingStrategy: {
    ROUND_ROBIN: 'Round Robin',
    DISPATCHER: 'Dispatcher',
  },
  CallRoutingStrategy: {
    ROUND_ROBIN: 'Round Robin',
    OWNER: 'Owner',
    CALL_CENTER: 'Call Center',
    EVERYBODY: 'Everybody',
  },
  CallRecordingSetup: {
    INBOUND: 'INBOUND',
    OUTBOUND: 'OUTBOUND',
    INBOUND_AND_OUTBOUND: 'INBOUND_AND_OUTBOUND',
    NO_RECORDING: 'NO_RECORDING',
  },
  CallTerminationStatus: {
    MISSED: 'missed',
    VOICEMAIL: 'voicemail',
    DECLINED: 'declined',
    CLEARED: 'normal cleared',
    TRANSFERRED: 'transferred',
  },
  MissedCallReason: {
    NORMAL_QUEUE: 'normal_missed_call_queue',
    NORMAL_NO_QUEUE: 'normal_missed_call_no_queue',
    CALLBACK_REQUESTED: 'callback_requested',
    VOICEMAIL_REQUEST: 'voicemail_request',
    FALLBACK_MISSED: 'fallback_missed_at_hangup',
    QUEUE_DECLINED_BY_ALL: 'call_queue_declined_by_all_agents',
    QUEUE_TIME_EXPIRED: 'call_queue_time_expired',
    QUEUE_END_OF_DAY: 'queue_end_of_day',
    QUEUE_AGENTS_OFFLINE: 'queue_all_agents_offline',
  },
  TaskNames: {
    INTRODUCE_YOURSELF: 'INTRODUCE_YOURSELF',
    CALL_BACK: 'CALL_BACK',
    FOLLOWUP_PARTY: 'FOLLOWUP_PARTY',
    COMPLETE_CONTACT_INFO: 'COMPLETE_CONTACT_INFO',
    REVIEW_APPLICATION: 'REVIEW_APPLICATION',
    PROMOTE_APPLICATION: 'PROMOTE_APPLICATION',
    APPOINTMENT: 'APPOINTMENT',
    COUNTERSIGN_LEASE: 'COUNTERSIGN_LEASE',
    NOTIFY_CONDITIONAL_APPROVAL: 'NOTIFY_CONDITIONAL_APPROVAL',
    SEND_CONTRACT: 'SEND_CONTRACT',
    REQUIRE_ADDITIONAL_WORK: 'REQUIRE_ADDITIONAL_WORK',
    HOLD_INVENTORY: 'HOLD_INVENTORY',
    REMOVE_ANONYMOUS_EMAIL: 'REMOVE_ANONYMOUS_EMAIL',
    SEND_RENEWAL_QUOTE: 'SEND_RENEWAL_QUOTE',
    SEND_RENEWAL_REMINDER: 'SEND_RENEWAL_REMINDER',
    SMS_CONVERSATION_FOLLOWUP: 'SMS_CONVERSATION_FOLLOWUP',
    REMINDER: 'REMINDER',
    MANUAL: 'MANUAL',
    MANUAL_REMINDER: 'MANUAL_REMINDER',
    COLLECT_SERVICE_ANIMAL_DOC: 'COLLECT_SERVICE_ANIMAL_DOC',
    COLLECT_EMERGENCY_CONTACT: 'COLLECT_EMERGENCY_CONTACT',
    CONTACT_PARTY_DECLINE_DECISION: 'CONTACT_PARTY_DECLINE_DECISION',
    PRINT_DECLINE_LETTER: 'PRINT_DECLINE_LETTER',
  },
  InputTypeForFollowupQuestion: {
    COUNT: 'count',
    BINARY: 'binary',
    ENUM: 'enum',
    TEXT: 'text',
    DATE: 'date',
  },
  SelfServiceAppointmentActions: {
    CANCEL: 'Cancel',
    UPDATE: 'Update',
  },
  AppointmentCreatedFrom: {
    SELF_SERVICE: 'SELF_SERVICE',
    REVA: 'REVA',
  },
  CalendarEventTypes: {
    PERSONAL: 'Personal',
    APPOINTMENT: 'Appointment',
    TEAM: 'Team',
    ALL_AGENTS_BUSY: 'All agents busy',
  },
  TaskStates: {
    ACTIVE: 'Active',
    COMPLETED: 'Completed',
    SNOOZED: 'Snoozed',
    CANCELED: 'Canceled',
  },
  TaskCategories: {
    PARTY: 'Party',
    INACTIVE: 'Inactive',
    DRAFT: 'Draft',
    QUOTE: 'Quote',
    HIGHLIGHT: 'Highlight',
    MANUAL: 'Manual',
    APPLICATION_APPROVAL: 'Application approval',
    CONTRACT_SIGNING: 'Contract signing',
    APPOINTMENT: 'Appointment',
    REQUIRE_WORK: 'Require work',
    FUTURE_RESIDENT: 'Future resident',
    MANUAL_REMINDER: 'Manual reminder',
  },
  TaskClosingType: {
    AUTO_CLOSING: 'Auto closing',
    MANUAL_CLOSING: 'Manual closing',
  },
  AppointmentResults: {
    COMPLETE: 'COMPLETE',
    RESCHEDULED: 'RESCHEDULED',
    CANCELLED: 'CANCELLED',
    NO_SHOW: 'NO_SHOW',
  },
  Jobs: {
    ImportDataFiles: 'ImportDataFiles',
    ExportDatabase: 'ExportDatabase',
    MigrateDataFiles: 'MigrateDataFiles',
    ImportUpdateDataFiles: 'ImportUpdateDataFiles',
    ImportRmsFiles: 'ImportRmsFiles',
    ExportOneToManys: 'ExportOneToManys',
    TasksFollowupParty: 'TasksFollowupParty',
    ScreeningResponseValidation: 'ScreeningResponseValidation',
    CheckForOrphanScreeningRequests: 'CheckForOrphanScreeningRequests',
    LongRunningScreeningRequests: 'LongRunningScreeningRequests',
    FetchAndStoreTransactions: 'FetchAndStoreTransactions',
    FetchLeasesStatus: 'FetchLeasesStatus',
    MarkEveryoneUnavailable: 'MarkEveryoneUnavailable',
    CallQueueEndOfDay: 'CallQueueEndOfDay',
    UpdatePostMonth: 'UpdatePostMonth',
    CheckIncomingFiles: 'CheckIncomingFiles',
    SyncExternalCalendarEvents: 'SyncExternalCalendarEvents',
    ExportToYardi: 'ExportToYardi',
    MonitorDatabase: 'MonitorDatabase',
    UploadVoiceMessages: 'UploadVoiceMessages',
    ScreeningMonitor: 'ScreeningMonitor',
    CleanupTestingTenants: 'CleanupTestingTenants',
    DetachProgramPhoneNumbers: 'DetachProgramPhoneNumbers',
    CleanupPhysicalAssets: 'CleanupPhysicalAssets',
    VacatePartyMembers: 'VacatePartyMembers',
    PartyDocumentsMonitor: 'PartyDocumentsMonitor',
    CommsMonitor: 'CommsMonitor',
    ImportAndProcessPartyWorkflows: 'ImportAndProcessPartyWorkflows',
    CleanupOldRecordsFromBigTables: 'CleanupOldRecordsFromBigTables',
    MRIExportMonitor: 'MRIExportMonitor',
    ImportCohortFiles: 'ImportCohortFiles',
    AssignActiveLeaseToRSTeams: 'AssignActiveLeaseToRSTeams',
    ArchivePartiesFromSoldProperties: 'ArchivePartiesFromSoldProperties',
    SyncBMLeaseSignatures: 'SyncBMLeaseSignatures',
    ApplicationDeclinedHandler: 'ApplicationDeclinedHandler',
  },
  JobCategory: {
    MigrateData: 'MigrateData',
    ExportData: 'ExportData',
    ExportDatabase: 'ExportDatabase',
    Recurring: 'Recurring',
    CohortComms: 'CohortComms',
  },
  ImportDataFilesSteps: {
    ImportInventory: 'ImportInventory',
    ImportAssets: 'ImportAssets',
    ImportVoiceMessages: 'ImportVoiceMessages',
  },
  ExportDataSteps: {
    ExportDatabase: 'ExportDatabase',
  },
  MigrateDataFilesSteps: {
    YardiMigration: 'YardiMigration',
  },
  ImportUpdateDataFilesSteps: {
    ImportUpdates: 'ImportUpdates',
    CloseImportedParties: 'CloseImportedParties',
    ArchivePartiesFromSoldProperties: 'ArchivePartiesFromSoldProperties',
  },
  ImportCohortFileSteps: {
    IMPORT_COHORT: 'ImportCohort',
  },
  ImportRmsFilesSteps: {
    RmsUpdates: 'RmsUpdates',
  },
  ImportAndProcessPartyWorkflowsSteps: {
    ImportResidentData: 'ImportResidentData',
    ProcessWorkflows: 'ProcessWorkflows',
  },

  PostRecipientStatus: {
    SENT: 'sent',
    NOT_SENT: 'not sent',
  },

  JobStatus: {
    IDLE: 'Idle',
    PENDING: 'Pending',
    IN_PROGRESS: 'In Progress',
    PROCESSED: 'Processed',
    FAILED: 'Failed',
    SKIPPED: 'Skipped',
  },
  JobProperties: {
    STATUS: 'status',
    PROGRESS: 'progress',
    RESULT: 'result',
    ERRORS: 'errors',
  },
  AssetType: {
    EMPLOYEE: 'Employee',
    AVATAR: 'Avatar',
    PROPERTY: 'Property',
    PROPERTY_MARKETING: 'Property Marketing',
    AMENITY: 'Amenity',
    MARKETING_LAYOUT: 'Marketing Layout',
    MARKETING_LAYOUT_GROUP: 'Marketing Layout Group',
    LAYOUT: 'Layout',
    BUILDING: 'Building',
    INVENTORY: 'Inventory',
    INVENTORY_GROUP: 'Inventory Group',
    LIFESTYLE: 'Lifestyle',
    GLOBAL_ASSET: 'Global Asset',
    PROPERTY_ASSET: 'Property Asset',
  },
  MarketingAssetType: {
    THREE_D: '3D',
    VIDEO: 'video',
  },
  DocumentAccessType: {
    PRIVATE: 'private',
    PUBLIC: 'public',
  },
  VisibleElements: {
    BOLD: 'bold',
    ATTACHMENT: 'attachment',
    SUBJECT: 'subject',
  },
  TemplateNames: {
    QUOTE: 'quote',
    DECLINED_APPLICATION: 'declined_application',
  },
  QualificationQuestions: {
    MoveInTime: {
      NEXT_4_WEEKS: 'NEXT_4_WEEKS',
      NEXT_2_MONTHS: 'NEXT_2_MONTHS',
      NEXT_4_MONTHS: 'NEXT_4_MONTHS',
      BEYOND_4_MONTHS: 'BEYOND_4_MONTHS',
      I_DONT_KNOW: 'I_DONT_KNOW',
    },
    GroupProfile: {
      FAIR_MARKET: 'FAIR_MARKET',
      STUDENTS: 'STUDENTS',
      CORPORATE: 'CORPORATE',
      EMPLOYEE: 'EMPLOYEE',
      SECTION8: 'SECTION8',
      GOOD_SAMARITAN: 'GOOD_SAMARITAN',
      NOT_YET_DETERMINED: 'NOT_YET_DETERMINED',
    },
    SufficientIncome: {
      YES: 'YES',
      NO: 'NO',
      UNKNOWN: 'UNKNOWN',
    },
    BedroomOptions: {
      STUDIO: 0,
      ONE_BED: 1,
      TWO_BEDS: 2,
      THREE_BEDS: 3,
      FOUR_PLUS_BEDS: 4,
    },
  },
  ArchivePartyReasons: {
    MERGED_WITH_ANOTHER_PARTY: 'ARCHIVE_PARTY_REASON_MERGED_WITH_ANOTHER_PARTY',
    RESIDENT_CREATED: 'ARCHIVE_PARTY_REASON_RESIDENT_CREATED',
    WITHOUT_EXT_ID_AFTER_MRI_SYNC: 'ARCHIVE_PARTY_REASON_WITHOUT_EXT_ID_AFTER_MRI_SYNC',
    RENEWAL_LEASE_STARTED: 'ARCHIVE_PARTY_REASON_RENEWAL_LEASE_STARTED',
    RESIDENTS_HAVE_MOVED_OUT: 'ARCHIVE_PARTY_REASON_RESIDENTS_HAVE_MOVED_OUT',
    RESIDENTS_HAVE_MOVED_OUT_IDENTIFIED_BY_EXT_ID: 'RESIDENTS_HAVE_MOVED_OUT_IDENTIFIED_BY_EXT_ID',
    IN_FLIGHT_RENEWAL_V1_WITH_NO_RELATED_ACTIVE_LEASE: 'IN_FLIGHT_RENEWAL_V1_WITH_NO_RELATED_ACTIVE_LEASE',
    CURRENT_LEASE_IN_PAST_AND_NO_PUBLISH_QUOTE_ON_RENEWAL: 'ARCHIVE_PARTY_REASON_CURRENT_LEASE_IN_PAST_AND_NO_PUBLISH_QUOTE_ON_RENEWAL',
    CURRENT_LEASE_IN_PAST_AND_NO_ONE_MONTH_LEASE_TERM: 'ARCHIVE_PARTY_REASON_CURRENT_LEASE_IN_PAST_AND_NO_ONE_MONTH_LEASE_TERM',
    CREATED_ONE_MONTH_LEASE: 'ARCHIVE_PARTY_REASON_CREATED_ONE_MONTH_LEASE',
    CORRESPONDING_LEASE_DOCUMENT_WAS_VOIDED: 'ARCHIVE_PARTY_REASON_CORRESPONDING_LEASE_DOCUMENT_WAS_VOIDED',
    SEED_WORKFLOW_CLOSED: 'ARCHIVE_PARTY_REASON_SEED_WORKFLOW_CLOSED',
    REVA_TESTING: 'ARCHIVE_PARTY_REASON_REVA_TESTING',
    EVICTION: 'ARCHIVE_PARTY_REASON_EVICTION',
    ABANDON: 'ARCHIVE_PARTY_REASON_ABANDON',
    INTEGRATION_ISSUES: 'ARCHIVE_PARTY_REASON_INTEGRATION_ISSUES',
    PROPERTY_SOLD: 'ARCHIVE_PARTY_REASON_PROPERTY_SOLD',
    DUPLICATE_RENEWAL_V1: 'ARCHIVED_PARTY_REASON_DUPLICATE_RENEWAL_V1',
    RENEWAL_V1_WITHOUT_HISTORICAL_LEASE: 'ARCHIVED_PARTY_REASON_RENEWAL_V1_WITHOUT_HISTORICAL_LEASE',
    NEW_RESIDENT_CREATED_FOR_UNIT_SYNC_NOT_ENABLED: 'ARCHIVE_PARTY_REASON_NEW_RESIDENT_CREATED_FOR_UNIT_SYNC_NOT_ENABLED',
    RESIDENTS_TRANSFERRED: 'ARCHIVE_PARTY_REASON_RESIDENTS_TRANSFERRED_TO_ANOTHER_UNIT',
    WITHOUT_EXT_ID_AFTER_INITIAL_YARDI_SYNC: 'ARCHIVE_PARTY_REASON_WITHOUT_EXT_ID_AFTER_INITIAL_YARDI_SYNC',
    PRIMARY_EXTERNAL_ID_NOT_RECEIVED_ON_SYNC: 'ARCHIVE_PARTY_REASON_PRIMARY_EXTERNAL_ID_NOT_RECEIVED_ON_SYNC',
    PROPERTY_OFFBOARDED: 'ARCHIVE_PARTY_REASON_PROPERTY_OFFBOARDED',
    MOVEIN_NOT_CONFIRMED: 'MOVEIN_NOT_CONFIRMED',
    LEASE_EXECUTED_OUTSIDE_OF_REVA: 'ARCHIVE_PARTY_REASON_LEASE_EXECUTED_OUTSIDE_OF_REVA',
  },
  ClosePartyReasons: {
    REVA_TESTING: 'CLOSE_PARTY_REASON_REVA_TESTING',
    FOUND_ANOTHER_PLACE: 'CLOSE_PARTY_REASON_FOUND_ANOTHER_PLACE',
    NO_LONGER_MOVING: 'CLOSE_PARTY_REASON_NO_LONGER_MOVING',
    NOT_INTERESTED: 'CLOSE_PARTY_REASON_NOT_INTERESTED',
    NO_INVENTORY_MATCH: 'CLOSE_PARTY_REASON_NO_INVENTORY_MATCH',
    CANT_AFFORD: 'CLOSE_PARTY_REASON_CANT_AFFORD',
    NO_RESPONSE: 'CLOSE_PARTY_REASON_NO_RESPONSE',
    INITIAL_HANGUP: 'CLOSE_PARTY_REASON_INITIAL_HANGUP',
    ALREADY_A_RESIDENT: 'CLOSE_PARTY_REASON_ALREADY_A_RESIDENT',
    NOT_LEASING_BUSINESS: 'CLOSE_PARTY_REASON_NOT_LEASING_BUSINESS',
    MARKED_AS_SPAM: 'CLOSE_PARTY_REASON_MARKED_AS_SPAM',
    NO_MEMBERS: 'CLOSE_PARTY_REASON_NO_MEMBERS',
    CLOSED_DURING_IMPORT: 'CLOSE_PARTY_REASON_CLOSED_DURING_IMPORT',
    BLOCKED_CONTACT: 'CLOSE_PARTY_REASON_BLOCKED_CONTACT',
    APPLICATION_DECLINED: 'CLOSE_PARTY_REASON_APPLICATION_DECLINED',
    EVICTION: 'CLOSE_PARTY_REASON_EVICTION',
    ABANDON: 'CLOSE_PARTY_REASON_ABANDON',
    INTEGRATION_ISSUES: 'CLOSE_PARTY_REASON_INTEGRATION_ISSUES',
    PROPERTY_SOLD: 'CLOSE_PARTY_REASON_PROPERTY_SOLD',
    MERGED_WITH_ANOTHER_PARTY: 'CLOSE_PARTY_REASON_MERGED_WITH_ANOTHER_PARTY',
    MID_LEASE_SCREENING: 'CLOSE_PARTY_REASON_MID_LEASE_SCREENING',
  },
  DocumentCategories: {
    INCOME_SOURCES: 'Income Sources',
    ADDRESS_HISTORY: 'Address History',
    DOCUMENTS: 'Documents',
  },
  ContactEventTypes: {
    WALKIN: 'Walk-in',
    EMAIL: 'Email',
    PHONE: 'Phone',
    OTHER: 'Other',
    CALL: 'Call',
    SMS: 'SMS',
    WEB: 'Web',
    CHAT: 'Chat',
    SELFBOOK: 'Self-book',
  },
  PartyCreationTypes: {
    USER: 'user',
    SYSTEM: 'system',
    IMPORT: 'import',
  },
  PaymentMethods: {
    MONEY_ORDER: 'Money Order',
    DIRECT_DEPOSIT: 'Direct Deposit',
    CREDIT_CARD: 'Credit/Debit Card',
  },
  PaymentTransactionType: {
    PAYMENT: 'payment',
    DECLINE: 'decline',
    VOID: 'void',
    REFUND: 'refund',
    REVERSAL: 'reversal',
    WAIVER: 'waiverFee',
  },
  RecurringJobs: {
    FETCH_TRANSACTION: 'Fetch_Transaction',
  },
  PromotionStatus: {
    PENDING_APPROVAL: 'pending_approval',
    CANCELED: 'canceled',
    APPROVED: 'approved',
    REQUIRES_WORK: 'requires_work',
  },
  PaymentProviderMode: {
    FAKE: 'FAKE',
    REAL_TEST: 'REAL_TEST',
    REAL_PROD: 'REAL_PROD',
  },
  ScreeningProviderMode: {
    FAKE: 'FAKE',
    FADV_TEST: 'FADV_TEST',
    FADV_CT: 'FADV_CT',
    FADV_UAT: 'FADV_UAT',
    FADV_PROD: 'FADV_PROD',
  },
  LeasingProviderMode: {
    FAKE: 'FAKE',
    FADV_TEST: 'FADV_TEST',
    FADV_CT: 'FADV_CT',
    FADV_UAT: 'FADV_UAT',
    FADV_PROD: 'FADV_PROD',
    BLUEMOON_TEST: 'BLUEMOON_TEST',
    BLUEMOON_PROD: 'BLUEMOON_PROD',
  },
  DecisionServiceDispatcherMode: {
    FAKE: 'FAKE',
    CORTICON: 'CORTICON',
  },
  BackendMode: {
    NONE: 'NONE',
    YARDI: 'YARDI',
    MRI: 'MRI',
    MRI_NO_EXPORT: 'MRI_NO_EXPORT',
  },
  AvailabilityDateSourceType: {
    REVA: false,
    EXTERNAL: true,
  },
  UserStatus: {
    AVAILABLE: 'Available',
    NOT_AVAILABLE: 'Not Available',
    BUSY: 'Busy',
    AWAY: 'Away',
  },
  CommunicationCategory: {
    USER_COMMUNICATION: 'User communication',
    APPOINTMENT: 'Appointment',
    LEASE: 'Lease',
    QUOTE: 'Quote',
    APPLICATION_INVITE: 'Quote from application for guarantor or resident',
    APPLICATION_DECLINED: 'Application declined',
    RESET_PASSWORD: 'Reset password',
    PERSON_ACCOUNT_REGISTRATION: 'Person account registration',
    AGENT_ACCOUNT_REGISTRATION: 'Agent account registration',
    FADV_REPORT_REQUEST: 'FADV report request',
    APPLICANT_REPORT_REQUEST: 'Applicant report request',
    ILS: 'ILS',
    HISTORICAL_IMPORT: 'Historical import',
    APPLICATION_COMPLETE_REGISTRATION: 'Application complete registration',
    WEB_QUOTE: 'Webinquiry Quote',
    WEB_APPLICATION: 'Webinquiry Application',
    WEB_APPOINTMENT: 'Webinquiry Appointment',
    WEB_CONTACT: 'Webinquiry Contact',
    WEB_CANCEL_APPOINTMENT: 'Webinquiry cancel appointment',
    WEB_DECLINE_APPOINTMENT: 'Webinquiry decline appointment',
    RESIDENT_INVITE: 'Resident invite',
  },
  WeekDays: {
    MONDAY: 'Monday',
    TUESDAY: 'Tuesday',
    WEDNESDAY: 'Wednesday',
    THURSDAY: 'Thursday',
    FRIDAY: 'Friday',
    SATURDAY: 'Saturday',
    SUNDAY: 'Sunday',
  },

  InventorySelectorCases: {
    SCHEDULE_APPOINTMENT: 'schedule_appointment',
    INVENTORY_SELECTION: 'inventory_selection',
  },

  ExportTypes: {
    RES_TENANTS: 'ResTenants',
    RES_PROSPECTS: 'ResProspects',
    RES_ROOMMATES: 'ResRoommates',
    FIN_CHARGES: 'FinCharges',
    RES_LEASE_CHARGES: 'ResLeaseCharges',
    FIN_RECEIPTS: 'FinReceipts',
  },

  MriExportTypes: {
    GUEST_CARD: 'GuestCard',
    CO_OCCUPANTS: 'CoOccupants',
    REMOVE_CORESIDENT: 'RemoveCoresident',
    RESIDENTIAL_INTERACTIONS: 'ResidentialInteractions',
    APPLICATION_PAYMENT: 'ApplicationPayment',
    APPLICATION_DEPOSIT_PAYMENT: 'ApplicationDepositPayment',
    PET_INFORMATION: 'PetInformation',
    VEHICLE_INFORMATION: 'VehicleInformation',
    SELECT_UNIT: 'SelectUnit',
    RENT_DETAILS: 'RentDetails',
    RENTABLE_ITEMS_AND_FEES: 'RentableItemsAndFees',
    ACCEPT_LEASE: 'AcceptLease',
    CONFIRM_LEASE: 'ConfirmLease',
    ASSIGN_ITEMS: 'AssignItems',
    VOID_LEASE: 'VoidLease',
    RENEWAL_OFFER: 'RenewalOffer',
    CANCEL_RENEWAL_OFFER: 'CancelRenewalOffer',
    CLEAR_SELECTED_UNIT: 'ClearSelectedUnit',
  },

  MriExportAction: {
    FIRST_APPOINTMENT_COMPLETED: 'first appointment completed',
    APPLICATION_PAYMENT: 'application payment',
    HOLD_INVENTORY: 'hold inventory',
    RELEASE_INVENTORY: 'release inventory',
    SIGN_LEASE: 'signed lease',
    VOID_LEASE: 'void lease',
    EDIT_LEASE: 'edit lease',
  },

  PartyTypes: {
    TRADITIONAL: 'traditional',
    CORPORATE: 'corporate',
  },

  MergePartyContext: {
    PERSON: 'person',
    PARTY: 'party',
    PROPERTY_CHANGE: 'propertyChange',
  },

  MergePartyResponse: {
    NONE: 'none',
    MERGE: 'merge',
    DONT_MERGE: 'dont merge',
  },

  StrongMatchStatus: {
    NONE: 'none',
    CONFIRMED: 'confirmed',
    DISMISSED: 'dismissed',
  },

  PersonMatchType: {
    WEAK: 'weak',
    STRONG: 'strong',
  },
  InventoryOnHoldReason: {
    LEASE: 'lease',
    MANUAL: 'manual',
    AUTOMATIC: 'automatic',
  },

  CallerRequestedAction: {
    CALL_BACK: 'call back',
    VOICEMAIL: 'voicemail',
    TRANSFER_TO_NUMBER: 'transfer to number',
  },

  VoiceMenuAction: {
    REQUEST_CALLBACK: 'request callback',
    TRANSFER_TO_VOICEMAIL: 'transfer to voicemail',
    TRANSFER_TO_PHONE_NUMBER: 'transfer to phone number',
  },

  VoiceMessageType: {
    AFTER_HOURS: 'afterHours',
    VOICEMAIL: 'voicemail',
    UNAVAILABLE: 'unavailable',
    CALL_BACK_REQUEST_ACK: 'callBackRequestAck',
    CALL_QUEUE_WELCOME: 'callQueueWelcome',
    CALL_QUEUE_UNAVAILABLE: 'callQueueUnavailable',
    CALL_QUEUE_CLOSING: 'callQueueClosing',
    RECORDING_NOTICE: 'callRecordingNotice',
  },

  HoldReasonTypes: {
    MANUAL: 'MANUAL',
    INTERNATIONAL: 'INTERNATIONAL',
    RESIDENT_GUARANTOR_LINK: 'RESIDENT_GUARANTOR_LINK',
  },

  NavigationHistoryType: {
    PERSON: 'Person',
    PARTY: 'Party',
    UNIT: 'Inventory',
  },
  IncomePolicyRoommates: {
    INDIVIDUAL: 'Individual',
    COMBINED: 'Combined',
  },
  IncomePolicyGuarantors: {
    INDIVIDUAL: 'Individual',
    PRORATED_POOL: 'Prorated Pool',
  },

  NotificationChannel: {
    PARTY_UPDATED: 'party_updated',
  },

  PartyDocumentStatus: {
    PENDING: 'Pending',
    SENDING: 'Sending',
    SENT: 'Sent',
    FAILED: 'Failed',
    NO_MATCHING_SUBSCRIPTIONS: 'NoMatchingSubscriptions',
  },

  PartyAggregationState: {
    PENDING: 'Pending',
    STARTED: 'Started',
    COMPLETED: 'Completed',
  },

  PartyEventType: {
    PARTY_CREATED: 'party_created',
    PARTY_UPDATED: 'party_updated',
    PARTY_CLOSED: 'party_closed',
    PARTY_REOPENED: 'party_reopened',
    PARTY_MERGED: 'party_merged',
    PARTY_REASSIGNED_PROPERTY: 'party_reassigned_property',
    PARTY_MEMBER_ADDED: 'party_member_added',
    PARTY_MEMBER_UPDATED: 'party_member_updated',
    PARTY_MEMBER_LINKED: 'party_member_linked',
    PARTY_MEMBER_TYPE_UPDATED: 'party_member_type_updated',
    PARTY_MEMBER_REMOVED: 'party_member_removed',
    PARTY_STATE_CHANGED: 'party_state_changed',
    PARTY_OWNER_CHANGED: 'party_owner_changed',
    PARTY_SCORE_CHANGED: 'party_score_changed',
    PARTY_TEAM_REASSIGNED: 'party_team_reassigned',
    APPOINTMENT_CREATED: 'appointment_created',
    APPOINTMENT_COMPLETED: 'appointment_completed',
    APPOINTMENT_CANCELED: 'appointment_canceled',
    APPOINTMENT_UPDATED: 'appointment_updated',
    QUOTE_CREATED: 'quote_created',
    QUOTE_PUBLISHED: 'quote_published',
    APPLICATION_STATUS_UPDATED: 'application_status_updated',
    APPLICATION_TRANSACTION_UPDATED: 'application_transaction_updated',
    APPLICATION_PAYMENT_PROCESSED: 'application_payment_processed',
    LEASE_CREATED: 'lease_created',
    LEASE_VERSION_CREATED: 'lease_version_created',
    LEASE_PUBLISHED: 'lease_published',
    LEASE_VOIDED: 'lease_voided',
    LEASE_SIGNED: 'lease_signed',
    LEASE_COUNTERSIGNED: 'lease_countersigned',
    LEASE_EXECUTED: 'lease_executed',
    LEASE_SENT: 'lease_sent',
    LEASE_RENEWAL_CREATED: 'lease_renewal_created',
    LEASE_RENEWAL_MOVING_OUT: 'lease_renewal_moving_out',
    LEASE_RENEWAL_CANCEL_MOVE_OUT: 'lease_renewal_cancel_move_out',
    CONTACT_INFO_ADDED: 'contact_info_added',
    CONTACT_INFO_REMOVED: 'contact_info_removed',
    PERSON_UPDATED: 'person_updated',
    COMMUNICATION_SENT: 'communication_sent',
    COMMUNICATION_RECEIVED: 'communication_received',
    COMMUNICATION_ADDED: 'communication_added',
    COMMUNICATION_MISSED_CALL: 'communication_missed_call',
    COMMUNICATION_ANSWERED_CALL: 'communication_answered_call',
    COMMUNICATION_CALL_BACK_REQUESTED: 'communication_call_back_requested',
    COMMUNICATION_COMPLETED: 'communication_completed',
    PAYMENT_RECEIVED: 'payment_received',
    TASK_ADDED: 'task_added',
    TASK_UPDATED: 'task_updated',
    APPLICANT_REPORT_STATUS_UPDATED: 'applicant_report_status_updated',
    QUOTE_SENT: 'quote_sent',
    QUOTE_PRINTED: 'quote_printed',
    PERSON_TO_PERSON_APPLICATION_INVITE: 'person_application_invite',
    PERSONS_MERGED: 'persons_merged',
    SCREENING_RESPONSE_PROCESSED: 'screening_response_processed',
    QUOTE_PROMOTION_UPDATED: 'quote_promotion_updated',
    PERSONS_APPLICATION_MERGED: 'persons_application_merged',
    ALL_PARTY_MEMBERS_SIGNED: 'all_party_members_signed',
    DEMOTE_APPLICATION: 'demote_application',
    PARTY_ARCHIVED: 'party_archived',
    CUSTOM_MESSAGE: 'custom_message',
    UNIT_HELD: 'unit_held',
    UNIT_RELEASED: 'unit_released',
    SERVICE_ANIMAL_ADDED: 'service_animal_added',
    ALL_SERVICE_ANIMALS_REMOVED: 'all_service_animals_removed',
  },

  ApplicantErrors: {
    APPLICANT_NOT_FOUND: 'APPLICANT_NOT_FOUND',
    INACTIVE_PROPERTY: 'INACTIVE_PROPERTY',
    PARTY_MEMBER_MERGED: 'PARTY_MEMBER_MERGED',
    PARTY_MEMBER_REMOVED: 'PARTY_MEMBER_REMOVED',
    PARTY_CLOSED: 'PARTY_CLOSED',
  },

  ManageMembersActions: {
    REMOVE_MEMBER: 'remove_member',
    ADD_MEMBER: 'add_member',
    REMOVE_LINK: 'remove_link',
    LINK: 'link',
  },

  ComplimentaryItemType: {
    PARKING: 'Parking',
    GARAGE: 'Garage',
    UNDERGROUND: 'Underground',
    DETACHED_PARKING: 'Detached parking',
    UNDERGROUND_PARKING: 'Underground parking',
    GARAGE_PARKING: 'Garage parking',
  },
  PriceFloorCeiling: {
    FLOOR: 'floor',
    CEILING: 'ceiling',
  },
  AdjustmentFloorCeiling: {
    FLOOR: 'floor',
    CEILING: 'ceiling',
  },
  CreatedByType: {
    USER: 'USER',
    SYSTEM: 'SYSTEM',
    SELF_SERVICE: 'SELF_SERVICE',
    GUEST: 'GUEST',
  },
  AppSettingsCategory: {
    EMAIL: 'Email',
    TASK: 'Task',
    SMS: 'SMS',
  },
  AppSettingsDataType: {
    TEXT: 'Text',
    BOOL: 'Bool',
    NUMBER: 'Number',
    DATE: 'Date',
  },
  ContractEmailTemplateSettings: {
    ContractSent: 'ContractSentEmailTemplate',
    ContractVoided: 'ContractVoidedEmailTemplate',
    ContractExecuted: 'ContractExecutedEmailTemplate',
  },
  PersonApplicationInviteEmailTemplateSettings: {
    ResidentToGuarantorApplicationInvite: 'ResidentToGuarantorQuoteTemplate',
    ResidentToResidentApplicationInvite: 'ResidentToResidetQuoteTemplate',
    OccupantToResidentApplicationInvite: 'OccupantToResidentQuoteTemplate',
  },
  QuoteEmailTemplateSettings: {
    Quote: 'QuoteSentEmailTemplate',
    RenewalLetter: 'RenewalLetterEmailTemplate',
  },
  Screening: {
    CriminalValues: {
      REPORT: 'report',
      DECLINED: 'declined',
      NOT_APPLICABLE: 'notApplicable',
    },
    CreditValues: {
      NOT_APPLICABLE: 'notApplicable',
      GUARANTOR_REQUIRED: 'guarantorRequired',
      INCREASED_DEPOSIT_REQUIRED: 'increasedDepositRequired',
      INCREASED_DEPOSIT_OR_GUARANTOR_REQUIRED: 'increasedDepositOrGuarantorRequired',
      DECLINED: 'declined',
    },
    CreditScoreApproved: {
      APPROVED: 'approved',
      NOT_APPLICABLE: 'notApplicable',
    },
    CreditScoreDeclined: {
      DECLINED: 'declined',
      NOT_APPLICABLE: 'notApplicable',
    },
    SsnValues: {
      SSN_REVIEW_REQUIRED: 'ssnReviewRequired',
      NOT_APPLICABLE: 'notApplicable',
    },
  },

  TokenType: {
    RESET_PASSWORD: 'resetPassword',
    DOMAIN: 'domain',
  },

  WorkflowName: {
    NEW_LEASE: 'newLease',
    ACTIVE_LEASE: 'activeLease',
    RENEWAL: 'renewal',
  },
  WorkflowState: {
    ACTIVE: 'active',
    ARCHIVED: 'archived',
    CLOSED: 'closed',
  },
  SandboxJobStatus: {
    COMPLETED: 'completed',
    STARTED: 'started',
    IN_PROGRESS: 'in_progress',
  },
  ResidentImportStatus: {
    PENDING: 'pending',
    PROCESSED: 'processed',
    FAILED: 'failed',
    SKIPPED: 'skipped',
  },
  AdditionalPartyMemberType: {
    CHILD: 'child',
    PET: 'pet',
  },

  ExternalMemberType: {
    OCCUPANT: 'Occupant',
    RESIDENT: 'Resident',
    GUARANTOR: 'Guarantor',
    CHILD: 'Child',
  },

  ActiveLeaseState: {
    NONE: 'none',
    MOVING_OUT: 'movingOut',
  },
  MovingOutInitiator: {
    PROPERTY: 'property',
    RESIDENT: 'resident',
  },
  RolloverPeriod: {
    NONE: 'none',
    M2M: 'm2m',
  },
  V1RenewalState: {
    UNUSED: 'unused', // 'V1 in flight renewal set aside for later use'
    RESIDENT_OR_FUTURE_RESIDENT: 'residentOrFutureResident', // 'V1 in future resident or resident state'
    FIRST_PARTY_IS_RENEWAL: 'firstPartyIsRenewal', // 'Renewal V1 as first party created in reva'
    MIGRATED_TO_V2: 'migratedToV2', // 'V1 renewal migrated to V2'
    ARCHIVED_AS_DUPLICATE: 'archivedAsDuplicate', // 'Renewal V1 archived as duplicate'
  },
  DatabaseType: {
    OPERATIONAL: 'Operational',
    ANALYTICS: 'Analytics',
  },
  CreditAssessmentTypes: {
    HAS_CREDIT: 'hasCredit',
    THIN_FILE: 'thinFile',
    NO_FILE: 'noFile',
  },
  DelayedMessageStatus: {
    PENDING: 'pending',
    PROCESSED: 'processed',
    IGNORE: 'ignore',
  },
  MriResidentStatus: {
    OtherResident: 'R',
    CoResident: '*',
    Old: 'O',
    Current: 'C',
    New: 'N',
  },
  SyncEventTypes: {
    NIGHTLY_UPDATE: 'NIGHTLY_UPDATE',
    FORCE_UPDATE: 'FORCE_UPDATE',
  },
  CreateManualRenewalStatus: {
    SPAWNED: 'SPAWNED',
    NOT_SPAWNED: 'NOT_SPAWNED',
  },
  ExceptionTypes: {
    PERSON: 'person',
    MEMBER: 'member',
    PARTY: 'party',
    OTHER: 'other',
  },
  TourTypes: {
    VIRTUAL_TOUR: 'virtualTour',
    IN_PERSON_TOUR: 'inPersonTour',
    AGENTLESS_TOUR: 'agentlessTour',
    IN_PERSON_SELF_GUIDED_TOUR: 'inPersonSelfGuidedTour',
    LEASING_APPOINTMENT: 'leasingAppointment',
    IMPORTED_TOUR: 'importedTour', // not showed in the dropdown only for imported appointments
  },
  CommunicationIgnoreFields: {
    EMAIL: 'ignore-email@reva.tech',
    FULLNAME: 'ignoreFullName reva',
  },

  MRIExportQueueStatus: {
    PENDING: 'pending',
    IN_PROGRESS: 'in_progress',
    ERROR: 'error',
  },
  LeaseDocumentTemplateCategories: {
    COVER: 'cover',
    CORE: 'core',
    ADDENDUM: 'addendum',
    APPENDIX: 'appendix',
  },
  ContactInfoLastCallStatus: {
    NONE: 'none',
    OUTGOING: 'outgoing',
    INCOMING: 'incoming',
    MISSED: 'missed',
    CALLBACK_REQUESTED: 'callback_requested',
  },
  ConditionalApprovalOptions: {
    INCREASED_DEPOSIT: 'increasedDeposit',
    SURE_DEPOSIT: 'sureDeposit',
    NPS_RENT_ASSURANCE: 'npsRentAssurance',
  },
  ActivityLogSigningType: {
    WET_SIGNATURE: 'Wet signature',
    DIGITAL_SIGNATURE: 'Digital signature',
    DIGITAL_IN_OFFICE_SIGNATURE: 'Digital in-office signature',
  },
  LAAAccessLevels: {
    APPROVED_SCREENING: 'approvedScreening',
    CONDITIONAL_SCREENING: 'conditionalScreening',
    DENIED_SCREENING: 'deniedScreening',
  },
  EMPLOYMENT_TYPE: {
    SELF_EMPLOYED: 'SELF_EMPLOYED',
    NOT_PROVIDED: 'NOT_PROVIDED',
    OTHER_SOURCES: 'OTHER_SOURCES',
    NO_INCOME_SOURCE: 'NO_INCOME_SOURCE',
  },
  EXPORT_LOG_STATUS: {
    PENDING: 'pending',
    SKIPPED: 'skipped',
    EXPORTED: 'exported',
  },
  APPROVAL_CONDITIONS: {
    APPROVED_WITHOUT_REVIEW: 'Approved without review',
    APPROVED_WITH_ADDITIONAL_DEPOSIT: 'Approved with additional deposit',
    APPROVED_WITHOUT_ADDITIONAL_DEPOSIT: 'Approved without additional deposit',
    APPROVED_WITH_NPS: 'Approved with NPS rent assurance',
    APPROVED_WITH_SURE_DEPOSIT: 'Approved with sure deposit',
    OTHER: 'other',
    NONE: '',
  },
};
