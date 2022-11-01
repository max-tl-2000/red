@PartyPhase @Regression @Integration @Sanity @Smoke @PR
Feature: Qualification questions should be required to move to phase II
        CPM-10342 - Qualification Questions no longer have to be answered to go to party phase 2...

Background:
  Given   User logs out if needed

@Positive @Core
Scenario: Party stay in Phase I after appointment is added
  Given User logs in as "bill@reva.tech" with password "red&reva#"
  And   User creates a "New lease" party with a party member called "Snoopy Brown" with email "__randomEmail(qatest+snoopy@reva.tech)"
  And   The user schedules an appointment for tomorrow morning
  And   There is one appointment shown in the UI
  Then  The party is still in phase I
  And   User goes back to Dashboard and logs out
