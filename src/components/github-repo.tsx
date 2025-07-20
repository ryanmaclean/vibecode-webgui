import React from 'react';

interface GitHubRepoProps {
  owner: string;
  name: string;
  stars: number;
  url: string;
  description: string;
}

export const GithubRepo: React.FC<GitHubRepoProps> = ({ owner, name, stars, url, description }) => {
  return (
    <div className="not-prose rounded-xl bg-gray-800 p-4 text-white border border-gray-600">
      <h3 className="text-lg font-bold">
        <a href={url} target="_blank" rel="noopener noreferrer" className="hover:underline">
          {owner}/{name}
        </a>
      </h3>
      <p className="text-sm text-gray-300 mt-1">{description}</p>
      <div className="mt-3">
        <span className="text-yellow-400">★ {stars.toLocaleString()}</span>
      </div>
    </div>
  );
};
