/**
 * Real-time Analytics Pipeline
 * 
 * Description: Process streaming events with windowing and aggregations
 * Use Case: Real-time user behavior analytics
 * Library: Apache Beam
 * Category: data-processing
 * Language: java
 * 
 * Key Features: Unified Batch/Stream, Portable Pipelines, Multiple Runners, Windowing
 * GitHub: https://github.com/apache/beam
 */


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
        
        