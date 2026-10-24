#!/usr/bin/env nu
# scripts/repo-inventory.nu — machine-readable repository inventory for
# issue #2125 (phase 0: measure before deleting).
#
# Reads only git plumbing for one ref (no checkout, no build), so it is
# reproducible from any clone:
#   nu scripts/repo-inventory.nu --ref origin/main --out docs/reports/repo-cleanup-2026-09/inventory.json
#
# Output schema: vibecode.repo-inventory/v1

const SCHEMA = "vibecode.repo-inventory/v1"

# Tracked-file patterns that phase 1 may remove after verification.
const BACKUP_RE = '(\.backup$|\.bak$|\.bak\.|\.conflict-backup-|\.from-merge$|\.orig$|\.rej$|~$|\.swp$)'
# Runtime/generated artifacts that should not be tracked.
const GENERATED_RE = '((^|/)(coverage|test-results|playwright-report|\.next|__pycache__)/|\.log$|\.log\.[0-9]|\.log\.gz$|\.tsbuildinfo$|(^|/)gitea/data/|\.db$|\.sqlite3?$|\.pyc$|(^|/)\.DS_Store$)'

def ls-tree [ref: string]: nothing -> table {
    ^git ls-tree -r -l --full-tree $ref
    | lines
    | parse --regex '^(?<mode>\d+) (?<type>\w+) (?<sha>[0-9a-f]+)\s+(?<size>\S+)\t(?<path>.*)$'
    | where type == "blob"
    | update size {|r| if $r.size == "-" { 0 } else { $r.size | into int } }
}

# Sum one numeric column; 0 for an empty table.
def sum-of [t: list<any>, col: string]: nothing -> int {
    if ($t | is-empty) { 0 } else { $t | get $col | math sum }
}

def trees [ref: string]: nothing -> table {
    ^git ls-tree -r -t -d --full-tree $ref
    | lines
    | parse --regex '^(?<mode>\d+) (?<type>\w+) (?<sha>[0-9a-f]+)\t(?<path>.*)$'
}

def main [
    --ref: string = "HEAD"   # git ref to inventory
    --out: string = ""       # write JSON here (default: stdout)
    --top-files: int = 100
    --top-dirs: int = 50
    --top-dupes: int = 100
] {
    let commit = (^git rev-parse $ref | str trim)
    let files = (ls-tree $ref)
    let total = ($files | get size | math sum)

    # Every ancestor directory is credited with each file's bytes.
    let dir_bytes = ($files
        | each {|f|
            let parts = ($f.path | split row "/" | drop 1)
            0..<($parts | length) | each {|i| {dir: ($parts | first ($i + 1) | str join "/"), size: $f.size} }
        }
        | flatten
        | group-by dir
        | transpose dir rows
        | each {|g| {dir: $g.dir, files: ($g.rows | length), bytes: ($g.rows | get size | math sum)} }
        | sort-by bytes --reverse)

    # Identical content = identical blob sha; wasted = bytes beyond the first copy.
    let dupes = ($files
        | group-by sha
        | transpose sha rows
        | where {|g| ($g.rows | length) > 1 }
        | each {|g|
            let size = ($g.rows | first | get size)
            {sha: $g.sha, copies: ($g.rows | length), bytes_each: $size, wasted_bytes: ($size * (($g.rows | length) - 1)), paths: ($g.rows | get path)}
        }
        | sort-by wasted_bytes --reverse)

    # Identical subtrees = identical tree sha (whole duplicated directories).
    # A group is dropped when every copy sits inside another duplicated tree,
    # so only the outermost duplicate is reported.
    let tree_groups = (trees $ref
        | group-by sha
        | transpose sha rows
        | where {|g| ($g.rows | length) > 1 }
        | each {|g| {tree_sha: $g.sha, copies: ($g.rows | length), first_path: ($g.rows | first | get path), paths: ($g.rows | get path)} })
    let dup_tree_paths = ($tree_groups | each {|g| $g.paths } | flatten)
    let dup_trees = if ($tree_groups | is-empty) { [] } else {
        $tree_groups
        | where {|g| $g.paths | any {|p| ($p | path dirname) not-in $dup_tree_paths } }
        | join $dir_bytes first_path dir
        | each {|g| {tree_sha: $g.tree_sha, copies: $g.copies, files_each: $g.files, bytes_each: $g.bytes, wasted_bytes: ($g.bytes * ($g.copies - 1)), paths: $g.paths} }
        | sort-by wasted_bytes --reverse
        | first $top_dupes
    }

    let backups = ($files | where {|f| $f.path =~ $BACKUP_RE } | select path size)
    let generated = ($files | where {|f| $f.path =~ $GENERATED_RE } | select path size)

    let count_objects = (^git count-objects -v | lines | parse "{k}: {v}" | transpose -r -d)

    let doc = {
        schema: $SCHEMA
        ref: $ref
        commit: $commit
        tracked_files: ($files | length)
        tracked_bytes: $total
        git_local_pack_bytes: (($count_objects."size-pack"? | default "0" | into int) * 1024)
        git_local_pack_note: "size-pack of the clone that produced this report (includes all fetched refs), not the remote"
        top_files: ($files | sort-by size --reverse | first $top_files | select path size)
        top_dirs: ($dir_bytes | first $top_dirs)
        backup_pattern: {regex: $BACKUP_RE, files: $backups, bytes: (sum-of $backups size)}
        generated_or_runtime: {regex: $GENERATED_RE, files: $generated, bytes: (sum-of $generated size)}
        duplicate_content: {
            groups: ($dupes | length)
            wasted_bytes: (sum-of $dupes wasted_bytes)
            top: ($dupes | first $top_dupes)
        }
        duplicate_trees: $dup_trees
    }

    let json = ($doc | to json --indent 2)
    if $out == "" { $json } else { $json | save --force $out; print $"wrote ($out)" }
}
