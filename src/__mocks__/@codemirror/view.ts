/* eslint-env browser */
export const EditorView = {
  update: (view: any, updates: any) => {
    // Mock implementation
    return view;
  },
  dom: {
    contentDOM: document.createElement('div'),
    scrollDOM: document.createElement('div'),
    editor: document.createElement('div')
  }
};
