/**
 * Linear Regression Model
 * 
 * Description: Train a linear regression model on distributed data
 * Use Case: Predictive analytics on large datasets
 * Library: Apache Spark MLlib
 * Category: ml-ai
 * Language: scala
 * 
 * Key Features: Distributed ML, Feature Engineering, Model Training, Data Processing
 * GitHub: https://github.com/apache/spark
 */


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
println(s"Coefficients: ${lrModel.coefficients}")
println(s"Intercept: ${lrModel.intercept}")
        
        