/**
 * Plugin Card Component
 * Display individual plugin information in the marketplace
 */

'use client';

import React from 'react';
import {
  StarIcon as StarIconOutline,
  ArrowDownTrayIcon,
  UserIcon,
  TagIcon,
  CheckBadgeIcon,
  ClockIcon
} from '@heroicons/react/24/outline';
import { StarIcon as StarIconSolidFilled } from '@heroicons/react/24/solid';

export interface PluginCardData {
  id: number;
  name: string;
  displayName: string;
  description: string;
  authorId: number;
  authorName?: string;
  repositoryUrl?: string;
  homepageUrl?: string;
  iconUrl?: string;
  category: string;
  tags?: string[];
  downloadsCount: number;
  averageRating?: number;
  ratingsCount?: number;
  status: string;
  featured: boolean;
  verified: boolean;
  latestVersion?: string;
  createdAt: Date;
  updatedAt: Date;
}

interface PluginCardProps {
  plugin: PluginCardData;
  onInstall?: (plugin: PluginCardData) => void;
  onCardClick?: (plugin: PluginCardData) => void;
  isInstalled?: boolean;
  isInstalling?: boolean;
  selectedPluginId?: number;
  className?: string;
}

export function PluginCard({
  plugin,
  onInstall,
  onCardClick,
  isInstalled = false,
  isInstalling = false,
  selectedPluginId,
  className = ''
}: PluginCardProps) {
  const renderStars = (rating: number, size: 'sm' | 'md' | 'lg' = 'sm') => {
    const sizeClasses = {
      sm: 'h-4 w-4',
      md: 'h-5 w-5',
      lg: 'h-6 w-6'
    };

    const stars = [];
    const fullStars = Math.floor(rating);
    const hasHalfStar = rating % 1 >= 0.5;

    // Full stars
    for (let i = 0; i < fullStars; i++) {
      stars.push(
        <StarIconSolidFilled key={i} className={`${sizeClasses[size]} text-yellow-400`} />
      );
    }

    // Half star (if needed)
    if (hasHalfStar) {
      stars.push(
        <div key="half" className={`relative ${sizeClasses[size]}`}>
          <StarIconOutline className="text-yellow-400" />
          <div className="absolute inset-0 overflow-hidden w-1/2">
            <StarIconSolidFilled className="text-yellow-400" />
          </div>
        </div>
      );
    }

    // Empty stars
    const remainingStars = 5 - fullStars - (hasHalfStar ? 1 : 0);
    for (let i = 0; i < remainingStars; i++) {
      stars.push(
        <StarIconOutline key={`empty-${i}`} className={`${sizeClasses[size]} text-gray-300`} />
      );
    }

    return stars;
  };

  const formatNumber = (num: number): string => {
    if (num >= 1000000) {
      return `${(num / 1000000).toFixed(1)}M`;
    }
    if (num >= 1000) {
      return `${(num / 1000).toFixed(1)}K`;
    }
    return num.toString();
  };

  const handleInstallClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    onInstall?.(plugin);
  };

  return (
    <div
      className={`bg-white rounded-lg border ${
        selectedPluginId === plugin.id
          ? 'border-blue-500 ring-2 ring-blue-200'
          : 'border-gray-200 hover:border-gray-300'
      } overflow-hidden hover:shadow-md transition-all cursor-pointer ${className}`}
      onClick={() => onCardClick?.(plugin)}
    >
      {/* Plugin Icon/Preview */}
      <div className="aspect-video bg-gray-100 relative">
        {plugin.iconUrl ? (
          <img
            src={plugin.iconUrl}
            alt={plugin.displayName}
            className="w-full h-full object-cover"
          />
        ) : (
          <div className="w-full h-full flex items-center justify-center bg-gradient-to-br from-blue-50 to-indigo-100">
            <div className="text-center">
              <div className="w-16 h-16 bg-blue-600 rounded-lg mx-auto mb-2 flex items-center justify-center">
                <span className="text-white font-bold text-xl">
                  {plugin.displayName.charAt(0).toUpperCase()}
                </span>
              </div>
              <p className="text-sm text-gray-600">No icon</p>
            </div>
          </div>
        )}

        {/* Featured Badge */}
        {plugin.featured && (
          <div className="absolute top-2 left-2 bg-yellow-500 text-white text-xs px-2 py-1 rounded-full font-medium">
            Featured
          </div>
        )}

        {/* Verified Badge */}
        {plugin.verified && (
          <div className="absolute top-2 right-2 bg-blue-500 text-white text-xs px-2 py-1 rounded-full font-medium flex items-center">
            <CheckBadgeIcon className="h-3 w-3 mr-1" />
            Verified
          </div>
        )}

        {/* Installed Badge */}
        {isInstalled && (
          <div className="absolute bottom-2 right-2 bg-green-500 text-white text-xs px-2 py-1 rounded-full font-medium">
            Installed
          </div>
        )}
      </div>

      {/* Plugin Info */}
      <div className="p-4">
        <div className="flex items-start justify-between mb-2">
          <div className="flex-1">
            <h3 className="font-semibold text-gray-900 truncate">{plugin.displayName}</h3>
            <p className="text-sm text-gray-600 line-clamp-2 mt-1">
              {plugin.description}
            </p>
          </div>
        </div>

        {/* Stats */}
        <div className="flex items-center space-x-4 text-sm text-gray-500 mb-3">
          {plugin.averageRating !== undefined && plugin.averageRating > 0 ? (
            <div className="flex items-center">
              {renderStars(plugin.averageRating)}
              <span className="ml-1">{plugin.averageRating.toFixed(1)}</span>
              {plugin.ratingsCount !== undefined && plugin.ratingsCount > 0 && (
                <span className="ml-1 text-xs">({plugin.ratingsCount})</span>
              )}
            </div>
          ) : (
            <div className="flex items-center text-xs text-gray-400">
              No ratings yet
            </div>
          )}
          <div className="flex items-center">
            <ArrowDownTrayIcon className="h-4 w-4 mr-1" />
            {formatNumber(plugin.downloadsCount)}
          </div>
        </div>

        {/* Version and Category */}
        <div className="flex items-center justify-between text-xs text-gray-500 mb-3">
          <span className="bg-gray-100 px-2 py-1 rounded">
            {plugin.category}
          </span>
          {plugin.latestVersion && (
            <span className="text-gray-600">
              v{plugin.latestVersion}
            </span>
          )}
        </div>

        {/* Tags */}
        {plugin.tags && plugin.tags.length > 0 && (
          <div className="flex flex-wrap gap-1 mb-3">
            {plugin.tags.slice(0, 3).map((tag) => (
              <span
                key={tag}
                className="inline-flex items-center px-2 py-1 rounded-full text-xs bg-gray-100 text-gray-700"
              >
                <TagIcon className="h-3 w-3 mr-1" />
                {tag}
              </span>
            ))}
            {plugin.tags.length > 3 && (
              <span className="text-xs text-gray-500">+{plugin.tags.length - 3} more</span>
            )}
          </div>
        )}

        {/* Metadata and Install Button */}
        <div className="flex items-center justify-between pt-3 border-t border-gray-200">
          <div className="flex items-center text-sm text-gray-500">
            <UserIcon className="h-4 w-4 mr-1" />
            <span className="truncate">{plugin.authorName || 'Unknown'}</span>
          </div>
          <button
            onClick={handleInstallClick}
            disabled={isInstalled || isInstalling}
            className={`px-3 py-1.5 text-sm font-medium rounded-md transition-colors ${
              isInstalled
                ? 'bg-gray-100 text-gray-500 cursor-not-allowed'
                : isInstalling
                ? 'bg-blue-100 text-blue-600 cursor-wait'
                : 'bg-blue-600 text-white hover:bg-blue-700'
            }`}
          >
            {isInstalled ? 'Installed' : isInstalling ? 'Installing...' : 'Install'}
          </button>
        </div>

        {/* Last Updated */}
        <div className="flex items-center text-xs text-gray-400 mt-2">
          <ClockIcon className="h-3 w-3 mr-1" />
          Updated {new Date(plugin.updatedAt).toLocaleDateString()}
        </div>
      </div>
    </div>
  );
}
