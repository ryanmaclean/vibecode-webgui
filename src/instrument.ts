import tracer from 'dd-trace';

// Initialize the tracer
tracer.init({
  // Docs: https://docs.datadoghq.com/tracing/trace_collection/library_config/nodejs/
  logInjection: true,
  profiling: true,
  env: process.env.NODE_ENV === 'production' ? 'production' : 'development',
  service: process.env.DD_SERVICE || 'vibecode-webgui',

  version: process.env.npm_package_version,
});



export default tracer;
