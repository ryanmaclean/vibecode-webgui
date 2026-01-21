/**
 * Real-time Stream Processing
 * 
 * Description: Process streaming data with Spark Streaming
 * Use Case: Real-time analytics and monitoring
 * Library: Apache Spark MLlib
 * Category: ml-ai
 * Language: scala
 * 
 * Key Features: Distributed ML, Feature Engineering, Model Training, Data Processing
 * GitHub: https://github.com/apache/spark
 */


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
        
        