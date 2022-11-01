@Ignore @ScheduleAppointment_Remove @Regression @Integration @Sanity @Smoke
Feature: Remove an existing appointment
         CPM-140: As a sales agent, I want to edit or remove an appointment

Background:
  Given   A party prospect details page is opened with one appointment in it
  And     The appointment has no Units or Notes
  And     User clicked on 'appointment' drop down menu

@TODO
Scenario: CPM-584: Remove appointment - display confirmation dialog
  When    User clicks on 'REMOVE APPOINTMENT' button
  Then    'Remove appointment' dialog should be displayed

@TODO
Scenario: CPM-584: Remove appointment
  When    User clicks on 'REMOVE APPOINTMENT' button
  And     Clicks on 'REMOVE' button on 'Remove appointment' dialog
  Then    The 'prospect details' page should be displayed
  And     The 'appointment' card should not be displayed
