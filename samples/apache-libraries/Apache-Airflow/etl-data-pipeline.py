/**
 * ETL Data Pipeline
 * 
 * Description: Complete ETL workflow with data validation and monitoring
 * Use Case: Daily data processing and analytics pipeline
 * Library: Apache Airflow
 * Category: data-orchestration
 * Language: python
 * 
 * Key Features: Workflow Orchestration, Task Scheduling, Monitoring, Data Pipelines
 * GitHub: https://github.com/apache/airflow
 */


from airflow import DAG
from airflow.operators.python_operator import PythonOperator
from airflow.operators.postgres_operator import PostgresOperator
from airflow.hooks.postgres_hook import PostgresHook
from datetime import datetime, timedelta
import pandas as pd

default_args = {
    'owner': 'data-team',
    'depends_on_past': False,
    'start_date': datetime(2025, 1, 1),
    'email_on_failure': True,
    'email_on_retry': False,
    'retries': 2,
    'retry_delay': timedelta(minutes=5)
}

dag = DAG(
    'etl_data_pipeline',
    default_args=default_args,
    description='Daily ETL pipeline for user analytics',
    schedule_interval='@daily',
    catchup=False,
    tags=['etl', 'analytics']
)

def extract_user_data(**context):
    """Extract user data from multiple sources"""
    execution_date = context['execution_date']
    
    # Extract from API
    api_data = extract_from_api(execution_date)
    
    # Extract from database
    db_hook = PostgresHook(postgres_conn_id='source_db')
    sql = """
    SELECT user_id, activity_type, timestamp, metadata
    FROM user_activities 
    WHERE DATE(timestamp) = %s
    """
    db_data = db_hook.get_pandas_df(sql, parameters=[execution_date.date()])
    
    # Combine and validate data
    combined_data = pd.concat([api_data, db_data])
    validated_data = validate_data_quality(combined_data)
    
    # Store in temporary location
    validated_data.to_parquet(f'/tmp/extracted_data_{execution_date.date()}.parquet')
    
    return f"Extracted {len(validated_data)} records"

def transform_data(**context):
    """Transform and enrich extracted data"""
    execution_date = context['execution_date']
    
    # Load extracted data
    df = pd.read_parquet(f'/tmp/extracted_data_{execution_date.date()}.parquet')
    
    # Data transformations
    df['user_segment'] = df['metadata'].apply(calculate_user_segment)
    df['activity_score'] = df.groupby('user_id')['activity_type'].transform('count')
    df['hour'] = pd.to_datetime(df['timestamp']).dt.hour
    
    # Aggregations
    daily_stats = df.groupby(['user_id', 'user_segment']).agg({
        'activity_score': 'sum',
        'timestamp': 'count'
    }).reset_index()
    
    # Save transformed data
    daily_stats.to_parquet(f'/tmp/transformed_data_{execution_date.date()}.parquet')
    
    return f"Transformed data for {daily_stats['user_id'].nunique()} users"

def load_to_warehouse(**context):
    """Load transformed data to data warehouse"""
    execution_date = context['execution_date']
    
    # Load transformed data
    df = pd.read_parquet(f'/tmp/transformed_data_{execution_date.date()}.parquet')
    
    # Load to PostgreSQL data warehouse
    hook = PostgresHook(postgres_conn_id='warehouse_db')
    df.to_sql(
        'daily_user_analytics',
        hook.get_sqlalchemy_engine(),
        if_exists='append',
        index=False,
        method='multi'
    )
    
    return f"Loaded {len(df)} records to warehouse"

# Define tasks
extract_task = PythonOperator(
    task_id='extract_user_data',
    python_callable=extract_user_data,
    dag=dag
)

transform_task = PythonOperator(
    task_id='transform_data',
    python_callable=transform_data,
    dag=dag
)

load_task = PythonOperator(
    task_id='load_to_warehouse',
    python_callable=load_to_warehouse,
    dag=dag
)

# Data quality check
quality_check = PostgresOperator(
    task_id='data_quality_check',
    postgres_conn_id='warehouse_db',
    sql="""
    SELECT 
        COUNT(*) as record_count,
        COUNT(DISTINCT user_id) as unique_users,
        AVG(activity_score) as avg_activity
    FROM daily_user_analytics 
    WHERE DATE(created_at) = '{{ ds }}'
    """,
    dag=dag
)

# Set task dependencies
extract_task >> transform_task >> load_task >> quality_check
        
        