jest.mock('@/components/ui', () => ({
  Button: (props) => <button {...props} />,
  Textarea: (props) => <textarea {...props} />,
  Card: ({ children, ...props }) => <div {...props}>{children}</div>,
  CardContent: ({ children, ...props }) => <div {...props}>{children}</div>,
  Badge: ({ children, ...props }) => <div {...props}>{children}</div>,
  ScrollArea: ({ children, ...props }) => <div {...props}>{children}</div>,
}));

jest.mock('swr', () => ({
  __esModule: true,
  default: jest.fn(() => ({
    data: { messages: [] },
    error: null,
    isLoading: false,
    mutate: jest.fn(),
  })),
}));

jest.mock('ai/react', () => ({
  useChat: jest.fn().mockImplementation(() => ({
    messages: [
      { id: '1', role: 'user', content: 'Hello' },
      { id: '2', role: 'assistant', content: 'Hi there!' },
    ],
    input: '',
    handleInputChange: jest.fn(),
    handleSubmit: jest.fn(),
    isLoading: false,
    error: null,
    stop: jest.fn(),
  })),
}));
