/**
 * OllamaModelManager Component
 *
 * Manages local Ollama models with download, delete, and model browsing functionality.
 * Integrates with the Ollama API for model management operations.
 */

'use client';

import React, { useState, useCallback, useEffect, useMemo } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { ScrollArea } from '@/components/ui/scroll-area';
import {
  Download,
  Trash2,
  Server,
  Search,
  X,
  AlertCircle,
  CheckCircle,
  Loader2,
  HardDrive,
  Clock,
  RefreshCw,
  Info,
  Sparkles,
} from 'lucide-react';
import { useOllamaModels, type OllamaModelInfo, type RecommendedModels } from '@/hooks/useOllamaModels';

// ============================================================================
// Types
// ============================================================================

interface OllamaModelManagerProps {
  /** Custom class name */
  className?: string;
  /** Show header */
  showHeader?: boolean;
  /** Callback when a model is selected */
  onModelSelect?: (model: OllamaModelInfo) => void;
  /** Auto-refresh interval in ms (0 to disable) */
  autoRefreshInterval?: number;
}

interface DownloadProgress {
  modelName: string;
  status: 'downloading' | 'success' | 'error';
  message?: string;
}

// ============================================================================
// Helper Functions
// ============================================================================

const formatFileSize = (bytes: number): string => {
  if (bytes === 0) return '0 B';
  const units = ['B', 'KB', 'MB', 'GB', 'TB'];
  const k = 1024;
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return `${(bytes / Math.pow(k, i)).toFixed(2)} ${units[i]}`;
};

const formatRelativeTime = (dateString: string): string => {
  try {
    const date = new Date(dateString);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMins / 60);
    const diffDays = Math.floor(diffHours / 24);

    if (diffMins < 1) return 'just now';
    if (diffMins < 60) return `${diffMins}m ago`;
    if (diffHours < 24) return `${diffHours}h ago`;
    if (diffDays < 30) return `${diffDays}d ago`;
    return date.toLocaleDateString();
  } catch {
    return dateString;
  }
};

const getCategoryIcon = (category: string): React.ReactNode => {
  const icons: Record<string, React.ReactNode> = {
    coding: <span className="text-blue-500">💻</span>,
    general: <span className="text-purple-500">🤖</span>,
    lightweight: <span className="text-green-500">⚡</span>,
    creative: <span className="text-pink-500">🎨</span>,
  };
  return icons[category] || <Sparkles className="h-4 w-4 text-gray-400" />;
};

// ============================================================================
// Sub-Components
// ============================================================================

interface ModelListItemProps {
  model: OllamaModelInfo;
  isDownloading: boolean;
  onDelete: () => void;
  onClick?: () => void;
}

const ModelListItem: React.FC<ModelListItemProps> = ({
  model,
  isDownloading,
  onDelete,
  onClick,
}) => {
  const [showConfirm, setShowConfirm] = useState(false);

  return (
    <div
      className={`p-4 border-b last:border-b-0 hover:bg-gray-50 transition-colors ${
        onClick ? 'cursor-pointer' : ''
      }`}
      onClick={onClick}
    >
      <div className="flex items-start justify-between">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <h4 className="font-semibold text-gray-900 truncate">{model.name}</h4>
            <Badge variant="outline" className="text-xs">
              {model.parameterSize}
            </Badge>
          </div>
          <div className="flex flex-wrap gap-2 mt-2 text-xs text-gray-500">
            <span className="flex items-center gap-1">
              <HardDrive className="h-3 w-3" />
              {model.sizeFormatted}
            </span>
            <span className="flex items-center gap-1">
              <Clock className="h-3 w-3" />
              {formatRelativeTime(model.modified)}
            </span>
            {model.quantization && (
              <Badge variant="secondary" className="text-xs">
                {model.quantization}
              </Badge>
            )}
            {model.family && (
              <Badge variant="secondary" className="text-xs">
                {model.family}
              </Badge>
            )}
          </div>
        </div>

        <div className="flex items-center gap-2 ml-4 flex-shrink-0">
          {!showConfirm ? (
            <Button
              variant="destructive"
              size="sm"
              onClick={(e) => {
                e.stopPropagation();
                setShowConfirm(true);
              }}
              disabled={isDownloading}
              title="Delete model"
            >
              <Trash2 className="h-4 w-4" />
            </Button>
          ) : (
            <div className="flex items-center gap-2">
              <Button
                variant="destructive"
                size="sm"
                onClick={(e) => {
                  e.stopPropagation();
                  onDelete();
                  setShowConfirm(false);
                }}
              >
                Confirm
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={(e) => {
                  e.stopPropagation();
                  setShowConfirm(false);
                }}
              >
                Cancel
              </Button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

interface RecommendedModelItemProps {
  modelName: string;
  category: string;
  isInstalled: boolean;
  isDownloading: boolean;
  onDownload: () => void;
}

const RecommendedModelItem: React.FC<RecommendedModelItemProps> = ({
  modelName,
  category,
  isInstalled,
  isDownloading,
  onDownload,
}) => {
  return (
    <div className="flex items-center justify-between p-3 border rounded-lg hover:bg-gray-50 transition-colors">
      <div className="flex items-center gap-3">
        {getCategoryIcon(category)}
        <div>
          <div className="font-medium text-gray-900">{modelName}</div>
          <div className="text-xs text-gray-500 capitalize">{category}</div>
        </div>
      </div>

      {isInstalled ? (
        <Badge variant="default" className="bg-green-100 text-green-700">
          <CheckCircle className="h-3 w-3 mr-1" />
          Installed
        </Badge>
      ) : (
        <Button
          size="sm"
          onClick={onDownload}
          disabled={isDownloading}
        >
          {isDownloading ? (
            <>
              <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              Downloading...
            </>
          ) : (
            <>
              <Download className="h-4 w-4 mr-2" />
              Download
            </>
          )}
        </Button>
      )}
    </div>
  );
};

// ============================================================================
// Main Component
// ============================================================================

const OllamaModelManager: React.FC<OllamaModelManagerProps> = ({
  className = '',
  showHeader = true,
  onModelSelect,
  autoRefreshInterval = 0,
}) => {
  const {
    models,
    isLoading,
    isAvailable,
    error,
    totalModels,
    totalSizeFormatted,
    fetchModels,
    pullModel,
    deleteModel,
    getRecommended,
  } = useOllamaModels();

  const [searchQuery, setSearchQuery] = useState('');
  const [downloadProgress, setDownloadProgress] = useState<Map<string, DownloadProgress>>(new Map());
  const [recommended, setRecommended] = useState<RecommendedModels | null>(null);
  const [showRecommended, setShowRecommended] = useState(false);
  const [modelToDownload, setModelToDownload] = useState('');

  // Auto-refresh
  useEffect(() => {
    if (autoRefreshInterval > 0) {
      const interval = setInterval(fetchModels, autoRefreshInterval);
      return () => clearInterval(interval);
    }
    return undefined;
  }, [autoRefreshInterval, fetchModels]);

  // Load recommended models
  useEffect(() => {
    const loadRecommended = async () => {
      const rec = await getRecommended();
      if (rec) setRecommended(rec);
    };
    loadRecommended();
  }, [getRecommended]);

  // Filter models by search
  const filteredModels = useMemo(() => {
    if (!searchQuery.trim()) return models;
    const query = searchQuery.toLowerCase();
    return models.filter(
      (m) =>
        m.name.toLowerCase().includes(query) ||
        m.family.toLowerCase().includes(query) ||
        m.parameterSize.toLowerCase().includes(query)
    );
  }, [models, searchQuery]);

  // Handle model download
  const handleDownload = useCallback(
    async (modelName: string) => {
      setDownloadProgress((prev) => {
        const next = new Map(prev);
        next.set(modelName, { modelName, status: 'downloading' });
        return next;
      });

      const success = await pullModel(modelName, (progress) => {
        setDownloadProgress((prev) => {
          const next = new Map(prev);
          next.set(modelName, { modelName, status: 'downloading', message: progress });
          return next;
        });
      });

      setDownloadProgress((prev) => {
        const next = new Map(prev);
        if (success) {
          next.set(modelName, { modelName, status: 'success' });
          setTimeout(() => {
            setDownloadProgress((p) => {
              const n = new Map(p);
              n.delete(modelName);
              return n;
            });
          }, 3000);
        } else {
          next.set(modelName, { modelName, status: 'error', message: 'Download failed' });
          setTimeout(() => {
            setDownloadProgress((p) => {
              const n = new Map(p);
              n.delete(modelName);
              return n;
            });
          }, 5000);
        }
        return next;
      });
    },
    [pullModel]
  );

  // Handle model deletion
  const handleDelete = useCallback(
    async (modelName: string) => {
      const success = await deleteModel(modelName);
      if (!success) {
        alert('Failed to delete model. Please try again.');
      }
    },
    [deleteModel]
  );

  // Handle custom model download
  const handleCustomDownload = useCallback(() => {
    if (modelToDownload.trim()) {
      handleDownload(modelToDownload.trim());
      setModelToDownload('');
    }
  }, [modelToDownload, handleDownload]);

  // Get all recommended models as flat list
  const allRecommendedModels = useMemo(() => {
    if (!recommended) return [];
    const list: Array<{ name: string; category: string }> = [];
    Object.entries(recommended).forEach(([category, names]: [string, string[]]) => {
      names.forEach((name: string) => list.push({ name, category }));
    });
    return list;
  }, [recommended]);

  return (
    <div className={`space-y-6 ${className}`}>
      {/* Header */}
      {showHeader && (
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Server className="h-8 w-8 text-blue-600" />
            <div>
              <h2 className="text-2xl font-bold text-gray-900">Ollama Model Manager</h2>
              <p className="text-sm text-gray-600">Manage your local AI models</p>
            </div>
          </div>
          <Button variant="outline" onClick={fetchModels} disabled={isLoading}>
            <RefreshCw className={`h-4 w-4 mr-2 ${isLoading ? 'animate-spin' : ''}`} />
            Refresh
          </Button>
        </div>
      )}

      {/* Status Banner */}
      {!isAvailable && (
        <Card className="border-yellow-200 bg-yellow-50">
          <CardContent className="p-4">
            <div className="flex items-center gap-2 text-yellow-800">
              <AlertCircle className="h-5 w-5" />
              <div>
                <p className="font-medium">Ollama is not available</p>
                <p className="text-sm text-yellow-700">
                  {error || 'Make sure Ollama is installed and running on your system.'}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Error Banner */}
      {error && isAvailable && (
        <Card className="border-red-200 bg-red-50">
          <CardContent className="p-4">
            <div className="flex items-center gap-2 text-red-800">
              <AlertCircle className="h-5 w-5" />
              <span>{error}</span>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Stats */}
      {isAvailable && (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <Card>
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-gray-600">Installed Models</p>
                  <p className="text-2xl font-bold text-gray-900">{totalModels}</p>
                </div>
                <Server className="h-8 w-8 text-blue-500" />
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-gray-600">Total Size</p>
                  <p className="text-2xl font-bold text-gray-900">{totalSizeFormatted}</p>
                </div>
                <HardDrive className="h-8 w-8 text-purple-500" />
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-gray-600">Status</p>
                  <p className="text-lg font-semibold text-green-600 flex items-center gap-2">
                    <CheckCircle className="h-5 w-5" />
                    Online
                  </p>
                </div>
                <Info className="h-8 w-8 text-green-500" />
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Download Model */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg flex items-center gap-2">
            <Download className="h-5 w-5 text-blue-600" />
            Download Model
          </CardTitle>
          <CardDescription>
            Download a new model from the Ollama library
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex gap-2">
            <Input
              placeholder="Enter model name (e.g., llama2, codellama, mistral)"
              value={modelToDownload}
              onChange={(e) => setModelToDownload(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') handleCustomDownload();
              }}
              disabled={!isAvailable}
            />
            <Button
              onClick={handleCustomDownload}
              disabled={!isAvailable || !modelToDownload.trim() || downloadProgress.has(modelToDownload.trim())}
            >
              <Download className="h-4 w-4 mr-2" />
              Download
            </Button>
          </div>

          {/* Recommended Models */}
          {allRecommendedModels.length > 0 && (
            <div>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setShowRecommended(!showRecommended)}
                className="mb-3"
              >
                <Sparkles className="h-4 w-4 mr-2" />
                {showRecommended ? 'Hide' : 'Show'} Recommended Models ({allRecommendedModels.length})
              </Button>

              {showRecommended && (
                <div className="space-y-2">
                  {allRecommendedModels.map(({ name, category }) => (
                    <RecommendedModelItem
                      key={`${category}-${name}`}
                      modelName={name}
                      category={category}
                      isInstalled={models.some((m) => m.name === name)}
                      isDownloading={downloadProgress.get(name)?.status === 'downloading'}
                      onDownload={() => handleDownload(name)}
                    />
                  ))}
                </div>
              )}
            </div>
          )}

          {/* Download Progress */}
          {downloadProgress.size > 0 && (
            <div className="space-y-2">
              {Array.from(downloadProgress.values()).map((progress) => (
                <div
                  key={progress.modelName}
                  className={`p-3 rounded-lg border ${
                    progress.status === 'downloading'
                      ? 'bg-blue-50 border-blue-200'
                      : progress.status === 'success'
                      ? 'bg-green-50 border-green-200'
                      : 'bg-red-50 border-red-200'
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      {progress.status === 'downloading' && (
                        <Loader2 className="h-4 w-4 animate-spin text-blue-600" />
                      )}
                      {progress.status === 'success' && (
                        <CheckCircle className="h-4 w-4 text-green-600" />
                      )}
                      {progress.status === 'error' && (
                        <AlertCircle className="h-4 w-4 text-red-600" />
                      )}
                      <span className="font-medium">{progress.modelName}</span>
                    </div>
                    <span className="text-sm text-gray-600">
                      {progress.status === 'downloading' && 'Downloading...'}
                      {progress.status === 'success' && 'Downloaded'}
                      {progress.status === 'error' && 'Failed'}
                    </span>
                  </div>
                  {progress.message && (
                    <p className="text-xs text-gray-500 mt-1">{progress.message}</p>
                  )}
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Installed Models */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Installed Models</CardTitle>
          <CardDescription>
            {totalModels} {totalModels === 1 ? 'model' : 'models'} installed
          </CardDescription>
        </CardHeader>
        <CardContent className="p-0">
          {/* Search */}
          <div className="p-4 border-b">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
              <Input
                type="text"
                placeholder="Search models..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-9 pr-9"
              />
              {searchQuery && (
                <button
                  onClick={() => setSearchQuery('')}
                  className="absolute right-3 top-1/2 -translate-y-1/2 p-0.5 hover:bg-gray-100 rounded"
                >
                  <X className="h-3.5 w-3.5 text-gray-400" />
                </button>
              )}
            </div>
          </div>

          {/* Model List */}
          {isLoading ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="h-8 w-8 animate-spin text-blue-600" />
              <span className="ml-3 text-gray-600">Loading models...</span>
            </div>
          ) : filteredModels.length === 0 ? (
            <div className="p-12 text-center text-gray-500">
              <Server className="h-12 w-12 mx-auto mb-3 text-gray-300" />
              <p className="font-medium">No models found</p>
              <p className="text-sm">
                {searchQuery ? 'Try adjusting your search' : 'Download a model to get started'}
              </p>
            </div>
          ) : (
            <ScrollArea className="max-h-96">
              {filteredModels.map((model) => (
                <ModelListItem
                  key={model.name}
                  model={model}
                  isDownloading={downloadProgress.get(model.name)?.status === 'downloading'}
                  onDelete={() => handleDelete(model.name)}
                  onClick={onModelSelect ? () => onModelSelect(model) : undefined}
                />
              ))}
            </ScrollArea>
          )}
        </CardContent>
      </Card>
    </div>
  );
};

export default OllamaModelManager;
