// Health check endpoint for VibeCode Chat-UI
import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';

export const GET: RequestHandler = async () => {
	try {
		// Basic health check - can be extended with DB connectivity checks
		const health = {
			status: 'healthy',
			timestamp: new Date().toISOString(),
			uptime: process.uptime(),
			version: '1.0.0',
			service: 'vibecode-chat-ui'
		};

		return json(health, { status: 200 });
	} catch (error) {
		return json(
			{
				status: 'unhealthy',
				timestamp: new Date().toISOString(),
				error: error instanceof Error ? error.message : 'Unknown error'
			},
			{ status: 500 }
		);
	}
};