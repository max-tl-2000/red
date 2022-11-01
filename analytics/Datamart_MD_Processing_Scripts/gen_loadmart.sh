#!/bin/sh

set -e

# move into red directory
cd "$(cd "$(dirname "$0")"; pwd)"

# Usage: python md_genfromsql.py <input_sql_md_file.sql> <md_schema_name> <job_group> <job_name> <APPEND | REPLACE | DELETE>
python md_genfromsql.py ../ETL_SQL_Source/L3_load_dimensions.sql analytics LOADMART L3_LOAD_DIMENSIONS replace 80 $1
python md_genfromsql.py ../ETL_SQL_Source/L3_load_facts.sql analytics LOADMART L3_LOAD_FACTS replace 81 $1