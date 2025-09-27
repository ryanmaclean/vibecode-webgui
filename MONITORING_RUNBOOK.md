# Monitoring Runbook

This runbook provides guidance for monitoring and troubleshooting the VibeCode platform.

## Health Checks

Check application health:
```bash
npm run health-check
```

Monitor key metrics:
```bash
npm run monitoring:health
npm run monitoring:metrics
```

## Datadog Monitoring

Setup Datadog monitoring:
```bash
npm run monitoring:setup
```

Check Datadog configuration:
```bash
curl -s http://localhost:3000/api/monitoring/dashboard | jq '.health'
```

## Performance Monitoring

Run performance tests:
```bash
npm run test:performance
npm run test:performance:lighthouse
```

## Troubleshooting

### Common Issues

1. **Application Not Starting**: Check environment variables and dependencies
2. **Database Connection Issues**: Verify database configuration
3. **High Memory Usage**: Review application logs and metrics

### Log Analysis

Application logs are available via:
- Local development: Console output
- Production: Datadog logs and APM

### Emergency Contacts

For critical issues, refer to the on-call procedures in the [DISASTER_RECOVERY.md](./DISASTER_RECOVERY.md) document.