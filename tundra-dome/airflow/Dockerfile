# Custom Airflow image for Tundra Dome with pre-installed packages
# This eliminates init container pip install and saves disk space on KIND nodes
FROM apache/airflow:2.9.0

USER root

# Install system dependencies for kafka-python
RUN apt-get update && apt-get install -y --no-install-recommends \
    gcc \
    && rm -rf /var/lib/apt/lists/*

USER airflow

# Pre-install required packages - baked into image
# This avoids init container pip install which wastes disk space and time
RUN pip install --no-cache-dir \
    kafka-python==2.0.2 \
    apache-airflow-providers-openlineage==1.8.0

# Create directories for DAGs and logs
RUN mkdir -p /opt/airflow/dags /opt/airflow/logs

# Copy entrypoint script for DAG state restoration
COPY --chown=airflow:root entrypoint.sh /opt/airflow/entrypoint.sh
RUN chmod +x /opt/airflow/entrypoint.sh

# Health check endpoint
HEALTHCHECK --interval=30s --timeout=10s --start-period=60s --retries=3 \
    CMD curl -f http://localhost:8080/health || exit 1

ENTRYPOINT ["/opt/airflow/entrypoint.sh"]
CMD ["standalone"]
