DROP VIEW IF EXISTS "dstStarDB"."dstStarSchema"."d_ApplicantPartyMember";
DROP VIEW IF EXISTS "dstStarDB"."dstStarSchema"."d_PrimaryPartyMember";
DROP VIEW IF EXISTS "dstStarDB"."dstStarSchema"."d_TaskDetails";
DROP VIEW IF EXISTS "dstStarDB"."dstStarSchema"."d_PartyDetails";
DROP VIEW IF EXISTS "dstStarDB"."dstStarSchema"."d_PartyMemberDetails";
DROP VIEW IF EXISTS "dstStarDB"."dstStarSchema"."d_TeamMemberDetails";
DROP VIEW IF EXISTS "dstStarDB"."dstStarSchema"."d_CallDetails";
DROP VIEW IF EXISTS "dstStarDB"."dstStarSchema"."d_InventoryDetails";
DROP VIEW IF EXISTS "dstStarDB"."dstStarSchema"."vw_d_Property";
DROP VIEW IF EXISTS "dstStarDB"."dstStarSchema"."vw_d_Person";
DROP VIEW IF EXISTS "dstStarDB"."dstStarSchema"."vw_d_User";
DROP VIEW IF EXISTS "dstStarDB"."dstStarSchema"."vw_d_TeamMember";
DROP VIEW IF EXISTS "dstStarDB"."dstStarSchema"."vw_d_InventoryPrice";
DROP TABLE IF EXISTS "dstStarDB"."dstStarSchema"."h_RmsPricingHistory";
DROP TABLE IF EXISTS "dstStarDB"."dstStarSchema"."f_PaymentsAndRefunds";
DROP TABLE IF EXISTS "dstStarDB"."dstStarSchema"."f_PartyConversion";
DROP TABLE IF EXISTS "dstStarDB"."dstStarSchema"."f_PartyCommunication";
DROP TABLE IF EXISTS "dstStarDB"."dstStarSchema"."f_CompletedTour";
DROP TABLE IF EXISTS "dstStarDB"."dstStarSchema"."f_AgentCallSummary";
DROP TABLE IF EXISTS "dstStarDB"."dstStarSchema"."f_PropertyCallSummary";
DROP TABLE IF EXISTS "dstStarDB"."dstStarSchema"."f_Sale";
DROP TABLE IF EXISTS "dstStarDB"."dstStarSchema"."b_AgentCallSummary_Party";
DROP TABLE IF EXISTS "dstStarDB"."dstStarSchema"."b_Communication_Team";
DROP TABLE IF EXISTS "dstStarDB"."dstStarSchema"."b_Communication_Person";
DROP TABLE IF EXISTS "dstStarDB"."dstStarSchema"."b_Task_Inventory";
DROP TABLE IF EXISTS "dstStarDB"."dstStarSchema"."b_Task_PartyMember";
DROP TABLE IF EXISTS "dstStarDB"."dstStarSchema"."b_Task_User";
DROP TABLE IF EXISTS "dstStarDB"."dstStarSchema"."b_Team_Property_Program";
DROP TABLE IF EXISTS "dstStarDB"."dstStarSchema"."d_Lease";
DROP TABLE IF EXISTS "dstStarDB"."dstStarSchema"."d_Call";
DROP TABLE IF EXISTS "dstStarDB"."dstStarSchema"."d_Communication";
DROP TABLE IF EXISTS "dstStarDB"."dstStarSchema"."d_Task";
DROP TABLE IF EXISTS "dstStarDB"."dstStarSchema"."d_InventoryPrice";
DROP TABLE IF EXISTS "dstStarDB"."dstStarSchema"."d_InventoryRmsPrice";
DROP TABLE IF EXISTS "dstStarDB"."dstStarSchema"."d_InventoryTerm";
DROP TABLE IF EXISTS "dstStarDB"."dstStarSchema"."d_InventoryState";
DROP TABLE IF EXISTS "dstStarDB"."dstStarSchema"."d_Inventory";
DROP TABLE IF EXISTS "dstStarDB"."dstStarSchema"."d_TeamMember";
DROP TABLE IF EXISTS "dstStarDB"."dstStarSchema"."d_Team";
DROP TABLE IF EXISTS "dstStarDB"."dstStarSchema"."d_User";
DROP TABLE IF EXISTS "dstStarDB"."dstStarSchema"."d_Program";
DROP TABLE IF EXISTS "dstStarDB"."dstStarSchema"."d_PartyMember";
DROP TABLE IF EXISTS "dstStarDB"."dstStarSchema"."d_ContactInfo";
DROP TABLE IF EXISTS "dstStarDB"."dstStarSchema"."d_Person";
DROP TABLE IF EXISTS "dstStarDB"."dstStarSchema"."d_Party";
DROP TABLE IF EXISTS "dstStarDB"."dstStarSchema"."d_Property";
DROP TABLE IF EXISTS "dstStarDB"."dstStarSchema"."d_Date";
DROP TABLE IF EXISTS "dstStarDB"."dstStarSchema"."d_Time";
DROP TABLE IF EXISTS "dstStarDB"."dstStarSchema"."d_ContactChannel";
DROP TABLE IF EXISTS "dstStarDB"."dstStarSchema"."s_LoadDependency";
DROP TABLE IF EXISTS "dstStarDB"."dstStarSchema"."s_LastLoadDate";