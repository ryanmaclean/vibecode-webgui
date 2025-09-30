'use client';

import React, { useEffect, useMemo, useRef, useState } from 'react';
import { createConnectTransport } from '@connectrpc/connect-web';
import { createPromiseClient } from '@connectrpc/connect';
import { Status } from './Status';
import Editor, { EditorProps, Monaco } from '@monaco-editor/react';
import { editor } from 'monaco-editor/esm/vs/editor/editor.api';
import { getDefaultValue } from './defaultValues';

import { LanguageServerService } from '../../api/proto/exa/language_server_pb/language_server_connect';
import { InlineCompletionProvider } from './InlineCompletionProvider';
import { CodeiumLogo } from '../CodeiumLogo/CodeiumLogo';
import { Document } from '../../models';
import { deepMerge } from '../../utils/merge';

export interface CodeiumEditorProps extends EditorProps {
  language: string;
  apiKey?: string;
  /**
   * Optional callback to detect when completions are accepted. Includes the accepted text for the completion.
   */
  onAutocomplete?: (acceptedText: string) => void;

  /**
   * Optional address of the Language Server. This should not be needed for most use cases. Defaults
   * to Codeium's language server.
   */
  languageServerAddress?: string;

  /**
   * Optional list of other documents in the workspace. This can be used to provide additional
   * context to Codeium beyond simply the current document. There is a limit of 10 medium sized
   * documents.
   */
  otherDocuments?: Document[];

  /**
   * Optional classname for the container.
   */
  containerClassName?: string;

  /**
   * Optional styles for the container.
   */
  containerStyle?: React.CSSProperties;

  /**
   * Optional multiline model threshold. Should not be needed for most use cases.
   * Numerical value between 0-1, higher = more single line, lower = more multiline,
   * 0.0 = only_multiline.
   */
  multilineModelThreshold?: number;
}

/**
 * Code editor that enables Codeium AI suggestions in the editor.
 * The layout by default is width = 100% and height = 300px. These values can be overridden by passing in a string value to the width and/or height props.
 */
export const CodeiumEditor: React.FC<CodeiumEditorProps> = ({
  languageServerAddress = 'https://web-backend.codeium.com',
  otherDocuments = [],
  containerClassName = '',
  containerStyle = {},
  ...props
}) => {
  const {
    apiKey,
    multilineModelThreshold,
    onAutocomplete,
    options,
    language,
    width,
    height,
    ...restEditorProps
  } = props;
  const editorRef = useRef<editor.IStandaloneCodeEditor | null>(null);
  const monacoRef = useRef<Monaco | null>(null);
  const inlineCompletionsProviderRef = useRef<InlineCompletionProvider | null>(
    null,
  );
  const [completionCount, setCompletionCount] = useState(0);
  const [acceptedCompletionCount, setAcceptedCompletionCount] = useState(0);
  const [codeiumStatus, setCodeiumStatus] = useState(Status.INACTIVE);
  const [codeiumStatusMessage, setCodeiumStatusMessage] = useState('');
  const [isEditorReady, setIsEditorReady] = useState(false);

  const transport = useMemo(() => {
    return createConnectTransport({
      baseUrl: languageServerAddress,
      useBinaryFormat: true,
    });
  }, [languageServerAddress]);

  const grpcClient = useMemo(() => {
    return createPromiseClient(LanguageServerService, transport);
  }, [transport]);

  const completionProvider = useMemo(
    () =>
      new InlineCompletionProvider(
        grpcClient,
        setCompletionCount,
        setCodeiumStatus,
        setCodeiumStatusMessage,
        apiKey,
        multilineModelThreshold,
      ),
    [
      grpcClient,
      apiKey,
      multilineModelThreshold,
      setCompletionCount,
      setCodeiumStatus,
      setCodeiumStatusMessage,
    ],
  );

  useEffect(() => {
    inlineCompletionsProviderRef.current = completionProvider;
  }, [completionProvider]);

  useEffect(() => {
    if (!isEditorReady || !monacoRef.current) {
      return;
    }

    const monacoInstance = monacoRef.current;
    const providerDisposable = monacoInstance.languages.registerInlineCompletionsProvider(
      { pattern: '**' },
      completionProvider,
    );
    const completionDisposable = monacoInstance.editor.registerCommand(
      'codeium.acceptCompletion',
      (_: unknown, completionId: string, insertText: string) => {
        if (onAutocomplete) {
          onAutocomplete(insertText);
        }
        setAcceptedCompletionCount((prev) => prev + 1);
        completionProvider.acceptedLastCompletion(completionId);
      },
    );

    return () => {
      providerDisposable.dispose();
      completionDisposable.dispose();
    };
  }, [completionProvider, isEditorReady, onAutocomplete]);

  const handleEditorDidMount = async (
    editor: editor.IStandaloneCodeEditor,
    monaco: Monaco,
  ) => {
    editorRef.current = editor;
    monacoRef.current = monaco;
    setIsEditorReady(true);

    // CORS pre-flight cache optimization.
    try {
      await grpcClient.getCompletions({});
    } catch {
      // This is expected.
    }

    // Pass the editor instance to the user defined onMount prop.
    if (props.onMount) {
      props.onMount(editor, monaco);
    }
  };

  // Keep other documents up to date.
  useEffect(() => {
    completionProvider.updateOtherDocuments(otherDocuments);
  }, [completionProvider, otherDocuments]);

  const defaultLanguageProps: EditorProps = {
    defaultLanguage: language,
    defaultValue: getDefaultValue(language),
  };

  const layout = {
    width: width || '100%',
    // The height is set to 300px by default. Otherwise, the editor when
    // rendered with the default value will not be visible.
    // The monaco editor's default height is 100% but it requires the user to
    // define a container with an explicit height.
    height: height || '300px',
  };

  return (
    <div
      style={{
        ...layout,
        position: 'relative',
        ...containerStyle,
      }}
      className={containerClassName}
    >
      <a
        href={'https://codeium.com?referrer=codeium-editor'}
        target="_blank"
        rel="noreferrer noopener"
      >
        <CodeiumLogo
          width={30}
          height={30}
          style={{ position: 'absolute', top: 12, right: 12, zIndex: 1 }}
        />
      </a>
      <Editor
        {...defaultLanguageProps}
        {...restEditorProps}
        width={layout.width}
        height={layout.height}
        onMount={handleEditorDidMount}
        options={deepMerge<editor.IStandaloneEditorConstructionOptions>(
          options,
          {
            scrollBeyondLastColumn: 0,
            scrollbar: {
              alwaysConsumeMouseWheel: false,
            },
            codeLens: false,
            // for resizing, but apparently might have "severe performance impact"
            // automaticLayout: true,
            minimap: {
              enabled: false,
            },
            quickSuggestions: false,
            folding: false,
            foldingHighlight: false,
            foldingImportsByDefault: false,
            links: false,
            fontSize: 14,
            wordWrap: 'on',
          },
        )}
      />
      <div
        style={{
          position: 'absolute',
          bottom: 12,
          left: 12,
          padding: '8px 12px',
          borderRadius: 8,
          background: 'rgba(12, 14, 20, 0.72)',
          color: '#EEF2FF',
          fontSize: 12,
          maxWidth: '60%',
        }}
        aria-live="polite"
      >
        <div style={{ fontWeight: 600, marginBottom: 4 }}>
          {isEditorReady ? 'Codeium ready' : 'Initializing Codeium…'}
        </div>
        <div>Status: {codeiumStatus}</div>
        {codeiumStatusMessage && (
          <div style={{ marginTop: 2 }}>{codeiumStatusMessage}</div>
        )}
        <div style={{ marginTop: 4 }}>
          Generated suggestions: {completionCount}
        </div>
        <div>Accepted suggestions: {acceptedCompletionCount}</div>
      </div>
    </div>
  );
};
