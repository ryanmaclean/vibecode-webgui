export class RunnableSequence {
  static from(_steps: unknown[]): RunnableSequence {
    return new RunnableSequence()
  }

  async invoke(_input: unknown): Promise<{ output: string }> {
    return { output: 'Stubbed runnable output' }
  }
}
