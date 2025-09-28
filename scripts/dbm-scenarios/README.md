# Datadog Database Monitoring Recommendations Generator

This collection of SQL scripts creates fictional database scenarios that will trigger various Datadog Database Monitoring (DBM) recommendations for testing and demonstration purposes.

## Overview

Based on the [Datadog DBM Recommendations documentation](https://docs.datadoghq.com/database_monitoring/recommendations/), these scripts simulate real-world database performance issues that Datadog can detect and provide recommendations for.

## Supported Recommendation Types

| Recommendation Type | Description | Script File |
|---------------------|-------------|-------------|
| **Function in Filter** | Queries calling functions on filtered columns, preventing index usage | `01-function-in-filter.sql` |
| **High Impact Blocker** | Queries causing significant waiting time for blocked queries | `02-high-impact-blocker.sql` |
| **High Row Count** | Queries returning large numbers of rows in result sets | `03-high-row-count.sql` |
| **Long Running Query** | Queries with durations exceeding 30 seconds | `04-long-running-query.sql` |
| **Missing Index** | Queries performing expensive sequential scans | `05-missing-index.sql` |
| **Query Load Increase** | Queries with significant increases in total duration | `06-query-load-increase.sql` |
| **Unused Index** | Indexes not used in any execution plans recently | `07-unused-index.sql` |

## Prerequisites

- PostgreSQL database with the VibeCode WebGUI schema
- Datadog Database Monitoring enabled
- Appropriate database permissions to create indexes and insert data

## Usage

### 1. Run Individual Scenarios

Execute specific scenario files to trigger particular recommendation types:

```bash
# Function in Filter recommendations
psql -d vibecode -f scripts/dbm-scenarios/01-function-in-filter.sql

# High Impact Blocker recommendations
psql -d vibecode -f scripts/dbm-scenarios/02-high-impact-blocker.sql

# High Row Count recommendations
psql -d vibecode -f scripts/dbm-scenarios/03-high-row-count.sql

# Long Running Query recommendations
psql -d vibecode -f scripts/dbm-scenarios/04-long-running-query.sql

# Missing Index recommendations
psql -d vibecode -f scripts/dbm-scenarios/05-missing-index.sql

# Query Load Increase recommendations
psql -d vibecode -f scripts/dbm-scenarios/06-query-load-increase.sql

# Unused Index recommendations
psql -d vibecode -f scripts/dbm-scenarios/07-unused-index.sql
```

### 2. Run All Scenarios

Execute the comprehensive script to trigger all recommendation types:

```bash
psql -d vibecode -f scripts/generate-dbm-recommendations.sql
```

### 3. Monitor Results

After running the scripts, monitor your Datadog DBM dashboard to see the recommendations appear. It may take a few minutes for the recommendations to be generated.

## Scenario Details

### Function in Filter Scenarios
- Uses `LOWER()`, `UPPER()`, `SUBSTRING()`, `EXTRACT()`, `LENGTH()`, `TRIM()`, `COALESCE()`, `CASE`, and `REGEXP_REPLACE()` functions in WHERE clauses
- Prevents index usage and triggers sequential scans
- Recommendations: Remove functions from WHERE clauses or create function-based indexes

### High Impact Blocker Scenarios
- Creates long-running transactions that hold locks
- Simulates deadlock situations
- Creates blocking scenarios with multiple transactions
- Recommendations: Optimize transaction duration, use proper locking strategies

### High Row Count Scenarios
- Queries without LIMIT clauses
- Cross joins creating massive result sets
- Large aggregations without grouping limits
- Recommendations: Add LIMIT clauses, implement pagination, use proper JOIN conditions

### Long Running Query Scenarios
- Complex aggregations without proper indexing
- Cross joins creating massive computation
- Window functions over large datasets
- Recursive CTEs with deep recursion
- Recommendations: Add indexes, rewrite queries, break into smaller parts

### Missing Index Scenarios
- Queries on non-indexed columns
- Complex WHERE clauses without composite indexes
- JOIN conditions without indexes
- ORDER BY without indexes
- Recommendations: Create appropriate indexes

### Query Load Increase Scenarios
- Simulates increased query frequency
- Simulates degraded performance over time
- Simulates increasing data volume affecting performance
- Simulates concurrent load increase
- Recommendations: Investigate performance degradation causes

### Unused Index Scenarios
- Creates indexes on rarely queried columns
- Creates composite indexes that don't match query patterns
- Creates indexes on columns with low selectivity
- Creates function-based indexes that are rarely used
- Recommendations: Drop unused indexes to save space and improve write performance

## Monitoring Queries

Each scenario file includes monitoring queries to help you understand the impact:

- Check for sequential scans
- Check for missing indexes
- Check for unused indexes
- Check for long-running queries
- Check for blocking queries
- Check for query performance statistics

## Safety Considerations

⚠️ **WARNING**: These scripts modify production data and create indexes. Use with caution!

- The scripts insert test data into your database
- Some scenarios create indexes that may not be needed
- Some scenarios create long-running transactions that could block other operations
- Always test in a non-production environment first

## Cleanup

To clean up after running the scenarios:

```sql
-- Drop unused indexes created by the scenarios
DROP INDEX IF EXISTS idx_unused_email_domain;
DROP INDEX IF EXISTS idx_unused_name_length;
DROP INDEX IF EXISTS idx_unused_created_month;
DROP INDEX IF EXISTS idx_unused_user_project_status;
DROP INDEX IF EXISTS idx_unused_role;
DROP INDEX IF EXISTS idx_unused_status;
DROP INDEX IF EXISTS idx_unused_mime_type;
DROP INDEX IF EXISTS idx_unused_avatar;
DROP INDEX IF EXISTS idx_unused_description;
DROP INDEX IF EXISTS idx_unused_metadata;
DROP INDEX IF EXISTS idx_unused_upper_name;
DROP INDEX IF EXISTS idx_unused_lower_email;
DROP INDEX IF EXISTS idx_unused_trim_name;
DROP INDEX IF EXISTS idx_unused_name_email;
DROP INDEX IF EXISTS idx_unused_created_year;
DROP INDEX IF EXISTS idx_unused_name_length_email;
DROP INDEX IF EXISTS idx_unused_role_case;
DROP INDEX IF EXISTS idx_unused_name_coalesce;
DROP INDEX IF EXISTS idx_unused_avatar_coalesce;
DROP INDEX IF EXISTS idx_unused_name_nullif;
DROP INDEX IF EXISTS idx_unused_email_nullif;
DROP INDEX IF EXISTS idx_unused_email_regexp;
DROP INDEX IF EXISTS idx_unused_name_regexp;
DROP INDEX IF EXISTS idx_unused_id_squared;
DROP INDEX IF EXISTS idx_unused_name_length_squared;
DROP INDEX IF EXISTS idx_unused_created_plus_days;
DROP INDEX IF EXISTS idx_unused_created_minus_days;
DROP INDEX IF EXISTS idx_unused_name_email_concat;
DROP INDEX IF EXISTS idx_unused_role_name_concat;
DROP INDEX IF EXISTS idx_unused_active_user;
DROP INDEX IF EXISTS idx_unused_user_rank;
DROP INDEX IF EXISTS idx_unused_project_count;
DROP INDEX IF EXISTS idx_unused_avg_project_size;
DROP INDEX IF EXISTS idx_unused_metadata_keys;
DROP INDEX IF EXISTS idx_unused_metadata_values;
DROP INDEX IF EXISTS idx_unused_array_length;
DROP INDEX IF EXISTS idx_unused_id_text;
DROP INDEX IF EXISTS idx_unused_created_text;

-- Clean up test data (optional)
DELETE FROM events WHERE event_type LIKE '%test%' OR event_type LIKE '%simulation%';
DELETE FROM ai_requests WHERE request_type LIKE '%test%' OR request_type LIKE '%simulation%';
DELETE FROM projects WHERE name LIKE '%Test%' OR name LIKE '%Simulation%';
DELETE FROM system_metrics WHERE metric_name LIKE '%test%' OR metric_name LIKE '%simulation%';
```

## Troubleshooting

### Recommendations Not Appearing
- Ensure Datadog DBM is properly configured
- Check that the database agent is collecting query samples
- Wait a few minutes for recommendations to be generated
- Verify that the queries are actually being executed

### Performance Issues
- Some scenarios create long-running transactions
- Monitor database performance during execution
- Consider running scenarios during low-traffic periods
- Use connection pooling to avoid connection exhaustion

### Permission Issues
- Ensure the database user has CREATE INDEX permissions
- Ensure the database user has INSERT permissions on all tables
- Ensure the database user has SELECT permissions on system tables

## Contributing

To add new scenarios:

1. Create a new SQL file following the naming convention `XX-scenario-name.sql`
2. Include comprehensive comments explaining the scenario
3. Add monitoring queries to help understand the impact
4. Update this README with the new scenario details
5. Test the scenario to ensure it triggers the expected recommendations

## References

- [Datadog Database Monitoring Recommendations](https://docs.datadoghq.com/database_monitoring/recommendations/)
- [PostgreSQL Performance Tuning](https://www.postgresql.org/docs/current/performance-tips.html)
- [PostgreSQL Indexing Best Practices](https://www.postgresql.org/docs/current/indexes.html)
