/**
 * Plugin Repository Service
 * Manages community plugin metadata, search, ratings, and downloads
 */

import { prisma } from '@/lib/prisma';
import { Prisma } from '@prisma/client';
import { createServiceLogger } from '@/lib/logging';

const logger = createServiceLogger({ service: 'vibecode-webgui', component: 'plugin-repository' });

/**
 * Plugin repository search criteria
 */
export interface PluginRepositorySearchCriteria {
  query?: string;                    // Text search across name, description
  category?: string;                 // Filter by category
  tags?: string[];                   // Filter by tags
  featured?: boolean;                // Show only featured plugins
  verified?: boolean;                // Show only verified plugins
  status?: string;                   // Filter by status (published, deprecated, etc.)
  authorId?: number;                 // Filter by author
  minRating?: number;                // Minimum average rating (1-5)
  sortBy?: 'downloads' | 'rating' | 'created' | 'updated'; // Sort order
  sortOrder?: 'asc' | 'desc';       // Sort direction
  limit?: number;                    // Results per page
  offset?: number;                   // Pagination offset
}

/**
 * Plugin repository with computed fields
 */
export interface PluginRepositoryInfo {
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

/**
 * Plugin version information
 */
export interface PluginVersionInfo {
  id: number;
  pluginId: number;
  version: string;
  changelog?: string;
  packageUrl: string;
  packageChecksum: string;
  compatibleVersions?: string[];
  downloadsCount: number;
  status: string;
  publishedAt: Date;
  createdAt: Date;
  updatedAt: Date;
}

/**
 * Plugin rating information
 */
export interface PluginRatingInfo {
  id: number;
  pluginId: number;
  userId: number;
  userName?: string;
  rating: number;
  title?: string;
  review?: string;
  helpfulCount: number;
  createdAt: Date;
  updatedAt: Date;
}

/**
 * Plugin search result
 */
export interface PluginSearchResult {
  plugins: PluginRepositoryInfo[];
  total: number;
  limit: number;
  offset: number;
}

/**
 * Plugin rating submission
 */
export interface PluginRatingSubmission {
  pluginId: number;
  userId: number;
  rating: number;           // 1-5 stars
  title?: string;
  review?: string;
}

/**
 * Plugin download tracking
 */
export interface PluginDownloadTracking {
  pluginId: number;
  versionId?: number;
  userId?: number;
  ipAddress?: string;
  userAgent?: string;
}

/**
 * Plugin publish request
 */
export interface PluginPublishRequest {
  name: string;
  displayName: string;
  description: string;
  authorId: number;
  category: string;
  tags?: string[];
  repositoryUrl?: string;
  homepageUrl?: string;
  iconUrl?: string;
  version: string;
  changelog?: string;
  packageUrl: string;
  packageChecksum: string;
  compatibleVersions?: string[];
}

/**
 * Search plugins in the repository
 */
export async function searchPlugins(
  criteria: PluginRepositorySearchCriteria
): Promise<PluginSearchResult> {
  try {
    const {
      query,
      category,
      tags,
      featured,
      verified,
      status = 'published',
      authorId,
      minRating,
      sortBy = 'downloads',
      sortOrder = 'desc',
      limit = 20,
      offset = 0
    } = criteria;

    // Build where clause
    const where: Prisma.PluginRepositoryWhereInput = {
      status,
      ...(category && { category }),
      ...(featured !== undefined && { featured }),
      ...(verified !== undefined && { verified }),
      ...(authorId && { author_id: authorId }),
      ...(minRating && { average_rating: { gte: minRating } }),
      ...(query && {
        OR: [
          { name: { contains: query, mode: 'insensitive' } },
          { display_name: { contains: query, mode: 'insensitive' } },
          { description: { contains: query, mode: 'insensitive' } }
        ]
      }),
      ...(tags && tags.length > 0 && {
        tags: {
          path: [],
          array_contains: tags
        }
      })
    };

    // Build order by clause
    const orderBy: Prisma.PluginRepositoryOrderByWithRelationInput = (() => {
      switch (sortBy) {
        case 'downloads':
          return { downloads_count: sortOrder };
        case 'rating':
          return { average_rating: sortOrder };
        case 'created':
          return { created_at: sortOrder };
        case 'updated':
          return { updated_at: sortOrder };
        default:
          return { downloads_count: sortOrder };
      }
    })();

    // Execute query with pagination
    const [plugins, total] = await Promise.all([
      prisma.pluginRepository.findMany({
        where,
        orderBy,
        take: limit,
        skip: offset,
        include: {
          author: {
            select: {
              id: true,
              name: true
            }
          },
          versions: {
            where: { status: 'active' },
            orderBy: { published_at: 'desc' },
            take: 1,
            select: {
              version: true
            }
          },
          ratings: {
            select: {
              id: true
            }
          }
        }
      }),
      prisma.pluginRepository.count({ where })
    ]);

    // Transform to PluginRepositoryInfo
    const pluginInfos: PluginRepositoryInfo[] = plugins.map((plugin): PluginRepositoryInfo => ({
      id: plugin.id,
      name: plugin.name,
      displayName: plugin.display_name,
      description: plugin.description,
      authorId: plugin.author_id,
      authorName: plugin.author.name ?? undefined,
      repositoryUrl: plugin.repository_url ?? undefined,
      homepageUrl: plugin.homepage_url ?? undefined,
      iconUrl: plugin.icon_url ?? undefined,
      category: plugin.category,
      tags: plugin.tags ? (Array.isArray(plugin.tags) ? plugin.tags as string[] : []) : undefined,
      downloadsCount: plugin.downloads_count,
      averageRating: plugin.average_rating ?? undefined,
      ratingsCount: plugin.ratings.length,
      status: plugin.status,
      featured: plugin.featured,
      verified: plugin.verified,
      latestVersion: plugin.versions[0]?.version ?? undefined,
      createdAt: plugin.created_at,
      updatedAt: plugin.updated_at
    }));

    return {
      plugins: pluginInfos,
      total,
      limit,
      offset
    };
  } catch (error) {
    logger.error('Failed to search plugins', { error, criteria });
    throw new Error(`Plugin search failed: ${(error as Error).message}`);
  }
}

/**
 * Get a plugin by ID
 */
export async function getPluginById(pluginId: number): Promise<PluginRepositoryInfo | null> {
  try {
    const plugin = await prisma.pluginRepository.findUnique({
      where: { id: pluginId },
      include: {
        author: {
          select: {
            id: true,
            name: true
          }
        },
        versions: {
          where: { status: 'active' },
          orderBy: { published_at: 'desc' },
          take: 1,
          select: {
            version: true
          }
        },
        ratings: {
          select: {
            id: true
          }
        }
      }
    });

    if (!plugin) {
      return null;
    }

    return {
      id: plugin.id,
      name: plugin.name,
      displayName: plugin.display_name,
      description: plugin.description,
      authorId: plugin.author_id,
      authorName: plugin.author.name ?? undefined,
      repositoryUrl: plugin.repository_url ?? undefined,
      homepageUrl: plugin.homepage_url ?? undefined,
      iconUrl: plugin.icon_url ?? undefined,
      category: plugin.category,
      tags: plugin.tags ? (Array.isArray(plugin.tags) ? plugin.tags as string[] : []) : undefined,
      downloadsCount: plugin.downloads_count,
      averageRating: plugin.average_rating ?? undefined,
      ratingsCount: plugin.ratings.length,
      status: plugin.status,
      featured: plugin.featured,
      verified: plugin.verified,
      latestVersion: plugin.versions[0]?.version ?? undefined,
      createdAt: plugin.created_at,
      updatedAt: plugin.updated_at
    };
  } catch (error) {
    logger.error('Failed to get plugin by ID', { error, pluginId });
    throw new Error(`Failed to get plugin: ${(error as Error).message}`);
  }
}

/**
 * Get a plugin by name
 */
export async function getPluginByName(name: string): Promise<PluginRepositoryInfo | null> {
  try {
    const plugin = await prisma.pluginRepository.findFirst({
      where: { name },
      include: {
        author: {
          select: {
            id: true,
            name: true
          }
        },
        versions: {
          where: { status: 'active' },
          orderBy: { published_at: 'desc' },
          take: 1,
          select: {
            version: true
          }
        },
        ratings: {
          select: {
            id: true
          }
        }
      }
    });

    if (!plugin) {
      return null;
    }

    return {
      id: plugin.id,
      name: plugin.name,
      displayName: plugin.display_name,
      description: plugin.description,
      authorId: plugin.author_id,
      authorName: plugin.author.name ?? undefined,
      repositoryUrl: plugin.repository_url ?? undefined,
      homepageUrl: plugin.homepage_url ?? undefined,
      iconUrl: plugin.icon_url ?? undefined,
      category: plugin.category,
      tags: plugin.tags ? (Array.isArray(plugin.tags) ? plugin.tags as string[] : []) : undefined,
      downloadsCount: plugin.downloads_count,
      averageRating: plugin.average_rating ?? undefined,
      ratingsCount: plugin.ratings.length,
      status: plugin.status,
      featured: plugin.featured,
      verified: plugin.verified,
      latestVersion: plugin.versions[0]?.version ?? undefined,
      createdAt: plugin.created_at,
      updatedAt: plugin.updated_at
    };
  } catch (error) {
    logger.error('Failed to get plugin by name', { error, name });
    throw new Error(`Failed to get plugin: ${(error as Error).message}`);
  }
}

/**
 * Publish a new plugin or new version of existing plugin
 */
export async function publishPlugin(request: PluginPublishRequest): Promise<PluginRepositoryInfo> {
  try {
    const {
      name,
      displayName,
      description,
      authorId,
      category,
      tags,
      repositoryUrl,
      homepageUrl,
      iconUrl,
      version,
      changelog,
      packageUrl,
      packageChecksum,
      compatibleVersions
    } = request;

    // Check if plugin already exists
    const existingPlugin = await prisma.pluginRepository.findFirst({
      where: { name }
    });

    let plugin;
    if (existingPlugin) {
      // Add new version to existing plugin
      const pluginVersion = await prisma.pluginVersion.create({
        data: {
          plugin_id: existingPlugin.id,
          version,
          changelog: changelog ?? null,
          package_url: packageUrl,
          package_checksum: packageChecksum,
          compatible_versions: compatibleVersions ?? Prisma.DbNull,
          status: 'active'
        }
      });

      // Update plugin metadata
      plugin = await prisma.pluginRepository.update({
        where: { id: existingPlugin.id },
        data: {
          display_name: displayName,
          description,
          repository_url: repositoryUrl ?? null,
          homepage_url: homepageUrl ?? null,
          icon_url: iconUrl ?? null,
          category,
          tags: tags ?? Prisma.DbNull,
          updated_at: new Date()
        },
        include: {
          author: {
            select: {
              id: true,
              name: true
            }
          },
          versions: {
            where: { status: 'active' },
            orderBy: { published_at: 'desc' },
            take: 1,
            select: {
              version: true
            }
          },
          ratings: {
            select: {
              id: true
            }
          }
        }
      });

      logger.info('Published new plugin version', {
        pluginId: plugin.id,
        name,
        version,
        versionId: pluginVersion.id
      });
    } else {
      // Create new plugin and version
      plugin = await prisma.pluginRepository.create({
        data: {
          name,
          display_name: displayName,
          description,
          author_id: authorId,
          category,
          tags: tags ?? Prisma.DbNull,
          repository_url: repositoryUrl ?? null,
          homepage_url: homepageUrl ?? null,
          icon_url: iconUrl ?? null,
          status: 'published',
          featured: false,
          verified: false,
          versions: {
            create: {
              version,
              changelog: changelog ?? null,
              package_url: packageUrl,
              package_checksum: packageChecksum,
              compatible_versions: compatibleVersions ?? Prisma.DbNull,
              status: 'active'
            }
          }
        },
        include: {
          author: {
            select: {
              id: true,
              name: true
            }
          },
          versions: {
            where: { status: 'active' },
            orderBy: { published_at: 'desc' },
            take: 1,
            select: {
              version: true
            }
          },
          ratings: {
            select: {
              id: true
            }
          }
        }
      });

      logger.info('Published new plugin', {
        pluginId: plugin.id,
        name,
        version
      });
    }

    return {
      id: plugin.id,
      name: plugin.name,
      displayName: plugin.display_name,
      description: plugin.description,
      authorId: plugin.author_id,
      authorName: plugin.author.name ?? undefined,
      repositoryUrl: plugin.repository_url ?? undefined,
      homepageUrl: plugin.homepage_url ?? undefined,
      iconUrl: plugin.icon_url ?? undefined,
      category: plugin.category,
      tags: plugin.tags ? (Array.isArray(plugin.tags) ? plugin.tags as string[] : []) : undefined,
      downloadsCount: plugin.downloads_count,
      averageRating: plugin.average_rating ?? undefined,
      ratingsCount: plugin.ratings.length,
      status: plugin.status,
      featured: plugin.featured,
      verified: plugin.verified,
      latestVersion: plugin.versions[0]?.version ?? undefined,
      createdAt: plugin.created_at,
      updatedAt: plugin.updated_at
    };
  } catch (error) {
    logger.error('Failed to publish plugin', { error, request });
    throw new Error(`Plugin publish failed: ${(error as Error).message}`);
  }
}

/**
 * Get all versions of a plugin
 */
export async function getPluginVersions(pluginId: number): Promise<PluginVersionInfo[]> {
  try {
    const versions = await prisma.pluginVersion.findMany({
      where: { plugin_id: pluginId },
      orderBy: { published_at: 'desc' }
    });

    return versions.map((version): PluginVersionInfo => ({
      id: version.id,
      pluginId: version.plugin_id,
      version: version.version,
      changelog: version.changelog ?? undefined,
      packageUrl: version.package_url,
      packageChecksum: version.package_checksum,
      compatibleVersions: version.compatible_versions
        ? (Array.isArray(version.compatible_versions) ? version.compatible_versions as string[] : [])
        : undefined,
      downloadsCount: version.downloads_count,
      status: version.status,
      publishedAt: version.published_at,
      createdAt: version.created_at,
      updatedAt: version.updated_at
    }));
  } catch (error) {
    logger.error('Failed to get plugin versions', { error, pluginId });
    throw new Error(`Failed to get plugin versions: ${(error as Error).message}`);
  }
}

/**
 * Get a specific plugin version
 */
export async function getPluginVersion(
  pluginId: number,
  version: string
): Promise<PluginVersionInfo | null> {
  try {
    const versionInfo = await prisma.pluginVersion.findFirst({
      where: {
        plugin_id: pluginId,
        version
      }
    });

    if (!versionInfo) {
      return null;
    }

    return {
      id: versionInfo.id,
      pluginId: versionInfo.plugin_id,
      version: versionInfo.version,
      changelog: versionInfo.changelog ?? undefined,
      packageUrl: versionInfo.package_url,
      packageChecksum: versionInfo.package_checksum,
      compatibleVersions: versionInfo.compatible_versions
        ? (Array.isArray(versionInfo.compatible_versions) ? versionInfo.compatible_versions as string[] : [])
        : undefined,
      downloadsCount: versionInfo.downloads_count,
      status: versionInfo.status,
      publishedAt: versionInfo.published_at,
      createdAt: versionInfo.created_at,
      updatedAt: versionInfo.updated_at
    };
  } catch (error) {
    logger.error('Failed to get plugin version', { error, pluginId, version });
    throw new Error(`Failed to get plugin version: ${(error as Error).message}`);
  }
}

/**
 * Submit or update a plugin rating
 */
export async function submitRating(submission: PluginRatingSubmission): Promise<PluginRatingInfo> {
  try {
    const { pluginId, userId, rating, title, review } = submission;

    // Validate rating value
    if (rating < 1 || rating > 5) {
      throw new Error('Rating must be between 1 and 5');
    }

    // Upsert rating
    const pluginRating = await prisma.pluginRating.upsert({
      where: {
        plugin_id_user_id: {
          plugin_id: pluginId,
          user_id: userId
        }
      },
      create: {
        plugin_id: pluginId,
        user_id: userId,
        rating,
        title: title ?? null,
        review: review ?? null
      },
      update: {
        rating,
        title: title ?? null,
        review: review ?? null,
        updated_at: new Date()
      },
      include: {
        user: {
          select: {
            id: true,
            name: true
          }
        }
      }
    });

    // Recalculate average rating
    await updateAverageRating(pluginId);

    logger.info('Rating submitted', {
      pluginId: pluginId.toString(),
      userId: userId.toString(),
      rating: rating.toString()
    });

    return {
      id: pluginRating.id,
      pluginId: pluginRating.plugin_id,
      userId: pluginRating.user_id,
      userName: pluginRating.user.name ?? undefined,
      rating: pluginRating.rating,
      title: pluginRating.title ?? undefined,
      review: pluginRating.review ?? undefined,
      helpfulCount: pluginRating.helpful_count,
      createdAt: pluginRating.created_at,
      updatedAt: pluginRating.updated_at
    };
  } catch (error) {
    logger.error('Failed to submit rating', { error, submission });
    throw new Error(`Rating submission failed: ${(error as Error).message}`);
  }
}

/**
 * Get ratings for a plugin
 */
export async function getPluginRatings(
  pluginId: number,
  limit = 10,
  offset = 0
): Promise<{ ratings: PluginRatingInfo[]; total: number }> {
  try {
    const [ratings, total] = await Promise.all([
      prisma.pluginRating.findMany({
        where: { plugin_id: pluginId },
        orderBy: [
          { helpful_count: 'desc' },
          { created_at: 'desc' }
        ],
        take: limit,
        skip: offset,
        include: {
          user: {
            select: {
              id: true,
              name: true
            }
          }
        }
      }),
      prisma.pluginRating.count({
        where: { plugin_id: pluginId }
      })
    ]);

    const ratingInfos = ratings.map((rating): PluginRatingInfo => ({
      id: rating.id,
      pluginId: rating.plugin_id,
      userId: rating.user_id,
      userName: rating.user.name ?? undefined,
      rating: rating.rating,
      title: rating.title ?? undefined,
      review: rating.review ?? undefined,
      helpfulCount: rating.helpful_count,
      createdAt: rating.created_at,
      updatedAt: rating.updated_at
    }));

    return { ratings: ratingInfos, total };
  } catch (error) {
    logger.error('Failed to get plugin ratings', { error, pluginId });
    throw new Error(`Failed to get ratings: ${(error as Error).message}`);
  }
}

/**
 * Track a plugin download
 */
export async function trackDownload(tracking: PluginDownloadTracking): Promise<void> {
  try {
    const { pluginId, versionId, userId, ipAddress, userAgent } = tracking;

    // Record download
    await prisma.pluginDownload.create({
      data: {
        plugin_id: pluginId,
        version_id: versionId ?? null,
        user_id: userId ?? null,
        ip_address: ipAddress ?? null,
        user_agent: userAgent ?? null
      }
    });

    // Increment plugin download count
    await prisma.pluginRepository.update({
      where: { id: pluginId },
      data: {
        downloads_count: {
          increment: 1
        }
      }
    });

    // Increment version download count if version specified
    if (versionId) {
      await prisma.pluginVersion.update({
        where: { id: versionId },
        data: {
          downloads_count: {
            increment: 1
          }
        }
      });
    }

    logger.debug('Download tracked', {
      pluginId: pluginId.toString(),
      versionId: versionId?.toString(),
      userId: userId?.toString()
    });
  } catch (error) {
    logger.error('Failed to track download', { error, tracking });
    // Don't throw error - download tracking is non-critical
  }
}

/**
 * Update plugin status (publish, unpublish, deprecate)
 */
export async function updatePluginStatus(
  pluginId: number,
  status: string
): Promise<PluginRepositoryInfo> {
  try {
    const plugin = await prisma.pluginRepository.update({
      where: { id: pluginId },
      data: {
        status,
        updated_at: new Date()
      },
      include: {
        author: {
          select: {
            id: true,
            name: true
          }
        },
        versions: {
          where: { status: 'active' },
          orderBy: { published_at: 'desc' },
          take: 1,
          select: {
            version: true
          }
        },
        ratings: {
          select: {
            id: true
          }
        }
      }
    });

    logger.info('Plugin status updated', { pluginId, status });

    return {
      id: plugin.id,
      name: plugin.name,
      displayName: plugin.display_name,
      description: plugin.description,
      authorId: plugin.author_id,
      authorName: plugin.author.name ?? undefined,
      repositoryUrl: plugin.repository_url ?? undefined,
      homepageUrl: plugin.homepage_url ?? undefined,
      iconUrl: plugin.icon_url ?? undefined,
      category: plugin.category,
      tags: plugin.tags ? (Array.isArray(plugin.tags) ? plugin.tags as string[] : []) : undefined,
      downloadsCount: plugin.downloads_count,
      averageRating: plugin.average_rating ?? undefined,
      ratingsCount: plugin.ratings.length,
      status: plugin.status,
      featured: plugin.featured,
      verified: plugin.verified,
      latestVersion: plugin.versions[0]?.version ?? undefined,
      createdAt: plugin.created_at,
      updatedAt: plugin.updated_at
    };
  } catch (error) {
    logger.error('Failed to update plugin status', { error, pluginId, status });
    throw new Error(`Failed to update plugin status: ${(error as Error).message}`);
  }
}

/**
 * Set plugin featured flag
 */
export async function setPluginFeatured(
  pluginId: number,
  featured: boolean
): Promise<PluginRepositoryInfo> {
  try {
    const plugin = await prisma.pluginRepository.update({
      where: { id: pluginId },
      data: {
        featured,
        updated_at: new Date()
      },
      include: {
        author: {
          select: {
            id: true,
            name: true
          }
        },
        versions: {
          where: { status: 'active' },
          orderBy: { published_at: 'desc' },
          take: 1,
          select: {
            version: true
          }
        },
        ratings: {
          select: {
            id: true
          }
        }
      }
    });

    logger.info('Plugin featured status updated', { pluginId, featured });

    return {
      id: plugin.id,
      name: plugin.name,
      displayName: plugin.display_name,
      description: plugin.description,
      authorId: plugin.author_id,
      authorName: plugin.author.name ?? undefined,
      repositoryUrl: plugin.repository_url ?? undefined,
      homepageUrl: plugin.homepage_url ?? undefined,
      iconUrl: plugin.icon_url ?? undefined,
      category: plugin.category,
      tags: plugin.tags ? (Array.isArray(plugin.tags) ? plugin.tags as string[] : []) : undefined,
      downloadsCount: plugin.downloads_count,
      averageRating: plugin.average_rating ?? undefined,
      ratingsCount: plugin.ratings.length,
      status: plugin.status,
      featured: plugin.featured,
      verified: plugin.verified,
      latestVersion: plugin.versions[0]?.version ?? undefined,
      createdAt: plugin.created_at,
      updatedAt: plugin.updated_at
    };
  } catch (error) {
    logger.error('Failed to set plugin featured status', { error, pluginId, featured });
    throw new Error(`Failed to set plugin featured status: ${(error as Error).message}`);
  }
}

/**
 * Set plugin verified flag
 */
export async function setPluginVerified(
  pluginId: number,
  verified: boolean
): Promise<PluginRepositoryInfo> {
  try {
    const plugin = await prisma.pluginRepository.update({
      where: { id: pluginId },
      data: {
        verified,
        updated_at: new Date()
      },
      include: {
        author: {
          select: {
            id: true,
            name: true
          }
        },
        versions: {
          where: { status: 'active' },
          orderBy: { published_at: 'desc' },
          take: 1,
          select: {
            version: true
          }
        },
        ratings: {
          select: {
            id: true
          }
        }
      }
    });

    logger.info('Plugin verified status updated', { pluginId, verified });

    return {
      id: plugin.id,
      name: plugin.name,
      displayName: plugin.display_name,
      description: plugin.description,
      authorId: plugin.author_id,
      authorName: plugin.author.name ?? undefined,
      repositoryUrl: plugin.repository_url ?? undefined,
      homepageUrl: plugin.homepage_url ?? undefined,
      iconUrl: plugin.icon_url ?? undefined,
      category: plugin.category,
      tags: plugin.tags ? (Array.isArray(plugin.tags) ? plugin.tags as string[] : []) : undefined,
      downloadsCount: plugin.downloads_count,
      averageRating: plugin.average_rating ?? undefined,
      ratingsCount: plugin.ratings.length,
      status: plugin.status,
      featured: plugin.featured,
      verified: plugin.verified,
      latestVersion: plugin.versions[0]?.version ?? undefined,
      createdAt: plugin.created_at,
      updatedAt: plugin.updated_at
    };
  } catch (error) {
    logger.error('Failed to set plugin verified status', { error, pluginId, verified });
    throw new Error(`Failed to set plugin verified status: ${(error as Error).message}`);
  }
}

/**
 * Internal helper: Update average rating for a plugin
 */
async function updateAverageRating(pluginId: number): Promise<void> {
  try {
    const result = await prisma.pluginRating.aggregate({
      where: { plugin_id: pluginId },
      _avg: {
        rating: true
      }
    });

    const averageRating = result._avg.rating;

    await prisma.pluginRepository.update({
      where: { id: pluginId },
      data: {
        average_rating: averageRating,
        updated_at: new Date()
      }
    });
  } catch (error) {
    logger.error('Failed to update average rating', { error, pluginId });
    throw error;
  }
}

/**
 * Get plugin download statistics
 */
export async function getPluginDownloadStats(
  pluginId: number,
  days = 30
): Promise<{ total: number; byDay: Array<{ date: string; count: number }> }> {
  try {
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - days);

    const downloads = await prisma.pluginDownload.findMany({
      where: {
        plugin_id: pluginId,
        created_at: {
          gte: startDate
        }
      },
      select: {
        created_at: true
      }
    });

    const total = downloads.length;

    // Group by day
    const byDayMap = new Map<string, number>();
    downloads.forEach((download: { created_at: Date }) => {
      const day = download.created_at.toISOString().split('T')[0];
      byDayMap.set(day, (byDayMap.get(day) || 0) + 1);
    });

    const byDay = Array.from(byDayMap.entries())
      .map(([date, count]) => ({ date, count }))
      .sort((a, b) => a.date.localeCompare(b.date));

    return { total, byDay };
  } catch (error) {
    logger.error('Failed to get download stats', { error, pluginId });
    throw new Error(`Failed to get download stats: ${(error as Error).message}`);
  }
}

/**
 * Get plugin categories with counts
 */
export async function getPluginCategories(): Promise<Array<{ category: string; count: number }>> {
  try {
    const result = await prisma.pluginRepository.groupBy({
      by: ['category'],
      where: {
        status: 'published'
      },
      _count: {
        id: true
      },
      orderBy: {
        _count: {
          id: 'desc'
        }
      }
    });

    return result.map((item): { category: string; count: number } => ({
      category: item.category,
      count: item._count.id
    }));
  } catch (error) {
    logger.error('Failed to get plugin categories', { error });
    throw new Error(`Failed to get plugin categories: ${(error as Error).message}`);
  }
}
