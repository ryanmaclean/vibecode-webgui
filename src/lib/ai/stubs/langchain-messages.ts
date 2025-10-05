export class BaseMessage {
  content: string
  constructor(content: string) {
    this.content = content
  }
}

export class HumanMessage extends BaseMessage {}
export class SystemMessage extends BaseMessage {}
export class AIMessage extends BaseMessage {}
