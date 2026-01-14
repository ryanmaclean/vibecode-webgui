#!/usr/bin/env bash
#
# Bash completion for vibecode CLI
#
# Installation:
#   1. Copy to /usr/local/etc/bash_completion.d/vibecode
#   2. Or source in ~/.bashrc: source /path/to/vibecode-completion.bash
#

_vibecode_completions() {
    local cur prev opts
    COMPREPLY=()
    cur="${COMP_WORDS[COMP_CWORD]}"
    prev="${COMP_WORDS[COMP_CWORD-1]}"

    # Main commands
    opts="build start stop restart status check services ssh logs docker ip version help"

    # Completion for main command
    if [ $COMP_CWORD -eq 1 ]; then
        COMPREPLY=( $(compgen -W "${opts}" -- ${cur}) )
        return 0
    fi

    # Subcommand completions
    case "${prev}" in
        services)
            # No subcommands for services
            return 0
            ;;
        ssh)
            # No subcommands for ssh
            return 0
            ;;
        docker)
            # Could add docker subcommands if needed
            return 0
            ;;
        *)
            ;;
    esac
}

complete -F _vibecode_completions vibecode
