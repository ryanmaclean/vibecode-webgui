/**
 * Real-time Event Producer
 * 
 * Description: High-performance event producer with batching and compression
 * Use Case: Stream user events to analytics pipeline
 * Library: Apache Kafka
 * Category: messaging
 * Language: java
 * 
 * Key Features: Event Streaming, Message Queuing, Real-time Processing, Distributed Systems
 * GitHub: https://github.com/apache/kafka
 */


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
            "{\"timestamp\": %d, \"user_id\": \"%s\", \"event_type\": \"%s\", \"data\": %s}",
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
        
        