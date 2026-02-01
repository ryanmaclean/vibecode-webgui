import { parseImportsFromContent } from '@/lib/editor/import-parsing'

describe('parseImportsFromContent', () => {
  it('extracts JS/TS imports', () => {
    const content = "import React from 'react'\nimport { useState } from 'react'\n"
    const result = parseImportsFromContent(content)
    expect(result.imports).toContain('react')
  })

  it('extracts python imports', () => {
    const content = "import os, sys\nfrom collections import defaultdict\n"
    const result = parseImportsFromContent(content)
    expect(result.imports).toEqual(expect.arrayContaining(['os', 'sys', 'collections']))
  })

  it('extracts rust use paths', () => {
    const content = `use std::collections::HashMap;
use crate::services::api;
use super::config::Settings;
use serde::{Deserialize, Serialize};
extern crate anyhow;
`
    const result = parseImportsFromContent(content)
    expect(result.imports).toEqual(
      expect.arrayContaining(['std', 'services', 'config', 'serde', 'anyhow'])
    )
  })
})
