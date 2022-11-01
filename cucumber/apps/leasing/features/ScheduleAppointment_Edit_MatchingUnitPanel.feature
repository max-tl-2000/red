@Ignore @ScheduleAppointment_Edit @Regression @Integration @Sanity @Smoke
Feature: Edit an existing appointment from matching unit panel
         CPM-140: As a sales agent, I want to edit or remove an appointment

@TODO
Scenario: CPM-574: Edit appointment - Add unit from matching unit panel with only one appointment scheduled
  Given   A 'party prospect details' page is opened with one appointment in it
  And     The matching unit panel contained units
  When    User clicks on 'Tour' button on the first unit inside matching panel
  Then    The 'unit' chip should be displayed in the 'Units' field

@TODO
Scenario: CPM-574: Edit appointment - Add unit from matching unit panel with multiple appointments scheduled
  Given   A 'party prospect details' page is opened with one appointment in it
  And     The matching unit panel contained units
  When    User clicks on 'Tour' button on the first unit inside matching panel
  Then    The 'Select appointment' dialog should be displayed
  And     The 'Select appointment' dialog should contain the appointments
  When    User selects first appointment in 'Select appointment' dialog
  And     Clicks on 'done' button in 'Select appointment' dialog
  Then    The 'unit' chip should be displayed in the 'Units' field
