'use client';

import React, { useState, useCallback } from 'react';
import { useTranslations } from 'next-intl';
import { ChatInterface } from '@/components/ai/ChatInterface';
import { ErrorBoundary } from '@/components/error/ErrorBoundary';
import { ConfirmationDialog } from '@/components/agent/ConfirmationDialog';
import type { ConfirmationRequest } from '@/types/agent-confirmation';

export default function ChatPage() {
  const t = useTranslations()

  // State for managing pending confirmations from agent
  const [pendingConfirmations, setPendingConfirmations] = useState<ConfirmationRequest[]>([]);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);

  // Handle approval of individual action
  const handleApprove = useCallback(async (requestId: string) => {
    setIsProcessing(true);
    try {
      const response = await fetch(`/api/agents/confirmations/${requestId}/approve`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({}),
      });
      if (!response.ok) {
        throw new Error(`Approval failed: ${response.status}`);
      }

      // Remove from pending confirmations
      setPendingConfirmations((prev) =>
        prev.filter((c) => c.request_id !== requestId)
      );

      // Close dialog if no more pending confirmations
      setPendingConfirmations((current) => {
        if (current.length === 0) {
          setIsDialogOpen(false);
        }
        return current;
      });
    } catch (error) {
      console.error('Failed to approve action:', error);
    } finally {
      setIsProcessing(false);
    }
  }, []);

  // Handle rejection of individual action
  const handleReject = useCallback(async (requestId: string) => {
    setIsProcessing(true);
    try {
      const response = await fetch(`/api/agents/confirmations/${requestId}/reject`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({}),
      });
      if (!response.ok) {
        throw new Error(`Rejection failed: ${response.status}`);
      }

      // Remove from pending confirmations
      setPendingConfirmations((prev) =>
        prev.filter((c) => c.request_id !== requestId)
      );

      // Close dialog if no more pending confirmations
      setPendingConfirmations((current) => {
        if (current.length === 0) {
          setIsDialogOpen(false);
        }
        return current;
      });
    } catch (error) {
      console.error('Failed to reject action:', error);
    } finally {
      setIsProcessing(false);
    }
  }, []);

  // Handle bulk approval of all bulk-approvable actions
  const handleBulkApprove = useCallback(async () => {
    setIsProcessing(true);
    try {
      const bulkApprovableIds = pendingConfirmations
        .filter((c) => c.bulk_approvable)
        .map((c) => c.request_id);

      // Approve each bulk-approvable request in parallel (no dedicated bulk endpoint exists)
      await Promise.all(
        bulkApprovableIds.map((id) =>
          fetch(`/api/agents/confirmations/${id}/approve`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({}),
          }).then((res) => {
            if (!res.ok) throw new Error(`Bulk approval failed for ${id}: ${res.status}`);
          })
        )
      );

      // Remove approved confirmations from pending list
      setPendingConfirmations((prev) =>
        prev.filter((c) => !bulkApprovableIds.includes(c.request_id))
      );

      // Close dialog if no more pending confirmations
      setPendingConfirmations((current) => {
        if (current.length === 0) {
          setIsDialogOpen(false);
        }
        return current;
      });
    } catch (error) {
      console.error('Failed to bulk approve actions:', error);
    } finally {
      setIsProcessing(false);
    }
  }, [pendingConfirmations]);

  return (
    <div className="container mx-auto p-4">
      <h1 className="text-2xl font-bold mb-4">{t('chat.heading')}</h1>
      <ErrorBoundary>
        <ChatInterface />
      </ErrorBoundary>

      {/* Confirmation Dialog for agent actions */}
      <ConfirmationDialog
        isOpen={isDialogOpen}
        onClose={() => setIsDialogOpen(false)}
        confirmations={pendingConfirmations}
        onApprove={handleApprove}
        onReject={handleReject}
        onBulkApprove={handleBulkApprove}
        bulkApprovalEnabled={true}
        isProcessing={isProcessing}
      />
    </div>
  );
}
