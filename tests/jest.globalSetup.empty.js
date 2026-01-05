// Empty global setup for testing without infrastructure checks
export default async function() {
  console.log('Skipping infrastructure checks');
  return Promise.resolve();
}
