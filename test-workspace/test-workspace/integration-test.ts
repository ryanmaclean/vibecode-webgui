export interface TestInterface {
  id: string
  name: string
  value: number | string
}

export class TestClass implements TestInterface {
  constructor(
    public id: string,
    public name: string,
    public value: number
  ) {}

  public getValue(): number {
    return this.value * 2
  }
}
