@Ignore @ScheduleAppointment_Filter @Regression @Integration @Sanity @Smoke
Feature: Filter a Schedule appointment
         CPM-140: As a sales agent, I want to schedule an appointment and view
         it in prospect details page.

Background:
  Given    The user opened a 'party prospect details' page with guest:
   | guest |
   | Foo   |
  And    The user clicked the Schedule appointment under '(+)' menu
  And     The "Add Appointment" dialog should be opened
  And     The guest 'Foo' should be in guests field by default
  And     The logged in sales agent should selected default
  And     The "calendar" should display the current day on first "calendar" column
  And     The 'Notes' field is empty
  And     The 'Units shorthand or address' field is empty

@TODO
Scenario: CPM-644: Appointment dialog - filter units with results
  When    User types three letters in 'Units shorthand or address' field with match in db
  Then    The "suggestions" window with matching units should be displayed
  And     The units in "suggestions" window should contain the input letters

@TODO
Scenario: CPM-644: Appointment dialog - filter units without result
  When    User types three letters in 'Units shorthand or address' field without match in db
  Then    The "suggestions" window with matching units should be displayed
  And     The "suggestions" window should diplay the message for match not found
