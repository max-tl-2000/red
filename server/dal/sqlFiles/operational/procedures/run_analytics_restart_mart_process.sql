CREATE OR REPLACE FUNCTION public.run_analytics_restart_mart_process(tenantName character varying)
 RETURNS SETOF jsonb
 LANGUAGE plpgsql
AS $function$

  DECLARE
    instr text;
    variable record;
    sqlInstruction text;
    result jsonb;
    start_time timestamp;
    end_time timestamp;
    where_clause text;

    BEGIN
      RAISE NOTICE 'Analytics process to be run: %', 'RESTART MART';

      -- we are looping over all instructions, replace the parameters with the actual variables for the tenant and execute the instruction.
      -- in case of an exception we return the error together with the instruction it happened for
      -- as a result we return the success status together with the instruction start
      FOR instr IN
         SELECT i.instruction
         FROM analytics."md_instruction" i
            INNER JOIN analytics.md_job j ON i."jobId" = j.id
            INNER JOIN analytics."md_jobGroup" g ON j."jobGroupId" = g.id
         WHERE g."jobGroupName" = 'RESTARTMART'
         ORDER BY
            g."sequenceNumber" ASC,
            j."sequenceNumber" ASC,
            i."sequenceNumber" ASC
        LOOP
            sqlInstruction := instr;

            FOR variable IN
              SELECT name, value FROM reva_mart.analytics."md_tenantVariable" WHERE "tenantName" = tenantName
            LOOP
              SELECT replace(sqlInstruction, variable.name, variable.value) INTO sqlInstruction;
            END LOOP;

          BEGIN
            start_time := timeofday()::timestamp;
            RAISE NOTICE '------------------------------------------------------';
            RAISE NOTICE 'Attempting to execute instruction: % ', sqlInstruction;
            RAISE NOTICE 'Instruction start time: % ', start_time;

            EXECUTE sqlInstruction;

            end_time := timeofday()::timestamp;
	      		RAISE NOTICE 'Instruction execution succeeded with end time: % ', end_time;

            result := json_build_object('status', 'Success', 'startTime', start_time, 'endTime', end_time, 'duration', end_time - start_time,  'instruction', substring(sqlInstruction from 0 for 100));

            EXCEPTION
              WHEN others
              THEN result := json_build_object('status', 'Failure', 'instruction', sqlInstruction, 'error', SQLERRM || ' ' || SQLSTATE);
			        RAISE WARNING 'Error encountered: % ', SQLERRM || ' ' || SQLSTATE;
          END;

          RETURN NEXT result;
        END LOOP;
    END;
 $function$
