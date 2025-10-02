export const EditorState = {
  create: jest.fn().mockReturnValue({
    field: jest.fn()
  }),
  transactionExtender: jest.fn()
};

export const StateField = {
  define: jest.fn()
};

export const Prec = {
  highest: jest.fn()
};
