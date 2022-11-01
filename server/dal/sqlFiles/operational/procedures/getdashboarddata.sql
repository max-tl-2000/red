 CREATE OR REPLACE FUNCTION db_namespace.getdashboarddata (p_startindex int, p_endindex int, p_ranks int[], p_teamids varchar(36)[], p_userids varchar(36)[], p_taskname varchar(50))
      RETURNS TABLE (c_state varchar(50), c_total INT8, c_today INT8, c_tomorrow INT8, c_allPartyIds JSON, c_groupedParties JSON)
      LANGUAGE plpgsql
      AS $function$
      BEGIN
  RETURN QUERY
  WITH unread_comms AS
  (
  select "partyId", "communicationData" as comm, "communicationCreatedAt",
          row_number() OVER (PARTITION BY "partyId" ORDER BY "communicationCreatedAt" ASC) AS "ordComms",
          row_number() OVER (PARTITION BY "partyId" ORDER BY "communicationCreatedAt" DESC) AS "ordParties"
  from db_namespace."UnreadCommunication"
  ), tasks AS
  (
    SELECT
      task."partyId",
      (CASE WHEN (task.name = p_taskname) THEN 0
              -- overdue tasks
              WHEN (date_trunc('day', (task."dueDate" at TIME ZONE COALESCE(property.timezone,team."timeZone",first_team."timeZone",'America/Los_Angeles'))) < date_trunc('day', ((NOW() - interval '1 day') at TIME ZONE COALESCE(property.timezone,team."timeZone",first_team."timeZone",'America/Los_Angeles')))) THEN 1
              -- appointments for today
              WHEN task.category = 'Appointment' AND (date_trunc('day', (task."dueDate" at TIME ZONE COALESCE(property.timezone,team."timeZone",first_team."timeZone",'America/Los_Angeles'))) <= date_trunc('day', (NOW() at TIME ZONE COALESCE(property.timezone,team."timeZone",first_team."timeZone",'America/Los_Angeles')))) THEN 2
              -- tasks for today
              WHEN (date_trunc('day', (task."dueDate" at TIME ZONE COALESCE(property.timezone,team."timeZone",first_team."timeZone",'America/Los_Angeles'))) <= date_trunc('day', (NOW() at TIME ZONE COALESCE(property.timezone,team."timeZone",first_team."timeZone",'America/Los_Angeles')))) THEN 3
              -- appointments for tomorrow
              WHEN task.category = 'Appointment' AND (date_trunc('day', (task."dueDate" at TIME ZONE COALESCE(property.timezone,team."timeZone",first_team."timeZone",'America/Los_Angeles'))) = date_trunc('day', ((NOW() + interval '1 day') at TIME ZONE COALESCE(property.timezone,team."timeZone",first_team."timeZone",'America/Los_Angeles')))) THEN 4
              -- tasks for tomorrow
              WHEN (date_trunc('day', (task."dueDate" at TIME ZONE COALESCE(property.timezone,team."timeZone",first_team."timeZone",'America/Los_Angeles'))) = date_trunc('day', ((NOW() + interval '1 day') at TIME ZONE COALESCE(property.timezone,team."timeZone",first_team."timeZone",'America/Los_Angeles')))) THEN 5
              -- tasks for later
              ELSE 6
          END) AS taskrank,
      (CASE WHEN task.category = 'Appointment' THEN 0 ELSE 1 END) AS is_appointment,
      (date_trunc('day', (task."dueDate" at TIME ZONE COALESCE(property.timezone,team."timeZone",first_team."timeZone",'America/Los_Angeles')))) AS task_due_day,
      (CASE WHEN task.category = 'Appointment' THEN (task."dueDate" at TIME ZONE COALESCE(property.timezone,team."timeZone",first_team."timeZone",'America/Los_Angeles')) ELSE ((task."dueDate" + interval '1 day') at TIME ZONE COALESCE(property.timezone,team."timeZone",first_team."timeZone",'America/Los_Angeles')) END) AS appointment_time,
      (task.created_at at TIME ZONE COALESCE(property.timezone,team."timeZone",first_team."timeZone",'America/Los_Angeles')) AS task_created_at
    FROM db_namespace."Tasks" task
      INNER JOIN db_namespace."Party" party ON task."partyId" = party.id
      LEFT JOIN db_namespace."Teams" team ON team.id = party."ownerTeam"::uuid
      LEFT JOIN db_namespace."Property" property ON property.id = party."assignedPropertyId"::uuid
      LEFT JOIN db_namespace."Teams" first_team ON first_team.id = party."teams"[0]::uuid
    WHERE
      task."userIds" && p_userids
      AND task.state <> 'Canceled' AND task.state <> 'Completed'
  ), toptasks AS
  (
    SELECT *,
      row_number() OVER (PARTITION BY "partyId" ORDER BY taskrank ASC, task_due_day ASC, is_appointment ASC, appointment_time ASC, task_created_at ASC) AS ord
    FROM tasks
  )
  SELECT
    ranked.state AS state,
    count(ranked) AS total,
    sum(CASE WHEN ranked.rank IN (0, 1, 2, 3, 4) THEN 1 ELSE 0 END) AS today,
    sum(CASE WHEN ranked.rank IN (5, 6) THEN 1 ELSE 0 END) AS tomorrow,
    json_agg(ranked.id) AS "allPartyIds",
    json_agg(row_to_json(ranked.*) ORDER BY ranked.rn ASC)
      FILTER (WHERE ranked.rn >= p_startindex
              AND ranked.rn <= p_endindex
              AND ranked.rank = ANY(p_ranks)
            ) AS "groupedParties"
  FROM (
    SELECT parties.*,
      row_number() OVER (PARTITION BY parties.state ORDER BY parties.rank, "unreadCommCreatedAt" DESC, task_due_day ASC, is_appointment ASC, appointment_time ASC, task_created_at ASC, parties.created_at DESC) AS rn
    FROM (
      SELECT
        p.id,
        CASE  WHEN (p.state = 'Resident' AND p."workflowName" = 'activeLease' AND c.comm is not null) THEN 'Lead'
              WHEN (p.state = 'Resident' AND p."workflowName" = 'activeLease' AND task.taskrank IS NOT NULL) THEN 'Prospect'
            
        ELSE p.state END AS state,
        (CASE WHEN (property.timezone IS NOT NULL) THEN property.timezone
              WHEN (team."timeZone" IS NOT NULL) THEN team."timeZone"
              WHEN (first_team."timeZone" IS NOT NULL) THEN first_team."timeZone"
              ELSE 'America/Los_Angeles'
        END) AS timezone,
        p.created_at,
        (CASE WHEN (task.taskrank = 0) THEN 0 --CALL_BACK tasks
            WHEN (c.comm is not null) THEN 1 --comms for today
            WHEN (task.taskrank = 1) THEN 2 --overdue tasks
            WHEN (task.taskrank = 2) THEN 3 --appointments for today
            WHEN (task.taskrank = 3) THEN 4 --tasks for today
            WHEN (task.taskrank = 4) THEN 5 --appointments for tomorrow
            WHEN (task.taskrank = 5) THEN 6 --tasks for tomorrow
            ELSE 7 --later
        END) AS rank,
        prg."displayName" as program,
        task.task_due_day,
        task.is_appointment,
        task.appointment_time,
        task.task_created_at,
        row_to_json(p) AS party,
        c2.comm AS communication,
        c."communicationCreatedAt" AS "unreadCommCreatedAt",
        alwf."leaseData" AS "activeLeaseWorkflowData",
        alwf."metadata" ->> 'vacateDate' AS "movingOutDate"
      FROM db_namespace."Party" p
        LEFT JOIN db_namespace."Teams" team ON team.id = p."ownerTeam"::uuid
        LEFT JOIN db_namespace."Property" property ON property.id = p."assignedPropertyId"::uuid
        LEFT JOIN db_namespace."Teams" first_team ON first_team.id = p."teams"[0]::uuid
        LEFT JOIN db_namespace."TeamPropertyProgram" tpc ON p."teamPropertyProgramId" = tpc.id
        LEFT JOIN db_namespace."Programs" prg ON tpc."programId" = prg.id
        LEFT JOIN toptasks task ON p.id = task."partyId" AND task.ord = 1
        LEFT JOIN unread_comms AS c ON p.id = c."partyId" AND c."ordParties" = 1
        LEFT JOIN unread_comms AS c2 ON p.id = c2."partyId" AND c2."ordComms" = 1
        LEFT JOIN db_namespace."ActiveLeaseWorkflowData" alwf ON
          (CASE WHEN (p."workflowName" = 'activeLease') THEN p.id
                ELSE p."seedPartyId"
                END
          ) = alwf."partyId"
      WHERE p."teams" && p_teamids
        AND (ARRAY[p."userId"::varchar(36)] <@ p_userids
            OR p."id" IN (SELECT "partyId"
                            FROM toptasks WHERE ord = 1)
            )
        AND (p."workflowState" = 'active'
             OR ((p."workflowState" = 'closed' or p."workflowState" = 'archived')
             AND c."partyId" IS NOT NULL)
          )
      ORDER BY taskrank ASC, p.created_at DESC
      ) AS parties
    ORDER BY rn
    ) AS ranked
  GROUP BY GROUPING SETS ((ranked.state));
  END;
  $function$
