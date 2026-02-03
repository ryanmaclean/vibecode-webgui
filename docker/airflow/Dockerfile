# Airflow image with kafka-python baked in (for sling ingest) and OpenLineage provider.
FROM apache/airflow:2.8.0

RUN pip install --no-cache-dir kafka-python apache-airflow-providers-openlineage>=2.7.3
