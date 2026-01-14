#compdef vibecode
#
# Zsh completion for vibecode CLI
#
# Installation:
#   1. Copy to /usr/local/share/zsh/site-functions/_vibecode
#   2. Or add to fpath in ~/.zshrc: fpath=(/path/to/completion/dir $fpath)
#   3. Run: compinit
#

_vibecode() {
    local -a commands
    commands=(
        'build:Build the menubar app from source'
        'start:Start the VibeCode app/VM'
        'stop:Stop the VibeCode app/VM'
        'restart:Restart the app/VM'
        'status:Show VM and service status'
        'check:Check all services availability'
        'services:List all services with ports and URLs'
        'ssh:SSH into the VM (interactive)'
        'logs:Show VM console logs'
        'docker:Check Docker status and info'
        'ip:Show VM IP address'
        'version:Show version information'
        'help:Show help message'
    )

    _arguments -C \
        '1: :->command' \
        '*::arg:->args'

    case $state in
        command)
            _describe 'vibecode command' commands
            ;;
        args)
            case $words[1] in
                services|svc)
                    # No subcommands
                    ;;
                ssh)
                    # No subcommands
                    ;;
                docker)
                    # Could add docker subcommands
                    ;;
                *)
                    ;;
            esac
            ;;
    esac
}

_vibecode "$@"
