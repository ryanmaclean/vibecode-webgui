import SequentialThinking from '@/components/SequentialThinking';
import { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Sequential Thinking | VibeCode',
  description: 'Break down complex problems into structured thinking steps',
};

export default function SequentialThinkingPage() {
  return <SequentialThinking />;
}