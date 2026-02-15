'use client';

import React, { useState, useCallback } from 'react';
import { ChatInterface } from '@/components/ai/ChatInterface';
import { ErrorBoundary } from '@/components/error/ErrorBoundary';
import { ConfirmationDialog } from '@/components/agent/ConfirmationDialog';
import type { ConfirmationRequest } from '@/types/agent-confirmation';

export default function ChatPage() {
  // State for managing pending confirmations from agent
  const [pendingConfirmations, setPendingConfirmations] = useState<ConfirmationRequest[]>([]);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);

  // Handle approval of individual action
  const handleApprove = useCallback(async (requestId: string) => {
    setIsProcessing(true);
    try {
      // TODO: Call API to approve the action
      // await fetch(`/api/agents/confirm/${requestId}`, { method: 'POST', body: JSON.stringify({ approved: true }) })

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
      // TODO: Call API to reject the action
      // await fetch(`/api/agents/confirm/${requestId}`, { method: 'POST', body: JSON.stringify({ approved: false }) })

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

      // TODO: Call API to bulk approve actions
      // await fetch('/api/agents/confirm/bulk', { method: 'POST', body: JSON.stringify({ request_ids: bulkApprovableIds }) })

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

  // TODO: In Phase 4, this will be replaced with actual agent event listener
  // Example:
  // useEffect(() => {
  //   const handleConfirmationRequired = (event: ConfirmationRequiredEvent) => {
  //     setPendingConfirmations((prev) => [...prev, event.request]);
  //     setIsDialogOpen(true);
  //   };
  //
  //   agent?.on(AgentEvent.ConfirmationRequired, handleConfirmationRequired);
  //
  //   return () => {
  //     agent?.off(AgentEvent.ConfirmationRequired, handleConfirmationRequired);
  //   };
  // }, [agent]);

  return (
    <div className="container mx-auto p-4">
      <h1 className="text-2xl font-bold mb-4">AI Chat</h1>
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
