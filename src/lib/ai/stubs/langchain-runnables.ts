export class RunnableSequence<Input = unknown, Output = string> {
  static from<StepInput = unknown, StepOutput = string>(_steps: unknown[]): RunnableSequence<StepInput, StepOutput> {
    return new RunnableSequence<StepInput, StepOutput>()
  }

  async invoke(_input: Input): Promise<Output> {
    return 'Stubbed runnable output' as unknown as Output
  }
}
