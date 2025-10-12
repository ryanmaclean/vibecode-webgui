import React, { useState, useEffect, useCallback, useMemo, memo } from 'react';
import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import Card from '@mui/material/Card';
import CardContent from '@mui/material/CardContent';
import CircularProgress from '@mui/material/CircularProgress';
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
import type { HopStat } from '@/types/network';

<<<<<<< HEAD
// Memoized HopRow component
const HopRow = memo(({ hop }: { hop: HopStat }) => (
  <TableRow>
    <TableCell>{hop.hop}</TableCell>
    <TableCell>{hop.host || 'Unknown'}</TableCell>
    <TableCell>{hop.ip || 'Unknown'}</TableCell>
    <TableCell>{hop.loss}</TableCell>
    <TableCell>{hop.avg.toFixed(2)}</TableCell>
    <TableCell>{hop.best.toFixed(2)}</TableCell>
    <TableCell>{hop.worst.toFixed(2)}</TableCell>
    <TableCell>{hop.stdev.toFixed(2)}</TableCell>
    <TableCell>{hop.jitter != null ? hop.jitter.toFixed(2) : '-'}</TableCell>
    <TableCell>{hop.p90 != null ? hop.p90.toFixed(2) : '-'}</TableCell>
    <TableCell>{hop.p99 != null ? hop.p99.toFixed(2) : '-'}</TableCell>
  </TableRow>
));
HopRow.displayName = 'HopRow';

// Memoized ConnectionResult component
const ConnectionResult = memo(({
  host,
  port,
  connectivity
}: {
  host: string;
  port: string;
  connectivity: {
    success: boolean;
    latency: number;
    error?: string;
  };
}) => (
  <Box sx={{ mb: 3 }}>
    <Typography variant="subtitle1" gutterBottom>
      Connection to {host}:{port}
    </Typography>
    {connectivity.success ? (
      <Alert severity="success">
        Connected successfully in {connectivity.latency.toFixed(2)}ms
      </Alert>
    ) : (
      <Alert severity="error">
        Connection failed: {connectivity.error}
      </Alert>
    )}
  </Box>
));
ConnectionResult.displayName = 'ConnectionResult';

// Memoized NetworkPathTable component
const NetworkPathTable = memo(({ trace }: { trace: HopStat[] }) => (
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
          {trace.map((hop) => (
            <HopRow key={hop.hop} hop={hop} />
          ))}
        </TableBody>
      </Table>
    </TableContainer>
  </Box>
));
NetworkPathTable.displayName = 'NetworkPathTable';

const NetworkDiagnostics = memo(() => {
=======
const LinkDiagnostics = () => {
>>>>>>> ai-sdk-openai-v2-test
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
  }, [host, port]);

  useEffect(() => {
    // Run initial diagnostics on component mount
    runDiagnostics();
  }, [runDiagnostics]);

  const handleHostChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    setHost(e.target.value);
  }, []);

  const handlePortChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    setPort(e.target.value);
  }, []);

  const formattedTimestamp = useMemo(
    () => results?.timestamp ? new Date(results.timestamp).toLocaleString() : null,
    [results?.timestamp]
  );

  return (
    <Box sx={{ p: 3 }}>
      <Card variant="outlined">
        <CardContent>
          <Typography variant="h5" gutterBottom>
            Link Diagnostics
            <Tooltip title="Run network diagnostics to check connectivity and trace routes">
              <Box component="span" sx={{ ml: 1, verticalAlign: 'middle', fontSize: 12, color: 'text.secondary' }}>i</Box>
            </Tooltip>
          </Typography>

          <Box
            sx={{
              mb: 3,
              display: 'flex',
              flexDirection: { xs: 'column', sm: 'row' },
              gap: 2,
              alignItems: 'center'
            }}
          >
            <Box sx={{ flex: { sm: 5 }, width: '100%' }}>
              <TextField
                fullWidth
                label="Host"
                value={host}
                onChange={handleHostChange}
                variant="outlined"
                size="small"
                disabled={isLoading}
              />
            </Box>
            <Box sx={{ flex: { sm: 3 }, width: '100%' }}>
              <TextField
                fullWidth
                label="Port"
                value={port}
                onChange={handlePortChange}
                variant="outlined"
                size="small"
                type="number"
                disabled={isLoading}
              />
            </Box>
            <Box sx={{ flex: { sm: 4 }, width: '100%' }}>
              <Button
                fullWidth
                variant="contained"
                color="primary"
                onClick={runDiagnostics}
                disabled={isLoading}
                startIcon={isLoading ? <CircularProgress size={20} /> : undefined}
              >
                {isLoading ? 'Running...' : 'Run Diagnostics'}
              </Button>
            </Box>
          </Box>

          {error && (
            <Alert severity="error" sx={{ mb: 2 }}>
              {error}
            </Alert>
          )}

          {results && (
            <Box>
              <ConnectionResult
                host={results.host}
                port={results.port}
                connectivity={results.connectivity}
              />

              {results.trace && results.trace.length > 0 && (
<<<<<<< HEAD
                <NetworkPathTable trace={results.trace} />
=======
                <Box>
                  <Typography variant="subtitle1" gutterBottom>
                    Link Path Analysis
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
                            <TableCell>{hop.jitter != null ? hop.jitter.toFixed(2) : '-'}</TableCell>
                            <TableCell>{hop.p90 != null ? hop.p90.toFixed(2) : '-'}</TableCell>
                            <TableCell>{hop.p99 != null ? hop.p99.toFixed(2) : '-'}</TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </TableContainer>
                </Box>
>>>>>>> ai-sdk-openai-v2-test
              )}

              {formattedTimestamp && (
                <Typography variant="caption" color="textSecondary" sx={{ mt: 2, display: 'block' }}>
                  Last updated: {formattedTimestamp}
                </Typography>
              )}
            </Box>
          )}
        </CardContent>
      </Card>
    </Box>
  );
});
NetworkDiagnostics.displayName = 'NetworkDiagnostics';

export default LinkDiagnostics;
