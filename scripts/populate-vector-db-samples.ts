#!/usr/bin/env npx tsx

/**
 * Populate Vector Database with Apache-Licensed Library Samples
 * Downloads and processes popular Apache-licensed libraries for RAG search
 */

import { writeFileSync, mkdirSync, existsSync } from 'fs'
import { join } from 'path'
import { vectorStore } from '../src/lib/vector-store'
import { prisma } from '../src/lib/prisma'

interface LibrarySample {
  name: string
  description: string
  language: string
  category: string
  githubUrl: string
  keyFeatures: string[]
  codeExamples: Array<{
    title: string
    description: string
    code: string
    useCase: string
  }>
}

const APACHE_LIBRARIES: LibrarySample[] = [
  {
    name: 'Apache Spark MLlib',
    description: 'Distributed machine learning library for big data processing',
    language: 'scala',
    category: 'ml-ai',
    githubUrl: 'https://github.com/apache/spark',
    keyFeatures: ['Distributed ML', 'Feature Engineering', 'Model Training', 'Data Processing'],
    codeExamples: [
      {
        title: 'Linear Regression Model',
        description: 'Train a linear regression model on distributed data',
        useCase: 'Predictive analytics on large datasets',
        code: `
import org.apache.spark.ml.regression.LinearRegression
import org.apache.spark.ml.feature.VectorAssembler
import org.apache.spark.sql.SparkSession

val spark = SparkSession.builder()
  .appName("LinearRegressionExample")
  .master("local[*]")
  .getOrCreate()

// Load training data
val training = spark.read.format("libsvm")
  .load("data/mllib/sample_linear_regression_data.txt")

// Create feature vector
val assembler = new VectorAssembler()
  .setInputCols(Array("feature1", "feature2", "feature3"))
  .setOutputCol("features")

val data = assembler.transform(training)

// Create and train model
val lr = new LinearRegression()
  .setMaxIter(10)
  .setRegParam(0.3)
  .setElasticNetParam(0.8)

val lrModel = lr.fit(data)

// Make predictions
val predictions = lrModel.transform(data)
predictions.select("prediction", "label", "features").show(5)

// Model metrics
println(s"Coefficients: \${lrModel.coefficients}")
println(s"Intercept: \${lrModel.intercept}")
        `
      },
      {
        title: 'Real-time Stream Processing',
        description: 'Process streaming data with Spark Streaming',
        useCase: 'Real-time analytics and monitoring',
        code: `
import org.apache.spark.streaming._
import org.apache.spark.streaming.kafka010._
import org.apache.spark.sql.functions._

val spark = SparkSession.builder()
  .appName("StreamProcessing")
  .master("local[*]")
  .getOrCreate()

import spark.implicits._

// Create streaming context
val ssc = new StreamingContext(spark.sparkContext, Seconds(10))

// Kafka parameters
val kafkaParams = Map[String, Object](
  "bootstrap.servers" -> "localhost:9092",
  "key.deserializer" -> classOf[StringDeserializer],
  "value.deserializer" -> classOf[StringDeserializer],
  "group.id" -> "streaming_group",
  "auto.offset.reset" -> "latest"
)

// Create DStream from Kafka
val topics = Array("user_events")
val stream = KafkaUtils.createDirectStream[String, String](
  ssc,
  PreferConsistent,
  Subscribe[String, String](topics, kafkaParams)
)

// Process streaming data
val events = stream.map(record => record.value())
val eventCounts = events
  .map(event => (event.split(",")(0), 1))
  .reduceByKey(_ + _)

eventCounts.foreachRDD { rdd =>
  val df = rdd.toDF("event_type", "count")
  df.write
    .mode("append")
    .format("delta")
    .save("/path/to/event_analytics")
}

ssc.start()
ssc.awaitTermination()
        `
      }
    ]
  },
  {
    name: 'Apache Airflow',
    description: 'Platform for developing, scheduling, and monitoring workflows',
    language: 'python',
    category: 'data-orchestration',
    githubUrl: 'https://github.com/apache/airflow',
    keyFeatures: ['Workflow Orchestration', 'Task Scheduling', 'Monitoring', 'Data Pipelines'],
    codeExamples: [
      {
        title: 'ETL Data Pipeline',
        description: 'Complete ETL workflow with data validation and monitoring',
        useCase: 'Daily data processing and analytics pipeline',
        code: `
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
        `
      }
    ]
  },
  {
    name: 'Apache Kafka',
    description: 'Distributed event streaming platform for high-performance data pipelines',
    language: 'java',
    category: 'messaging',
    githubUrl: 'https://github.com/apache/kafka',
    keyFeatures: ['Event Streaming', 'Message Queuing', 'Real-time Processing', 'Distributed Systems'],
    codeExamples: [
      {
        title: 'Real-time Event Producer',
        description: 'High-performance event producer with batching and compression',
        useCase: 'Stream user events to analytics pipeline',
        code: `
import org.apache.kafka.clients.producer.*;
import org.apache.kafka.common.serialization.StringSerializer;
import java.util.Properties;
import java.util.concurrent.Future;

public class EventProducer {
    private final Producer<String, String> producer;
    private final String topicName;
    
    public EventProducer(String topicName) {
        this.topicName = topicName;
        
        Properties props = new Properties();
        props.put(ProducerConfig.BOOTSTRAP_SERVERS_CONFIG, "localhost:9092");
        props.put(ProducerConfig.KEY_SERIALIZER_CLASS_CONFIG, StringSerializer.class);
        props.put(ProducerConfig.VALUE_SERIALIZER_CLASS_CONFIG, StringSerializer.class);
        
        // Performance optimizations
        props.put(ProducerConfig.BATCH_SIZE_CONFIG, 32768);
        props.put(ProducerConfig.LINGER_MS_CONFIG, 10);
        props.put(ProducerConfig.COMPRESSION_TYPE_CONFIG, "snappy");
        props.put(ProducerConfig.BUFFER_MEMORY_CONFIG, 67108864);
        
        // Reliability settings
        props.put(ProducerConfig.ACKS_CONFIG, "all");
        props.put(ProducerConfig.RETRIES_CONFIG, 3);
        props.put(ProducerConfig.ENABLE_IDEMPOTENCE_CONFIG, true);
        
        this.producer = new KafkaProducer<>(props);
    }
    
    public void sendUserEvent(String userId, String eventType, String eventData) {
        String key = userId;
        String value = String.format(
            "{\\"timestamp\\": %d, \\"user_id\\": \\"%s\\", \\"event_type\\": \\"%s\\", \\"data\\": %s}",
            System.currentTimeMillis(), userId, eventType, eventData
        );
        
        ProducerRecord<String, String> record = new ProducerRecord<>(
            topicName, key, value
        );
        
        // Async send with callback
        Future<RecordMetadata> future = producer.send(record, (metadata, exception) -> {
            if (exception != null) {
                System.err.printf("Failed to send event for user %s: %s%n", 
                    userId, exception.getMessage());
            } else {
                System.out.printf("Event sent: topic=%s, partition=%d, offset=%d%n",
                    metadata.topic(), metadata.partition(), metadata.offset());
            }
        });
    }
    
    public void sendBatchEvents(List<UserEvent> events) {
        events.forEach(event -> 
            sendUserEvent(event.getUserId(), event.getType(), event.getData())
        );
        
        // Ensure all messages are sent
        producer.flush();
    }
    
    public void close() {
        producer.close();
    }
}

// Consumer example
public class EventConsumer {
    private final Consumer<String, String> consumer;
    
    public EventConsumer(String groupId, List<String> topics) {
        Properties props = new Properties();
        props.put(ConsumerConfig.BOOTSTRAP_SERVERS_CONFIG, "localhost:9092");
        props.put(ConsumerConfig.GROUP_ID_CONFIG, groupId);
        props.put(ConsumerConfig.KEY_DESERIALIZER_CLASS_CONFIG, StringDeserializer.class);
        props.put(ConsumerConfig.VALUE_DESERIALIZER_CLASS_CONFIG, StringDeserializer.class);
        props.put(ConsumerConfig.AUTO_OFFSET_RESET_CONFIG, "earliest");
        props.put(ConsumerConfig.ENABLE_AUTO_COMMIT_CONFIG, false);
        props.put(ConsumerConfig.MAX_POLL_RECORDS_CONFIG, 1000);
        
        this.consumer = new KafkaConsumer<>(props);
        consumer.subscribe(topics);
    }
    
    public void processEvents() {
        try {
            while (true) {
                ConsumerRecords<String, String> records = consumer.poll(Duration.ofMillis(1000));
                
                for (ConsumerRecord<String, String> record : records) {
                    processEvent(record.key(), record.value());
                }
                
                // Manual commit after processing
                consumer.commitSync();
            }
        } catch (Exception e) {
            System.err.println("Error processing events: " + e.getMessage());
        } finally {
            consumer.close();
        }
    }
    
    private void processEvent(String userId, String eventData) {
        // Process event logic here
        System.out.printf("Processing event for user %s: %s%n", userId, eventData);
    }
}
        `
      }
    ]
  },
  {
    name: 'Apache Beam',
    description: 'Unified model for batch and stream data processing',
    language: 'java',
    category: 'data-processing',
    githubUrl: 'https://github.com/apache/beam',
    keyFeatures: ['Unified Batch/Stream', 'Portable Pipelines', 'Multiple Runners', 'Windowing'],
    codeExamples: [
      {
        title: 'Real-time Analytics Pipeline',
        description: 'Process streaming events with windowing and aggregations',
        useCase: 'Real-time user behavior analytics',
        code: `
import org.apache.beam.sdk.Pipeline;
import org.apache.beam.sdk.io.kafka.KafkaIO;
import org.apache.beam.sdk.io.jdbc.JdbcIO;
import org.apache.beam.sdk.transforms.*;
import org.apache.beam.sdk.transforms.windowing.*;
import org.apache.beam.sdk.values.*;
import org.apache.beam.sdk.coders.StringUtf8Coder;
import org.joda.time.Duration;

public class RealTimeAnalytics {
    
    public static void main(String[] args) {
        Pipeline pipeline = Pipeline.create();
        
        // Read from Kafka
        PCollection<String> events = pipeline
            .apply("Read from Kafka", 
                KafkaIO.<String, String>read()
                    .withBootstrapServers("localhost:9092")
                    .withTopic("user_events")
                    .withKeyDeserializer(StringDeserializer.class)
                    .withValueDeserializer(StringDeserializer.class)
                    .withoutMetadata())
            .apply("Extract Values", Values.create());
        
        // Parse and transform events
        PCollection<UserEvent> parsedEvents = events
            .apply("Parse JSON", ParDo.of(new DoFn<String, UserEvent>() {
                @ProcessElement
                public void processElement(ProcessContext c) {
                    try {
                        UserEvent event = parseUserEvent(c.element());
                        c.output(event);
                    } catch (Exception e) {
                        // Handle parsing errors
                        System.err.println("Failed to parse event: " + e.getMessage());
                    }
                }
            }));
        
        // Windowed aggregations
        PCollection<KV<String, Long>> userActivityCounts = parsedEvents
            .apply("Key by User", 
                WithKeys.of((UserEvent event) -> event.getUserId()))
            .apply("Window", 
                Window.<KV<String, UserEvent>>into(
                    FixedWindows.of(Duration.standardMinutes(5)))
                    .triggering(
                        AfterWatermark.pastEndOfWindow()
                            .withEarlyFirings(
                                AfterProcessingTime
                                    .pastFirstElementInPane()
                                    .plusDelayOf(Duration.standardSeconds(30))))
                    .withAllowedLateness(Duration.standardMinutes(1))
                    .accumulatingFiredPanes())
            .apply("Count per User", Count.perKey());
        
        // Real-time alerts for high activity
        PCollection<Alert> alerts = userActivityCounts
            .apply("Filter High Activity", 
                Filter.by((KV<String, Long> kv) -> kv.getValue() > 100))
            .apply("Create Alerts", ParDo.of(new DoFn<KV<String, Long>, Alert>() {
                @ProcessElement
                public void processElement(ProcessContext c) {
                    KV<String, Long> element = c.element();
                    Alert alert = new Alert(
                        element.getKey(),
                        "High activity detected",
                        element.getValue(),
                        Instant.now()
                    );
                    c.output(alert);
                }
            }));
        
        // Write aggregated data to database
        userActivityCounts
            .apply("Format for DB", ParDo.of(new DoFn<KV<String, Long>, KV<Void, String>>() {
                @ProcessElement
                public void processElement(ProcessContext c) {
                    KV<String, Long> element = c.element();
                    String sql = String.format(
                        "INSERT INTO user_activity_5min (user_id, activity_count, window_start) " +
                        "VALUES ('%s', %d, '%s')",
                        element.getKey(),
                        element.getValue(),
                        c.timestamp().toString()
                    );
                    c.output(KV.of((Void) null, sql));
                }
            }))
            .apply("Write to Database",
                JdbcIO.<KV<Void, String>>writeVoid()
                    .withDataSourceConfiguration(
                        JdbcIO.DataSourceConfiguration.create(
                            "org.postgresql.Driver",
                            "jdbc:postgresql://localhost/analytics"))
                    .withStatement("INSERT INTO user_activity_5min ...")
                    .withPreparedStatementSetter((element, statement) -> {
                        // Set parameters for prepared statement
                    }));
        
        // Send alerts to notification system
        alerts
            .apply("Send Alerts", ParDo.of(new DoFn<Alert, Void>() {
                @ProcessElement
                public void processElement(ProcessContext c) {
                    Alert alert = c.element();
                    sendNotification(alert);
                }
            }));
        
        pipeline.run();
    }
    
    private static UserEvent parseUserEvent(String json) {
        // JSON parsing logic
        return new UserEvent();
    }
    
    private static void sendNotification(Alert alert) {
        // Send to notification service
        System.out.println("Alert: " + alert.getMessage());
    }
}
        `
      }
    ]
  }
]

async function populateVectorDatabase() {
  console.log('🚀 Populating Vector Database with Apache-Licensed Library Samples...')
  
  try {
    // Create samples directory
    const samplesDir = join(process.cwd(), 'samples', 'apache-libraries')
    if (!existsSync(samplesDir)) {
      mkdirSync(samplesDir, { recursive: true })
    }
    
    for (const library of APACHE_LIBRARIES) {
      console.log(`📦 Processing ${library.name}...`)
      
      // Create workspace for this library
      const workspace = await prisma.workspace.create({
        data: {
          workspace_id: `apache-${library.name.toLowerCase().replace(/\s+/g, '-')}`,
          name: `${library.name} Examples`,
          user_id: 1, // Default user
          status: 'active'
        }
      })
      
      // Process each code example
      for (const example of library.codeExamples) {
        const fileName = `${example.title.toLowerCase().replace(/\s+/g, '-')}.${getFileExtension(library.language)}`
        const filePath = join(samplesDir, library.name.replace(/\s+/g, '-'), fileName)
        
        // Create file content with metadata
        const fileContent = `/**
 * ${example.title}
 * 
 * Description: ${example.description}
 * Use Case: ${example.useCase}
 * Library: ${library.name}
 * Category: ${library.category}
 * Language: ${library.language}
 * 
 * Key Features: ${library.keyFeatures.join(', ')}
 * GitHub: ${library.githubUrl}
 */

${example.code}
        `
        
        // Save file to samples directory
        mkdirSync(join(samplesDir, library.name.replace(/\s+/g, '-')), { recursive: true })
        writeFileSync(filePath, fileContent)
        
        // Create file record in database
        const file = await prisma.file.create({
          data: {
            name: fileName,
            path: filePath,
            content: fileContent,
            language: library.language,
            size: fileContent.length,
            user_id: 1,
            workspace_id: workspace.id
          }
        })
        
        // Create chunks for vector search
        const chunks = createChunks(fileContent, example, library)
        
        // Store in vector database
        await vectorStore.storeChunks(file.id, chunks)
        
        console.log(`  ✅ Added ${fileName} with ${chunks.length} chunks`)
      }
    }
    
    console.log('🎉 Successfully populated vector database with Apache library samples!')
    console.log('📊 You can now search for patterns like:')
    console.log('  - "How do I process streaming data?"')
    console.log('  - "Show me machine learning examples"')
    console.log('  - "Create a data pipeline with Apache tools"')
    console.log('  - "Implement real-time analytics"')
    
  } catch (error) {
    console.error('❌ Error populating vector database:', error)
    throw error
  }
}

function getFileExtension(language: string): string {
  const extensions: Record<string, string> = {
    'javascript': 'js',
    'typescript': 'ts',
    'python': 'py',
    'java': 'java',
    'scala': 'scala',
    'kotlin': 'kt',
    'go': 'go',
    'rust': 'rs',
    'cpp': 'cpp',
    'csharp': 'cs'
  }
  return extensions[language] || 'txt'
}

function createChunks(content: string, example: any, library: any) {
  const lines = content.split('\n')
  const chunks = []
  
  // Create chunks for different sections
  chunks.push({
    content: `${library.name}: ${library.description}. Features: ${library.keyFeatures.join(', ')}. Category: ${library.category}`,
    startLine: 1,
    endLine: 10,
    tokens: 50
  })
  
  chunks.push({
    content: `${example.title}: ${example.description}. Use case: ${example.useCase}. Implementation using ${library.name} for ${library.category} applications.`,
    startLine: 11,
    endLine: 20,
    tokens: 40
  })
  
  // Split code into logical chunks
  const codeLines = example.code.split('\n').filter(line => line.trim())
  const chunkSize = 20
  
  for (let i = 0; i < codeLines.length; i += chunkSize) {
    const chunkLines = codeLines.slice(i, i + chunkSize)
    chunks.push({
      content: chunkLines.join('\n'),
      startLine: 21 + i,
      endLine: 21 + i + chunkLines.length,
      tokens: chunkLines.join(' ').split(' ').length
    })
  }
  
  return chunks
}

if (require.main === module) {
  populateVectorDatabase()
    .then(() => process.exit(0))
    .catch(error => {
      console.error(error)
      process.exit(1)
    })
}