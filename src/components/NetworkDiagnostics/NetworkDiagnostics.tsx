import React, { useState, useEffect, useCallback } from 'react';
import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import Card from '@mui/material/Card';
import CardContent from '@mui/material/CardContent';
import CircularProgress from '@mui/material/CircularProgress';
import Grid from '@mui/material/Grid';
import Paper from '@mui/material/Paper';
import Table from '@mui/material/Table';
import TableBody from '@mui/material/TableBody';
import TableCell from '@mui/material/TableCell';
import TableContainer from '@mui/material/TableContainer';
import TableHead from '@mui/material/TableHead';
import TableRow from '@mui/material/TableRow';
import TextField from '@mui/material/TextField';
import Typography from '@mui/material/Typography';
import Alert from '@mui/material/Alert';
import Tooltip from '@mui/material/Tooltip';
import IconButton from '@mui/material/IconButton';
import Refresh from '@mui/icons-material/Refresh';
import Info from '@mui/icons-material/Info';

interface HopStat {
  hop: number;
  host: string;
  ip: string;
  loss: number;
  sent: number;
  last: number;
  avg: number;
  best: number;
  worst: number;
  stdev: number;
  jitter?: number;
  p50?: number;
  p90?: number;
  p95?: number;
  p99?: number;
}

interface HopStat {
  hop: number;
  host: string;
  ip: string;
  loss: number;
  sent: number;
  last: number;
  avg: number;
  best: number;
  worst: number;
  stdev: number;
  jitter?: number;
  host?: string;
  ip?: string;
  loss: string;
  sent: number;
  last: number;
  avg: number;
  best: number;
  worst: number;
  stdev: number;
  jitter: number;
  p50: number;
  p90: number;
  p95: number;
  p99: number;
}

const NetworkDiagnostics = () => {
  const [host, setHost] = useState('api.vibecode.com');
  const [port, setPort] = useState('443');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [results, setResults] = useState<{
    success: boolean;
    host: string;
    port: string;
    connectivity: {
      success: boolean;
      latency: number;
      error?: string;
    };
    trace: HopStat[];
    timestamp?: string;
  } | null>(null);

  const runDiagnostics = useCallback(async () => {
    setIsLoading(true);
    setError(null);

    try {
      const response = await fetch(
        `/api/network/diagnostics?host=${encodeURIComponent(host)}&port=${encodeURIComponent(port)}`
      );
      
      if (!response.ok) {
        throw new Error('Failed to run diagnostics');
      }
      
      const data = await response.json();
      setResults(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to run network diagnostics');
    } finally {
      setIsLoading(false);
    }
  }, [host, port, setIsLoading]);

  useEffect(() => {
    // Run initial diagnostics on component mount
    runDiagnostics();
  }, [runDiagnostics]);

  return (
    <Box sx={{ p: 3 }}>
      <Card variant="outlined">
        <CardContent>
          <Typography variant="h5" gutterBottom>
            Network Diagnostics
            <Tooltip title="Run network diagnostics to check connectivity and trace routes">
              <IconButton size="small" sx={{ ml: 1, verticalAlign: 'middle' }}>
                <Info fontSize="small" />
              </IconButton>
            </Tooltip>
          </Typography>
          
          <Grid container spacing={2} alignItems="center" sx={{ mb: 3 }}>
            <Grid item xs={12} sm={5}>
              <TextField
                fullWidth
                label="Host"
                value={host}
                onChange={(e: React.ChangeEvent<HTMLInputElement>) => setHost(e.target.value)}
                variant="outlined"
                size="small"
                disabled={isLoading}
              />
            </Grid>
            <Grid item xs={12} sm={3}>
              <TextField
                fullWidth
                label="Port"
                value={port}
                onChange={(e: React.ChangeEvent<HTMLInputElement>) => setPort(e.target.value)}
                variant="outlined"
                size="small"
                type="number"
                disabled={isLoading}
              />
            </Grid>
            <Grid item xs={12} sm={4}>
              <Button
                fullWidth
                variant="contained"
                color="primary"
                onClick={runDiagnostics}
                disabled={isLoading}
                startIcon={isLoading ? <CircularProgress size={20} /> : <Refresh />}
              >
                {isLoading ? 'Running...' : 'Run Diagnostics'}
              </Button>
            </Grid>
          </Grid>

          {error && (
            <Alert severity="error" sx={{ mb: 2 }}>
              {error}
            </Alert>
          )}

          {results && (
            <Box>
              <Box sx={{ mb: 3 }}>
                <Typography variant="subtitle1" gutterBottom>
                  Connection to {results.host}:{results.port}
                </Typography>
                {results.connectivity.success ? (
                  <Alert severity="success">
                    Connected successfully in {results.connectivity.latency.toFixed(2)}ms
                  </Alert>
                ) : (
                  <Alert severity="error">
                    Connection failed: {results.connectivity.error}
                  </Alert>
                )}
              </Box>

              {results.trace && results.trace.length > 0 && (
                <Box>
                  <Typography variant="subtitle1" gutterBottom>
                    Network Path Analysis
                  </Typography>
                  <TableContainer component={Paper} variant="outlined">
                    <Table size="small">
                      <TableHead>
                        <TableRow>
                          <TableCell>Hop</TableCell>
                          <TableCell>Host</TableCell>
                          <TableCell>IP</TableCell>
                          <TableCell>Loss %</TableCell>
                          <TableCell>Avg (ms)</TableCell>
                          <TableCell>Best (ms)</TableCell>
                          <TableCell>Worst (ms)</TableCell>
                          <TableCell>StDev</TableCell>
                          <TableCell>Jitter</TableCell>
                          <TableCell>P90 (ms)</TableCell>
                          <TableCell>P99 (ms)</TableCell>
                        </TableRow>
                      </TableHead>
                      <TableBody>
                        {results.trace.map((hop) => (
                          <TableRow key={hop.hop}>
                            <TableCell>{hop.hop}</TableCell>
                            <TableCell>{hop.host || 'Unknown'}</TableCell>
                            <TableCell>{hop.ip || 'Unknown'}</TableCell>
                            <TableCell>{hop.loss}</TableCell>
                            <TableCell>{hop.avg.toFixed(2)}</TableCell>
                            <TableCell>{hop.best.toFixed(2)}</TableCell>
                            <TableCell>{hop.worst.toFixed(2)}</TableCell>
                            <TableCell>{hop.stdev.toFixed(2)}</TableCell>
                            <TableCell>{hop.jitter.toFixed(2)}</TableCell>
                            <TableCell>{hop.p90.toFixed(2)}</TableCell>
                            <TableCell>{hop.p99.toFixed(2)}</TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </TableContainer>
                </Box>
              )}

              {results.timestamp && (
                <Typography variant="caption" color="textSecondary" sx={{ mt: 2, display: 'block' }}>
                  Last updated: {new Date(results.timestamp).toLocaleString()}
                </Typography>
              )}
            </Box>
          )}
        </CardContent>
      </Card>
    </Box>
  );
};

export default NetworkDiagnostics;
